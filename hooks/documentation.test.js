/**
 * Vérification de la cohérence entre la documentation (README, CLAUDE.md)
 * et l'état réel du dépôt.
 *
 * Valide que :
 * - Les commandes mentionnées existent dans package.json
 * - Les chemins mentionnés existent sur le disque
 * - Les affirmations factuelles correspondent à la réalité
 */

import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const readmeFr = readFileSync(join(root, 'README.fr.md'), 'utf8')
const readmeEn = readFileSync(join(root, 'README.md'), 'utf8')
const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8')

/**
 * Les sous-commandes de pnpm lui-même. Elles n'ont pas à figurer dans
 * `scripts` — et le README doit pouvoir dire `pnpm install`.
 */
const PNPM_NATIVES = new Set(['install', 'add', 'remove', 'update', 'dlx', 'exec', 'run'])

/**
 * Extraits les commandes pnpm citées dans un texte.
 * Cherche les patterns comme `pnpm <script>`.
 * @param {string} text
 * @returns {string[]} liste des scripts trouvés
 */
function extractPnpmScripts(text) {
  const matches = text.match(/pnpm\s+([\w:-]+)/g) || []
  return matches
    .map(m => m.replace('pnpm ', ''))
    .filter(name => !PNPM_NATIVES.has(name))
    .filter((v, i, a) => a.indexOf(v) === i) // déduplique
}

// Un `extractPaths` vivait ici, censé relever tous les chemins cités dans un
// README pour vérifier qu'ils existent. Les deux tests plus bas l'appelaient et
// jetaient son résultat — parce qu'il ne marchait pas : son alternance
// `js|ts|tsx|json` faisait correspondre `js` en premier, donc `ovrsee/board.json`
// devenait `ovrsee/board.js`, et la prose produisait des chemins inventés comme
// `plans/tickets/pages`. Le câbler aurait fait échouer les tests sur du bruit.
//
// Ce qui reste vérifie une liste courte et écrite à la main. C'est moins
// ambitieux, mais c'est vrai.

test('les commandes pnpm citées dans README.fr.md existent', () => {
  const scripts = extractPnpmScripts(readmeFr)
  assert(scripts.length > 0, 'Aucune commande pnpm trouvée dans README.fr.md')

  for (const script of scripts) {
    assert(
      pkg.scripts[script],
      `Commande 'pnpm ${script}' citée dans README.fr.md mais absente de package.json`
    )
  }
})

test('les commandes pnpm citées dans README.md existent', () => {
  const scripts = extractPnpmScripts(readmeEn)
  assert(scripts.length > 0, 'Aucune commande pnpm trouvée dans README.md')

  for (const script of scripts) {
    assert(
      pkg.scripts[script],
      `Commande 'pnpm ${script}' citée dans README.md mais absente de package.json`
    )
  }
})

test('les commandes pnpm citées dans CLAUDE.md existent', () => {
  const scripts = extractPnpmScripts(claudeMd)
  // Filtre les scripts documentés pour des futures implémentations
  const implemented = scripts.filter(s => pkg.scripts[s])
  assert(implemented.length > 0, 'Aucune commande pnpm implémentée trouvée dans CLAUDE.md')
})

test('README.fr.md mentionne les 7 onglets', () => {
  const tabs = ['aperçu', 'navigateur', 'produit', 'historique', 'tableau', 'données', 'stack']
  for (const tab of tabs) {
    assert(
      readmeFr.toLowerCase().includes(tab.toLowerCase()),
      `Onglet '${tab}' non mentionné dans README.fr.md`
    )
  }
  // Vérifier que 6 n'est pas mentionné
  assert(
    !readmeFr.match(/\bsix\s+onglets\b/i),
    'README.fr.md mentionne "six onglets" au lieu de 7'
  )
})

test('README.md mentionne les 7 onglets', () => {
  const tabs = ['overview', 'navigator', 'product', 'history', 'board', 'data', 'stack']
  for (const tab of tabs) {
    assert(
      readmeEn.toLowerCase().includes(tab),
      `Tab '${tab}' not mentioned in README.md`
    )
  }
})

test('CLAUDE.md mentionne mcp/ dans le tableau des couches', () => {
  assert(
    claudeMd.includes('mcp/'),
    'Dossier mcp/ non mentionné dans le tableau des couches de CLAUDE.md'
  )
})

