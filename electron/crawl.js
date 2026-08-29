/**
 * Lancement du crawl depuis l'interface.
 *
 * C'est le seul programme que l'ovrsee exécute de lui-même, et c'est le sien :
 * `crawl/index.js`, jamais du code du projet observé. La seule chose qui vienne
 * du projet est la commande `dev` de son `ovrsee.config.json` — que le crawler
 * lit lui-même, sur le disque. Elle ne transite pas par ici, et surtout pas
 * depuis le rendu : la surface exposée dans `preload.cjs` ne reçoit qu'un chemin
 * de projet, déjà vérifié contre le registre par `main.js`.
 *
 * Ce fichier la LIT malgré tout, mais pour une seule chose : savoir s'il faut
 * demander l'accord et quoi afficher dans la question (`devSurDisque`,
 * `accordRequis`). Elle est relue ici sur le disque, jamais reçue du rendu, et
 * ce n'est pas cette lecture qui s'exécute — le crawler relit lui-même et
 * revérifie de son côté (`crawl/confiance.js`).
 *
 * Comme le terminal, ça passe par IPC et pas par `/api/*` : cette route est
 * aussi servie par le dev server Vite, en HTTP local non authentifié, et faire
 * démarrer un processus depuis là l'ouvrirait à tout ce qui tourne sous le même
 * compte.
 *
 * Ce fichier ne dit jamais qu'un crawl a échoué : `crawl/index.js` écrit ses
 * échecs dans `ovrsee/pages/scans.jsonl` et sort en code 0 — c'est sa trace, et
 * l'interface la lit déjà (`scanFailed`). Rendre l'erreur une seconde fois par
 * IPC créerait deux vérités à tenir d'accord.
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEV_DEFAUT, estApprouve } from '../crawl/confiance.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const CRAWLER = join(HERE, '..', 'crawl', 'index.js')

/**
 * La commande `dev` telle qu'elle est SUR LE DISQUE, ou `null` si le projet n'a
 * pas de configuration lisible.
 *
 * Relue ici, jamais reçue du rendu : c'est toute la garantie du contrôle. Un
 * rendu compromis qui pourrait proposer la chaîne à approuver approuverait ce
 * qu'il veut, et le sujet serait entièrement contourné.
 *
 * Le repli sur `DEV_DEFAUT` reproduit celui du crawler : sans lui, l'accord
 * porterait sur une chaîne que le crawler n'exécutera pas.
 *
 * @param {string} projectPath
 * @returns {string|null}
 */
export function devSurDisque(projectPath) {
  try {
    const config = JSON.parse(readFileSync(join(projectPath, 'ovrsee.config.json'), 'utf8'))
    const dev = config?.dev
    return typeof dev === 'string' ? dev : DEV_DEFAUT
  } catch {
    // Configuration absente ou cassée : rien à approuver. Le crawl échouera
    // pour cette raison-là, et il l'écrira dans `scans.jsonl` comme avant.
    return null
  }
}

/**
 * Faut-il demander l'accord avant de lancer ce crawl ?
 *
 * @param {string} projectPath
 * @returns {boolean}
 */
export function accordRequis(projectPath) {
  const dev = devSurDisque(projectPath)
  return dev !== null && !estApprouve(projectPath, dev)
}

/**
 * Le crawl en cours, par projet. Un seul à la fois et par projet : deux crawls
 * sur le même dépôt écriraient `pages.json` en même temps.
 *
 * @type {Map<string, {child: import('node:child_process').ChildProcess, line: string|null, reste: string}>}
 */
const running = new Map()

/** Les rendus à prévenir. Un `Set` : la fenêtre peut être recréée. */
const listeners = new Set()

/** L'état publié au rendu. Volontairement plat — il s'affiche tel quel. */
export function crawlState() {
  const [project, session] = running.entries().next().value ?? []
  return {
    running: running.size > 0,
    project: project ?? null,
    line: session?.line ?? null,
  }
}

function publish() {
  const etat = crawlState()
  for (const sender of listeners) {
    if (!sender.isDestroyed()) sender.send('crawl:state', etat)
  }
}

/**
 * Enregistre un rendu comme destinataire des changements d'état.
 *
 * @param {Electron.WebContents} sender
 */
