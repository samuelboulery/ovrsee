/**
 * Le seul point d'où part une commande `git` visant un dépôt observé.
 *
 * Un dépôt n'est pas qu'un arbre de fichiers : son `.git/config` est du code
 * que git exécute pour son compte. `core.fsmonitor` nomme un programme lancé
 * au premier `git status` ; `core.pager`, `diff.external`, `core.sshCommand`
 * et `credential.helper` en nomment d'autres. Un dépôt reçu d'ailleurs — un
 * zip, une clé, un clone hostile — les apporte avec lui.
 *
 * L'ovrsee lit un dépôt **avant** que quiconque ait accordé quoi que ce soit :
 * l'inscrire au registre suffit à déclencher `snapshot()`, donc `git status`.
 * L'accord gardé dans `trust.json` (T-0190) ne couvre que la ligne `dev` du
 * crawl, et il arrive bien plus tard. Sans la garde ci-dessous, « inscrire un
 * projet » exécutait donc du code de ce projet — exactement ce que l'invariant
 * du cadrage interdit.
 *
 * `GIT_CONFIG_NOSYSTEM` ne sert à rien ici : il neutralise la configuration du
 * système, pas celle du dépôt, qui est justement la seule à venir du dehors.
 * Ce qui marche est de neutraliser nommément chaque réglage qui lance un
 * programme, par des `-c` posés avant la sous-commande — ils gagnent sur le
 * `.git/config`.
 *
 * Ce module n'est pas une commodité : c'est la garde. Appeler `execFileSync`
 * sur `git` ailleurs la contourne en silence.
 */

import { execFileSync } from 'node:child_process'
import { devNull, homedir } from 'node:os'
import { resolve } from 'node:path'

/**
 * Réglages qui font exécuter un programme nommé par le dépôt, neutralisés.
 *
 * `core.fsmonitor=false` (et non `''`) : la valeur booléenne est celle que git
 * documente pour couper le démon, et elle couvre aussi la forme `true` qui
 * lancerait `fsmonitor--daemon`. Les autres se vident : une chaîne vide veut
 * dire « aucun programme », là où `false` ne serait pas une valeur valide.
 *
 * `core.hooksPath` vers le périphérique nul : aucun hook n'y existe. Un dépôt
 * reçu en archive apporte ses `.git/hooks/` exécutables, et `--no-verify` ne
 * coupe que `pre-commit` et `commit-msg` — `prepare-commit-msg`, `post-commit`,
 * `post-index-change` ou `reference-transaction` tournaient à l'équipement.
 *
 * Les programmes gpg : `log.showSignature` les lance au `git log` de
 * `snapshot()` dès qu'un commit est signé, `commit.gpgSign` au commit
 * d'amorçage. On coupe la signature, la vérification, et chaque programme.
 */
export const SANS_PROGRAMME = [
  // `pager.<commande>` du dépôt l'emporte sur `core.pager` : seul ce drapeau coupe tout.
  '--no-pager',
  '-c', 'core.fsmonitor=false',
  '-c', 'core.pager=cat',
  '-c', 'diff.external=',
  '-c', 'protocol.ext.allow=never',
  '-c', `core.hooksPath=${devNull}`,
  '-c', 'commit.gpgSign=false',
  '-c', 'tag.gpgSign=false',
  '-c', 'log.showSignature=false',
  '-c', 'gpg.program=',
  '-c', 'gpg.openpgp.program=',
  '-c', 'gpg.ssh.program=',
  '-c', 'gpg.x509.program=',
]

/**
 * Clés que le dépôt peut régler et qu'un `-c` générique ne couvre pas.
 *
 * - Les filtres de `.gitattributes` (`filter=x`) passent chaque fichier dans
 *   `filter.x.clean` ou `filter.x.process` — au `git status` qui relit un
 *   fichier modifié comme au `git add`. Le pilote se nomme dans le dépôt : on
 *   ne peut pas le neutraliser d'avance, il faut d'abord le lire.
 * - `http.<url>.cookieFile` et `saveCookies` : avec eux, libcurl réécrit au
 *   fetch un fichier choisi par le dépôt (`~/.zshrc`). Une clé propre à une URL
 *   l'emporte sur `-c http.cookieFile=` : seule la clé exacte la vide.
 * - `core.worktree`, qu'aucun `-c` ne surcharge : git le lit avant la ligne de
 *   commande. On refuse le dépôt plutôt que d'écrire ailleurs que chez lui.
 */