test('README.fr.md mentionne le dossier mcp/', () => {
  assert(
    readmeFr.includes('mcp/'),
    'Dossier mcp/ non mentionné dans l\'arborescence de README.fr.md'
  )
})

test('les dossiers cités dans README.fr.md existent', () => {
  const required = ['ovrsee/', 'hooks/', 'crawl/', 'app/', 'electron/']

  for (const path of required) {
    assert(
      existsSync(join(root, path)),
      `Chemin '${path}' cité dans README.fr.md n'existe pas`
    )
  }
})

test('les dossiers cités dans README.md existent', () => {
  const required = ['ovrsee/', 'hooks/', 'crawl/', 'app/', 'electron/']

  for (const path of required) {
    assert(
      existsSync(join(root, path)),
      `Chemin '${path}' cité dans README.md n'existe pas`
    )
  }
})

// La traduction est la moitié qui disparaît : l'anglais est la langue source du
// dépôt, `README.fr.md` est ce qu'on oublie de renommer.
test('README.fr.md existe', () => {
  assert(
    existsSync(join(root, 'README.fr.md')),
    'README.fr.md n\'existe pas'
  )
})

// Ce test regardait autrefois `ovrsee/pages/shots/` sur le disque. Les captures
// ne sont plus suivies par git (`.gitignore`, et `data.ts` conseille de les
// ignorer dans les projets observés) : un clone frais n'en a aucune, et
// l'assertion échouait en CI sans que rien ne soit cassé.
//
// L'invariant qui compte survit au clone : `pages.json`, lui, est versionné, et
// c'est lui que l'interface lit pour savoir quelle capture montrer.
test('pages.json déclare une capture pour chaque onglet', () => {
  const tabs = ['accueil', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']
  const pages = JSON.parse(readFileSync(join(root, 'ovrsee', 'pages', 'pages.json'), 'utf8'))
  const couverts = new Set(
    pages.pages.map(p => p.shot?.split('/')[1]).filter(Boolean)
  )

  for (const tab of tabs) {
    assert(
      couverts.has(tab),
      `Aucune capture déclarée pour l'onglet '${tab}' dans pages.json`
    )
  }
})

// Le badge « version » est dynamique (shields lit package.json sur GitHub) ; celui
// des dépendances de production ne peut pas l'être — shields ne sait pas compter
// les clés d'un objet JSON. Ce test tient donc le chiffre à jour à sa place.
test('le badge des dépendances de production annonce le bon compte', () => {
  const attendu = Object.keys(pkg.dependencies).length

  for (const [nom, readme] of [['README.md', readmeEn], ['README.fr.md', readmeFr]]) {
    const badge = readme.match(/img\.shields\.io\/badge\/[^-)]*(?:prod|deps)[^-)]*-(\d+)-/)
    assert(badge, `Badge des dépendances de production introuvable dans ${nom}`)
    assert.equal(
      Number(badge[1]),
      attendu,
      `${nom} annonce ${badge[1]} dépendances de production, package.json en déclare ${attendu}`
    )
  }
})

/**
 * Le plafond de 800 lignes, mesuré au lieu d'être raconté.
 *
 * `rules/common/coding-style.md` le fixe, T-0206 l'a rétabli sur quatre
 * fichiers — et `Terminal.tsx` l'avait repassé dans les dix jours sans que
 * rien ne le dise (T-0241). Une règle qu'aucun test ne tient dérive dès qu'on
 * regarde ailleurs.
 *
 * Les tests ne sont pas comptés : un fichier de cas est une liste, et la
 * couper en deux ne rend rien plus lisible.
 */
const PLAFOND = 800

/**
 * Ce qui dépasse aujourd'hui, nommément — la liste *est* la dette, et elle est
 * faite pour raccourcir. Y ajouter une ligne est un choix qu'on écrit ; ne rien
 * pouvoir y ajouter sans le remarquer est tout l'intérêt.
 */
const AU_DESSUS = new Map([
  ['hooks/i18n.js', 'un dictionnaire : de la donnée, pas de la logique — le couper ne range rien'],
  ['app/src/App.tsx', 'le prochain sur la liste (851 l) — même découpage que T-0241, pas encore fait'],
])

