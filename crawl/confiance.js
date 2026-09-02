/**
 * Confiance d'espace de travail : l'accord donné à la commande `dev` d'un dépôt.
 *
 * Le crawl exécute `config.dev` dans un shell. Cette ligne vit dans un fichier
 * VERSIONNÉ du dépôt observé — donc écrit par l'auteur de ce dépôt, qui n'est
 * pas forcément l'utilisateur. Recevoir un clone, l'inscrire et cliquer
 * « crawler » exécutait jusqu'ici son code sans que personne l'ait voulu.
 *
 * Ce que l'accord porte, exactement : **la chaîne qui part à `shellRun()`**,
 * sans normalisation d'aucune sorte. Ni `trim()`, ni écrasement des espaces, ni
 * casse — normaliser ouvrirait l'écart classique entre la forme approuvée et la
 * forme exécutée. Un espace en trop redemande l'accord ; c'est le bon côté sur
 * lequel se tromper.
 *
 * Ce n'est pas une revue de commande, et rien ici ne doit le prétendre :
 * `pnpm dev` est inoffensif à l'œil, ce qu'il exécute vit dans le
 * `package.json` du dépôt, son lockfile et ses `postinstall`. On accorde une
 * confiance à une PROVENANCE, pas un quitus à une ligne.
 *
 * Où vit l'accord : `~/.claude/ovrsee/trust.json`, **hors du dépôt observé**.
 * Même raison que `integrations.json` : un accord rangé dans `<projet>/ovrsee/`
 * serait fourni par l'attaquant, versionné avec son piège, et le contrôle
 * deviendrait décoratif.
 *
 * La chaîne est stockée en clair, jamais hachée : elle n'est pas un secret (le
 * dépôt la publie), et c'est ce qui permet de montrer « vous aviez approuvé X,
 * la configuration dit maintenant Y » — la seule information actionnable de
 * toute la question.
 */

import { chmodSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'

import { readJson } from '../hooks/json.js'

import { writeFileNoFollow } from '../hooks/plans.js'

/**
 * Le `dev` retenu faute de mieux. Défini ici, et pas dans `crawl/index.js`,
 * parce que trois appelants doivent en déduire la MÊME chaîne : le crawler,
 * `crawl/auth.js` et le processus principal Electron qui pose la question.
 * Deux valeurs par défaut différentes feraient approuver une chaîne et en
 * exécuter une autre.
 */
export const DEV_DEFAUT = 'pnpm dev'

/** `OVRSEE_TRUST` pour les tests — même convention que `OVRSEE_INTEGRATIONS`. */
export const trustPath = () =>
  process.env.OVRSEE_TRUST ?? join(homedir(), '.claude', 'ovrsee', 'trust.json')

/**
 * La clé sous laquelle un projet est retenu.
 *
 * Une seule fonction à l'écriture et à la lecture, sinon les hôtes ne se
 * comprennent pas : Electron approuve sous le chemin du registre, le crawler
 * calcule depuis `argv[2] ?? cwd()`, et depuis le hook `post-commit` il n'y a
 * pas d'argv du tout. Sur macOS `/tmp/x` et `/private/tmp/x` désignent le même
 * dossier — sans `realpath`, l'accord donné dans l'interface ne vaudrait pas
 * pour le hook, et le projet redemanderait éternellement.
 *
 * @param {string} root
 * @returns {string}
 */
export function cleProjet(root) {
  try {
    return realpathSync.native(root)
  } catch {
    // Dossier disparu ou illisible : la clé reste calculable, l'accord ne
    // servira simplement à rien — ce qui est le bon défaut.
    return resolve(root)
  }
}

/**
 * Le magasin entier. Fichier absent, JSON cassé, forme inattendue : rend un
 * magasin vide, jamais une exception. Un magasin abîmé redemande l'accord ; il
 * ne l'accorde jamais.
 *
 * @returns {{version: number, projets: Record<string, {dev: string, le: string}>}}
 */
export function lireConfiance() {
  const vide = { version: 1, projets: {} }
  const parsed = readJson(trustPath())
  const projets = parsed?.projets
  if (!projets || typeof projets !== 'object' || Array.isArray(projets)) return vide
  return { version: parsed.version ?? 1, projets }
}

/**
 * La commande approuvée pour ce projet, ou `null`.
 *
 * @param {string} root
 * @returns {string|null}
 */
export function devApprouve(root) {
  const entree = lireConfiance().projets[cleProjet(root)]
  return typeof entree?.dev === 'string' ? entree.dev : null
}

/**
 * Égalité stricte de chaînes, et rien d'autre. Voir l'en-tête du fichier.
 *
 * @param {string} root
 * @param {unknown} dev
 * @returns {boolean}
 */
export function estApprouve(root, dev) {
  return typeof dev === 'string' && devApprouve(root) === dev
}

/**
 * Enregistre l'accord.
 *
 * `writeFileNoFollow` comme le registre : c'est un fichier d'intégrité, un lien
 * symbolique planté à sa place le détournerait. `chmod 600` derrière — il n'y a
 * pas de secret dedans, mais aucune raison qu'un autre compte de la machine
 * puisse le réécrire.
 *
 * @param {string} root
 * @param {string} dev
 */
export function approuver(root, dev) {
  const magasin = lireConfiance()
  magasin.projets[cleProjet(root)] = { dev, le: new Date().toISOString() }

  const path = trustPath()
  writeFileNoFollow(path, JSON.stringify(magasin, null, 2) + '\n')
  try {
    chmodSync(path, 0o600)
  } catch {
    // Windows ne connaît pas ces bits. L'accord est écrit, c'est l'essentiel.
  }
}

/**
 * Que faire, connaissant l'accord et la présence d'un humain.
 *
 * Fonction pure pour être éprouvable : cette table à quatre cas est tout le
 * comportement, le reste n'est que de l'entrée-sortie.
 *
 * @param {{approuve: boolean, tty: boolean}} contexte
 * @returns {'lancer'|'demander'|'refuser'}
 */
export function decision({ approuve, tty }) {
  if (approuve) return 'lancer'
  return tty ? 'demander' : 'refuser'
}

/**
 * Le message écrit dans `scans.jsonl` quand l'accord manque.
 *
 * Il ne répète pas la commande : ce fichier est versionné, la commande est de
 * toute façon dans `ovrsee.config.json` deux dossiers plus haut, et une seconde
 * copie serait une seconde vérité à tenir d'accord.
 */
const MESSAGE_REFUS =
  "commande dev non approuvée pour ce dépôt — ouvrez Ovrsee et lancez le crawl pour l'autoriser"

/** Question `y/N` sur le terminal, défaut non. */
async function demanderEnTerminal(root, dev) {
  const avant = devApprouve(root)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    process.stdout.write(
      `\nOvrsee va lancer « ${dev} » dans ${root}.\n` +
        (avant !== null ? `La commande approuvée était « ${avant} ».\n` : '') +
        "Cela exécute du code de ce dépôt — la commande, les scripts qu'elle appelle\n" +
        "et leurs dépendances. Ne l'autorisez que si vous faites confiance à sa\n" +
        'provenance.\n',
    )
    const reponse = await rl.question('Exécuter ? [y/N] ')
    return reponse.trim().toLowerCase() === 'y'
  } finally {
    rl.close()
  }
}

/**
 * La garde, posée aux deux sites d'exécution — juste avant `shellRun()`, et
 * jamais aux points d'entrée : c'est le seul endroit qui voie la valeur
 * réellement exécutée, et on ne peut pas l'oublier en ajoutant un appelant.
 *
 * Le refus lève. Dans `crawl/index.js` le `catch` existant écrit le scan échoué
 * et sort en code 0 — l'invariant « un scan échoué s'écrit » tient sans câbler
 * de nouveau chemin d'échec.
 *
 * Sans humain (hook `post-commit`, `stdio: 'ignore'`), on refuse : on ne
 * s'auto-approuve pas, et on ne bloque pas sur une question que personne ne
 * lira. Le prochain clic sur « Crawler » débloque tout.
 *
 * @param {string} root
 * @param {string} dev la chaîne exacte qui partira à `shellRun()`
 */
export async function assurerConfiance(root, dev) {
  // `undefined` sous `spawn`, pas `false` : c'est la valeur de vérité qu'on
  // teste. Et `stdin`, pas `stdout` — Electron redirige stdout en `pipe` alors
  // même qu'un humain regarde l'écran.
  const etape = decision({ approuve: estApprouve(root, dev), tty: Boolean(process.stdin.isTTY) })
  if (etape === 'lancer') return
  if (etape === 'demander' && (await demanderEnTerminal(root, dev))) {
    approuver(root, dev)
    return
  }
  throw new Error(MESSAGE_REFUS)
}