const CLES_DU_DEPOT = '^(filter\\..+\\.(clean|smudge|process)|http\\.(.+\\.)?(cookiefile|savecookies)|core\\.worktree)$'

/** Portées qui viennent du dépôt : `.git/config`, ses inclusions, et `config.worktree`. */
const DU_DEPOT = new Set(['local', 'worktree'])

/**
 * Les `-c` qui vident ce que le dépôt a réglé parmi `CLES_DU_DEPOT`.
 *
 * Lire n'exécute rien : `git config --get-regexp` ne lance aucun filtre. Toutes
 * les portées sont lues d'un coup — `--local` ignorait `config.worktree` — et la
 * valeur réglée par l'utilisateur pour lui-même (git-lfs, en global ou en
 * système) est réinjectée, comme les helpers d'authentification de `gitReseau`.
 * Seules les clés que le dépôt définit sont touchées : un `process` vidé reste
 * « défini » pour git, qui le préfère alors à `clean` — et coupait le filtre
 * du poste.
 *
 * @throws si le dépôt pose `core.worktree`, ou une clé contenant `=` : `-c`
 *   coupe au premier `=`, et `-c filter.a=b.clean=` viserait `filter.a`.
 */
const sansReglagesDuDepot = (root, env) => {
  let brut = ''
  try {
    brut = execFileSync('git', ['-C', root, 'config', '--show-scope', '--includes', '-z', '--get-regexp', CLES_DU_DEPOT], {
      cwd: homedir(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...(env ? { env } : {}),
    })
  } catch {
    // Aucune clé, ou pas un dépôt : rien à neutraliser.
  }
  // `-z` : `portée\0clé\nvaleur\0`, sans ambiguïté sur les espaces d'une sous-section.
  const champs = brut.split('\0')
  const entrees = []
  for (let i = 0; i + 1 < champs.length; i += 2) {
    const [cle, ...valeur] = champs[i + 1].split('\n')
    entrees.push({ portee: champs[i], cle, valeur: valeur.join('\n') })
  }
  const cles = [...new Set(entrees.filter(e => DU_DEPOT.has(e.portee)).map(e => e.cle))]
  if (cles.includes('core.worktree')) throw new Error('git : core.worktree réglé par le dépôt, refusé')
  if (cles.some(cle => cle.includes('='))) throw new Error('git : clé de configuration contenant « = », refusée')

  const duPoste = cle => entrees.filter(e => e.cle === cle && !DU_DEPOT.has(e.portee)).at(-1)?.valeur ?? ''
  const pilotes = new Set(cles.filter(cle => cle.startsWith('filter.')).map(cle => cle.slice('filter.'.length, cle.lastIndexOf('.'))))
  return [
    ...cles.flatMap(cle => ['-c', `${cle}=${duPoste(cle)}`]),
    ...[...pilotes].flatMap(pilote => ['-c', `filter.${pilote}.required=false`]),
  ]
}

/**
 * Ce qui ne concerne que les commandes qui parlent au réseau.
 *
 * `credential.helper` et `core.sshCommand` ne sont lus que par `fetch`, `push`
 * et `clone` : les poser sur un `git status` ne protégerait de rien. Et les
 * poser bêtement casse le cas normal — un `-c credential.helper=` réinitialise
 * la liste **entière**, y compris le trousseau du poste, et `git fetch` sur un
 * dépôt privé en HTTPS échoue faute de savoir qui demander.
 *
 * D'où la réinjection : on efface ce que le dépôt a pu écrire, puis on remet
 * ce que l'utilisateur a réglé pour lui-même. L'ordre compte — la valeur vide
 * remet la liste à zéro, celles d'après la reconstruisent.
 */
const RESEAU_SANS_PROGRAMME = [
  '-c', 'credential.helper=',
  '-c', 'core.askPass=',
  '-c', 'core.sshCommand=ssh',
  // Seuls https, http et ssh. Le transport local (`file`, ou un simple chemin)
  // lance `remote.<n>.uploadpack` sur le poste ; `git://` passe par
  // `core.gitProxy`. Un `url.*.insteadOf` du dépôt ne peut plus y ramener.
  '-c', 'protocol.allow=never',
  '-c', 'protocol.https.allow=always',
  '-c', 'protocol.http.allow=always',
  '-c', 'protocol.ssh.allow=always',
  '-c', 'core.alternateRefsCommand=',
  // Un sous-module a son propre `.git/config`, que `sansReglagesDuDepot` ne lit pas.
  '-c', 'fetch.recurseSubmodules=false',
]

/**
 * Valeurs réglées par l'utilisateur pour lui-même, à réinjecter après le reset.
 *
 * Lues avec l'environnement de l'appelant, et non mémoïsées : `GIT_CONFIG_GLOBAL`
 * décide de quel fichier est « le global », et un cache rendrait la réponse du
 * premier appelant à tous les suivants. Deux `git config` locaux ne pèsent rien
 * devant l'opération réseau qui suit.
 *
 * `--global` et jamais la portée du dépôt : c'est la configuration du poste
 * qu'on veut : celle du dépôt observé est exactement ce dont on se protège.
 */
const reglagesDuPoste = env => {
  const lire = cle => {
    try {
      return execFileSync('git', ['config', '--global', '--get-all', cle], {
        cwd: homedir(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        ...(env ? { env } : {}),
      })
        .split('\n')
        .filter(Boolean)
    } catch {
      // Réglage absent : git sort en 1. Ce n'est pas une panne.
      return []
    }
  }
  return [
    ...lire('credential.helper').flatMap(v => ['-c', `credential.helper=${v}`]),
    ...lire('core.sshCommand').flatMap(v => ['-c', `core.sshCommand=${v}`]),
  ]
}

/**
 * Lance `git` sur un dépôt dont on ne contrôle pas la configuration.
 *
 * Mêmes options qu'`execFileSync`, dont l'appelant garde la main : seule la
 * liste d'arguments est préfixée. Ne capture aucune erreur — c'est à
 * l'appelant de décider si un dépôt muet est une panne ou un cas normal.
 *
 * @param {string} root racine du dépôt observé
 * @param {string[]} args arguments de git, sous-commande comprise
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 * @returns {string} la sortie standard, décodée selon `options.encoding`
 */
export const git = (root, args, options = {}) => lancer(root, [...SANS_PROGRAMME, ...sansReglagesDuDepot(resolve(root), options.env), ...args], options)

/**
 * `-C` et non `cwd` : sous Windows, un nom de programme sans chemin se cherche
 * d'abord dans le `cwd` du processus lancé — un `git.exe` à la racine du dépôt
 * observé passerait avant celui du PATH. Le dossier personnel n'est pas à lui.
 */
const lancer = (root, args, options) => execFileSync('git', ['-C', resolve(root), ...args], { ...options, cwd: homedir() })

/**
 * Lance une commande git qui parle au réseau, sur un dépôt observé.
 *
 * Même garde que `git()`, plus celle des programmes d'authentification — mais
 * en rendant à l'utilisateur les siens, sans quoi un `fetch` sur son propre
 * dépôt privé échouerait.
 *
 * @param {string} root racine du dépôt observé
 * @param {string[]} args arguments de git, sous-commande comprise
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 */
export const gitReseau = (root, args, options = {}) =>
  lancer(
    root,
    [
      ...SANS_PROGRAMME,
      ...sansReglagesDuDepot(resolve(root), options.env),
      ...RESEAU_SANS_PROGRAMME,
      ...reglagesDuPoste(options.env),
      ...args,
    ],
    options,
  )