export function watchCrawl(sender) {
  listeners.add(sender)
  sender.once('destroyed', () => listeners.delete(sender))
}

/**
 * Découpe un flux en lignes complètes, en gardant le reste pour le morceau
 * suivant. Un `chunk` ne s'arrête pas sur un `\n` : sans ça, une ligne coupée
 * en deux s'afficherait deux fois, à moitié.
 *
 * @param {string} reste ce qui restait du morceau précédent
 * @param {string} chunk
 * @returns {{lines: string[], reste: string}}
 */
export function decoupe(reste, chunk) {
  const parts = (reste + chunk).split('\n')
  // Le dernier élément n'est complet que si le morceau finissait par `\n` —
  // auquel cas `split` l'a laissé vide, et il ne coûte rien de le reporter.
  const suite = parts.pop() ?? ''
  return { lines: parts.filter(Boolean), reste: suite }
}

/** Ne garde que ce que le crawler annonce, sans son préfixe. */
export function progression(ligne) {
  return ligne.startsWith('[crawl] ') ? ligne.slice('[crawl] '.length) : null
}

/**
 * Démarre le crawl d'un projet.
 *
 * @param {string} projectPath dossier du projet, déjà reconnu par `main.js`
 * @returns {{running: boolean, project: string|null, line: string|null}}
 */
export function startCrawl(projectPath) {
  // Une seconde demande n'est pas une erreur — c'est un double clic. Rendre
  // l'état courant plutôt qu'un refus évite au rendu d'avoir à le distinguer.
  if (running.has(projectPath)) return crawlState()

  const child = spawn(process.execPath, [CRAWLER, projectPath], {
    cwd: projectPath,
    // Son propre groupe de processus. C'est ce qui permet d'arrêter aussi le
    // serveur de dev que le crawl démarre — voir `stopCrawl`.
    detached: true,
    // WHY: `process.execPath` est le binaire Ovrsee, pas `node`. Le lancer tel
    // quel ouvrirait une seconde fenêtre. `ELECTRON_RUN_AS_NODE=1` le fait se
    // comporter en node — et lui seul sait lire `app.asar`, où le crawler
    // reste dans l'application empaquetée. Même parade que `commandFor()` de
    // `hooks/install.js`.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const session = { child, line: null, reste: '' }
  running.set(projectPath, session)

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    const { lines, reste } = decoupe(session.reste, chunk)
    session.reste = reste
    for (const ligne of lines) {
      const message = progression(ligne)
      if (message) session.line = message
    }
    if (lines.length > 0) publish()
  })

  // Le crawler n'écrit sur stderr que son échec final, déjà consigné dans
  // `scans.jsonl`. Le lire évite de remplir le tuyau ; on n'en fait rien.
  child.stderr.resume()

  const fin = () => {
    running.delete(projectPath)
    publish()
  }
  child.on('exit', fin)
  child.on('error', fin)

  publish()
  return crawlState()
}

/**
 * Arrête le crawl d'un projet.
 *
 * Le signe moins n'est pas une coquille : c'est le **groupe** qu'on vise. Le
 * crawl a démarré le serveur de dev du projet (`dev` de sa configuration), et
 * tuer le seul processus fils le laisserait tourner — port occupé, et le crawl
 * suivant refuserait de démarrer.
 *
 * @param {string} projectPath
 */
export function stopCrawl(projectPath) {
  const session = running.get(projectPath)
  if (!session) return crawlState()

  try {
    process.kill(-session.child.pid, 'SIGTERM')
  } catch {
    // Deux cas tombent ici : le processus est mort entre la lecture et le
    // signal — `exit` a fait le ménage — ou bien on est sous Windows, qui ne
    // connaît pas les groupes de processus. Le repli n'arrête alors que le
    // crawler ; le serveur de dev qu'il a lancé, lui, reçoit son `SIGTERM` du
    // `stopApp` de `crawl/index.js`.
    try {
      session.child.kill('SIGTERM')
    } catch {
      /* déjà mort */
    }
  }
  return crawlState()
}

/** Tout arrêter — la fenêtre se ferme, aucun crawl ne doit lui survivre. */
export function stopAllCrawls() {
  for (const projectPath of running.keys()) stopCrawl(projectPath)
}