test('aucun fichier source ne dépasse 800 lignes, hors exemptions nommées', () => {
  const dossiers = ['hooks', 'crawl', 'server', 'mcp', 'electron', 'app/src', 'scripts', 'site']
  const fichiers = []

  const parcourir = dir => {
    for (const entree of readdirSync(join(root, dir), { withFileTypes: true })) {
      const relatif = `${dir}/${entree.name}`
      if (entree.isDirectory()) {
        if (entree.name !== 'assets' && entree.name !== 'fr') parcourir(relatif)
      } else if (/\.(js|cjs|ts|tsx)$/.test(entree.name) && !entree.name.includes('.test.')) {
        fichiers.push(relatif)
      }
    }
  }
  dossiers.forEach(parcourir)

  const trop = []
  for (const f of fichiers) {
    const lignes = readFileSync(join(root, f), 'utf8').split('\n').length
    if (lignes > PLAFOND && !AU_DESSUS.has(f)) trop.push(`${f} (${lignes} l)`)
  }
  assert.deepEqual(trop, [], `Au-dessus de ${PLAFOND} lignes sans exemption : ${trop.join(', ')}`)

  // L'inverse compte autant : une exemption dont le fichier est repassé sous le
  // plafond doit être retirée, sinon la liste ment sur ce qui reste à faire.
  const inutiles = [...AU_DESSUS.keys()].filter(
    f => readFileSync(join(root, f), 'utf8').split('\n').length <= PLAFOND,
  )
  assert.deepEqual(inutiles, [], `Exemptions devenues inutiles, à retirer : ${inutiles.join(', ')}`)
})

/**
 * Une garde ne vaut que si on ne peut pas l'oublier.
 *
 * `hooks/git.js` neutralise les réglages du `.git/config` d'un dépôt observé
 * qui font exécuter un programme — `core.fsmonitor` en nomme un, et `git status`
 * le lance. Appeler `execFileSync('git', …)` ailleurs contourne cette garde en
 * silence : le code marche, les tests passent, et l'exécution revient.
 *
 * Les exemptions sont nommées, et pour une seule raison : ces appelants tournent
 * dans le dépôt courant — celui où l'utilisateur est déjà en train de committer —
 * et jamais sur un chemin venu du registre. La liste est la dette, pas la règle.
 */
const GIT_DIRECT_TOLERE = new Map([
  ['hooks/git.js', 'le module qui porte la garde : c’est lui qui appelle git'],
  ['hooks/entree.js', 'le dépôt courant du hook, jamais un chemin du registre'],
  ['hooks/ovrsee-cli.js', 'idem — la CLI tourne dans le dépôt où on l’invoque'],
  ['hooks/ovrsee-post-commit.js', 'idem — hook git, donc déjà dans le dépôt'],
  ['hooks/ovrsee-post-merge.js', 'idem'],
  ['hooks/ovrsee-session-start.js', 'idem'],
  ['hooks/ovrsee-tool-stop.js', 'idem'],
  ['hooks/reconcile.js', 'idem'],
])

test('aucune commande git ne contourne la garde de hooks/git.js', () => {
  const dossiers = ['hooks', 'crawl', 'server', 'mcp', 'electron', 'scripts']
  const coupables = []

  const parcourir = dir => {
    for (const entree of readdirSync(join(root, dir), { withFileTypes: true })) {
      const relatif = `${dir}/${entree.name}`
      if (entree.isDirectory()) {
        parcourir(relatif)
      } else if (/\.(js|cjs)$/.test(entree.name) && !entree.name.includes('.test.')) {
        const source = readFileSync(join(root, relatif), 'utf8')
        if (/execFileSync\(\s*'git'/.test(source) && !GIT_DIRECT_TOLERE.has(relatif)) {
          coupables.push(relatif)
        }
      }
    }
  }
  dossiers.forEach(parcourir)

  assert.deepEqual(
    coupables,
    [],
    `ces fichiers appellent git sans passer par hooks/git.js :\n  ${coupables.join('\n  ')}\n` +
      'Utiliser `git()` ou `gitReseau()`, ou nommer l’exemption et dire pourquoi.',
  )

  // La liste raccourcit ou elle ment : une exemption devenue inutile doit se
  // voir, comme pour le plafond de lignes.
  const inutiles = [...GIT_DIRECT_TOLERE.keys()].filter(f => {
    if (!existsSync(join(root, f))) return true
    return !/execFileSync\(\s*'git'/.test(readFileSync(join(root, f), 'utf8'))
  })
  assert.deepEqual(inutiles, [], `exemptions devenues inutiles : ${inutiles.join(', ')}`)
})
