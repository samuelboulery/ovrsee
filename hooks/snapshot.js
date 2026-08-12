/**
 * Lecture d'un projet : ce que l'interface a besoin de savoir, en une fois.
 *
 * Module Node pur — aucun import Vite, aucun import Electron. C'est la
 * frontière qui rend la coquille remplaçable : le dev server et l'application
 * empaquetée lisent le même code, donc ne peuvent pas diverger sur le calcul
 * du backlog ou sur la fraîcheur d'un scan.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, isAbsolute, join, normalize, sep } from 'node:path'

import { isSafePlanFileName, readPlans, readRegistry } from './plans.js'
import { readBoard, readTickets } from './tickets.js'
import { readVault } from './vault.js'
import { readWhys } from './whys.js'
import { timeline, ticketTimeline } from './timeline.js'
import { readSettings, mergeSettings } from './settings.js'
import { gitStatus } from './git-status.js'
import { readIntegrations } from './integrations.js'

export const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Un fichier texte du dépôt, ou null.
 *
 * Le plafond n'est pas de la prudence de principe : le README part dans chaque
 * réponse `/api/project`, c'est-à-dire à chaque changement de projet et à
 * chaque rechargement du tableau. Un README généré de plusieurs mégaoctets
 * ferait payer sa taille à des lectures qui n'en ont que faire. Au-delà, on
 * coupe et on le dit — un texte tronqué en silence serait un mensonge de plus.
 */
const MAX_TEXT = 200_000

const readText = path => {
  try {
    const text = readFileSync(path, 'utf8')
    if (text.length <= MAX_TEXT) return text
    return `${text.slice(0, MAX_TEXT)}\n\n_(coupé à ${MAX_TEXT} caractères)_\n`
  } catch {
    return null
  }
}

/**
 * Projets connus, du dernier ouvert au plus ancien.
 *
 * L'ordre est celui de l'usage, pas celui de l'insertion : on retourne à un
 * projet bien plus souvent qu'on n'en ajoute, et le chercher en bas d'une liste
 * qui s'allonge est du travail pour rien. Une entrée sans `lastOpened` vient
 * d'un registre écrit avant cette date — elle passe en fin de liste, dans son
 * ordre d'origine, plutôt que de prétendre à une fraîcheur qu'on ne connaît pas.
 *
 * Le registre est la seule source : rien n'entre dans la liste sans y avoir été
 * inscrit. Le dépôt courant était autrefois ajouté en tête s'il portait un
 * `ovrsee/`, ce qui faisait qu'un clone frais s'ouvrait déjà sur lui-même et
 * qu'on ne voyait jamais l'écran de premier lancement. Cette liste sert aussi de
 * liste blanche (`known()` de `server/api.js`, gardes d'`electron/main.js`) :
 * la vider de son implicite y est un gain, pas seulement une simplification.
 */
export function projects() {
  const known = readRegistry()

  // Tri stable : `sort` l'est en JavaScript moderne, donc deux entrées sans
  // date gardent leur ordre d'écriture.
  return [...known].sort((a, b) => (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''))
}

/**
 * Captures successives par page, de la plus récente à la plus ancienne.
 *
 * Le tri se fait sur la date d'écriture du fichier, pas sur son nom. Les noms
 * sont en `date-sha.png` : plusieurs scans du même jour ne se départagent que
 * par le sha, dont l'ordre alphabétique n'a rien à voir avec le temps. Trier
 * par nom donnait donc une chronologie fausse dès la deuxième capture du jour
 * — invisible tant qu'on n'en montrait que quatre, flagrant dans la
 * visionneuse. Le nom sert encore de départage stable à mtime égal.
 */
export function shotsByPage(root) {
  const base = join(root, 'ovrsee', 'pages', 'shots')
  const out = {}
  try {
    for (const slug of readdirSync(base)) {
      const dir = join(base, slug)
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.png'))
        .map(name => ({ name, at: statSync(join(dir, name)).mtimeMs }))
        .sort((a, b) => b.at - a.at || b.name.localeCompare(a.name))
        .map(f => f.name)
      if (files.length > 0) out[slug] = files
    }
  } catch {
    // Aucun crawl n'a encore tourné sur ce projet.
  }
  return out
}

/**
 * Traces de scan, une par ligne. Les échecs comptent autant que les succès.
 *
 * Une ligne illisible est sautée — un journal en append-only peut être coupé
 * net par un arrêt brutal, et une ligne tronquée ne doit pas emporter les
 * autres. Elle est comptée, en revanche : sauter en silence ferait passer un
 * journal abîmé pour un journal court.
 */
function scans(root, illisibles = []) {
  let cassees = 0
  let lignes = []
  try {
    lignes = readFileSync(join(root, 'ovrsee', 'pages', 'scans.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try {
          return [JSON.parse(line)]
        } catch {
          cassees += 1
          return []
        }
      })
  } catch {
    return []
  }
  if (cassees > 0) {
    illisibles.push({ file: 'pages/scans.jsonl', quoi: 'scan', lignes: cassees })
  }
  return lignes
}

/**
 * Journal des audits, une ligne par revue capturée par
 * `ovrsee-capture-audit.js` — même tolérance qu'un journal de scans : une
 * ligne illisible est sautée et comptée, jamais fatale aux autres.
 */
function audits(root, illisibles = []) {
  let cassees = 0
  let lignes = []
  try {
    lignes = readFileSync(join(root, 'ovrsee', 'audits.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try {
          return [JSON.parse(line)]
        } catch {
          cassees += 1
          return []
        }
      })
  } catch {
    return []
  }
  if (cassees > 0) {
    illisibles.push({ file: 'audits.jsonl', quoi: 'audit', lignes: cassees })
  }
  return lignes
}

/**
 * Journal git du projet, du plus récent au plus ancien.
 *
 * Les commits ne vivaient dans l'ovrsee que rattachés à un plan. Ceux faits
 * hors plan n'existaient nulle part, et la chronologie sautait d'une intention
 * à l'autre sans montrer le travail entre les deux.
 *
 * `\x1f` sépare les champs : c'est le séparateur d'unité d'ASCII, qu'aucun
 * sujet de commit ne contient — contrairement à `|` ou à une tabulation.
 * Un dossier sans dépôt git rend une liste vide plutôt qu'une erreur : la
 * frise se réduit alors aux plans, ce qui reste vrai.
 */
function commits(root, limit = 300) {
  try {
    return execFileSync('git', ['log', `-n${limit}`, '--pretty=format:%h\x1f%aI\x1f%s'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [sha, date, subject] = line.split('\x1f')
        return { sha, date, subject }
      })
  } catch {
    return []
  }
}

/**
 * Colonnes et tickets d'un projet.
 *
 * Extrait de `snapshot()` parce que la route d'écriture des tickets rend cette
 * moitié-là seule : après un glisser-déposer, relire le graphe, les captures et
 * le journal git serait du travail pour rien.
 */
export function tableau(root, illisibles = []) {
  const ovrseeDir = join(root, 'ovrsee')
  const colonnes = readBoard(ovrseeDir)

  return {
    board: colonnes,
    // Aplati comme les plans : l'interface lit `ticket.titre`, pas
    // `ticket.meta.titre`. Le corps prend son nom français au passage, pour ne
    // pas se confondre avec le `body` d'un plan dans les mêmes composants.
    tickets: readTickets(ovrseeDir, colonnes, illisibles).map(t => ({
      file: t.file,
      ...t.meta,
      corps: t.body,
    })),
    illisibles,
  }
}

/**
 * Le chemin d'un coffre déclaré : absolu, `~`, ou relatif à la racine.
 *
 * `~` est développé parce que c'est ce que quelqu'un écrit pour un coffre qui
 * vit dans son dossier personnel. Sans cela, `join()` en ferait `<repo>/~/…`,
 * et l'onglet dirait « coffre illisible » en désignant un chemin que personne
 * n'a demandé.
 */
export const vaultPath = (root, declare) => {
  if (declare === '~') return homedir()
  if (declare.startsWith('~/')) return join(homedir(), declare.slice(2))
  return isAbsolute(declare) ? declare : join(root, declare)
}

/**
 * Date de modification d'un fichier, au format ISO, ou null.
 *
 * Utilisé pour dater le graphe Graphify et obtenir la mtime la plus récente
 * du coffre Obsidian.
 */
function fileDate(path) {
  try {
    const stat = statSync(path)
    return new Date(stat.mtime).toISOString().split('T')[0]
  } catch {
    return null
  }
}

/**
 * Le graphe du projet, et d'où il vient.
 *
 * Trois niveaux de résolution pour `sourceGraphe` :
 * 1. Défaut : `'auto'` (Graphify si présent, sinon Obsidian)
 * 2. Profil global : `~/.claude/ovrsee/settings.json`
 * 3. Dépôt : `ovrsee.config.json` (plus spécifique prime)
 *
 * Retour enrichi : `{ graph, graphSource, sourceRequested, sourceMissing, sourceDate }`
 *
 * Deux sources possibles, jamais fusionnées : `graphify-out/graph.json`, écrit
 * par Graphify, ou un coffre Obsidian désigné par `obsidianVault` dans
 * `ovrsee.config.json`. Fusionner deux vocabulaires d'identifiants coûterait
 * plus que la fonctionnalité ne rapporte, et l'interface ne saurait plus dire
 * d'où vient une ligne.
 *
 * Un coffre déclaré et ignoré pour cette raison ne doit pas devenir un no-op
 * muet : l'onglet Données le dit, en dérivant l'information de `config`.
 *
 * Le chemin du coffre est absolu, ou relatif à la racine du dépôt observé. Il
 * peut donc sortir du dépôt — c'est tout l'intérêt, un coffre vit rarement
 * dedans. Ce que `readVault` en lit reste borné : les `.md` seuls, leur
 * frontmatter et leurs wikilinks, jamais leur corps.
 *
 * @returns {{graph: object|null, graphSource: 'graphify'|'obsidian'|null, sourceRequested: string, sourceMissing: boolean, sourceDate: string|null}}
 */
function readGraph(root, config) {
  // Résolution à trois niveaux : défaut → profil global → config projet
  const globalSettings = readSettings()
  const merged = mergeSettings(globalSettings, config)
  const sourceChoice = merged?.sourceGraphe ?? 'auto'

  const graphifyPath = join(root, 'graphify-out', 'graph.json')
  const graphifyGraph = readJson(graphifyPath)
  const graphifyDate = graphifyGraph ? fileDate(graphifyPath) : null

  const declare = config?.obsidianVault
  const obsidianPath = typeof declare === 'string' && declare.trim().length > 0 ? vaultPath(root, declare.trim()) : null
  const obsidianGraph = obsidianPath ? readVault(obsidianPath) : null
  const obsidianDate = obsidianGraph ? getVaultDate(obsidianPath) : null

  // Cas 1 : source explicite demandée
  if (sourceChoice === 'graphify') {
    return {
      graph: graphifyGraph,
      graphSource: graphifyGraph ? 'graphify' : null,
      sourceRequested: 'graphify',
      sourceMissing: !graphifyGraph,
      sourceDate: graphifyDate,
    }
  }

  if (sourceChoice === 'obsidian') {
    return {
      graph: obsidianGraph,
      graphSource: obsidianGraph ? 'obsidian' : null,
      sourceRequested: 'obsidian',
      sourceMissing: !obsidianGraph,
      sourceDate: obsidianDate,
    }
  }

  // Cas 2 : 'auto' — Graphify l'emporte, Obsidian en repli
  if (graphifyGraph) {
    return {
      graph: graphifyGraph,
      graphSource: 'graphify',
      sourceRequested: 'auto',
      sourceMissing: false,
      sourceDate: graphifyDate,
    }
  }

  if (obsidianGraph) {
    return {
      graph: obsidianGraph,
      graphSource: 'obsidian',
      sourceRequested: 'auto',
      sourceMissing: false,
      sourceDate: obsidianDate,
    }
  }

  // Cas 3 : rien n'est disponible
  return {
    graph: null,
    graphSource: null,
    sourceRequested: 'auto',
    sourceMissing: false,
    sourceDate: null,
  }
}

/**
 * La date de modification la plus récente d'un coffre Obsidian.
 *
 * Itère sur les fichiers du coffre et retourne le mtime le plus récent,
 * au format ISO.
 */
function getVaultDate(vaultRoot) {
  try {
    if (!existsSync(vaultRoot) || !statSync(vaultRoot).isDirectory()) return null

    let maxMtime = 0
    const parcourir = dir => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const full = join(dir, entry.name)
          if (entry.isDirectory()) {
            parcourir(full)
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const stat = statSync(full)
            maxMtime = Math.max(maxMtime, stat.mtimeMs)
          }
        }
      } catch {
        // Aucun fichier trouvé
      }
    }

    parcourir(vaultRoot)
    return maxMtime > 0 ? new Date(maxMtime).toISOString().split('T')[0] : null
  } catch {
    return null
  }
}

/** Tout ce que l'interface doit lire pour un projet, en une réponse. */
export function snapshot(root) {
  // Ce que la lecture n'a pas su ouvrir, rassemblé au même endroit. C'est la
  // seule chose que l'ovrsee ne peut pas se contenter de taire : un fichier
  // absent et un fichier illisible produisent le même écran vide, et seul le
  // second demande une intervention.
  const illisibles = []
  const plans = readPlans(join(root, 'ovrsee'), illisibles).map(p => ({
    file: p.file,
    ...p.meta,
    body: p.body,
  }))

  // Le pointeur `.active-plan`, lu tel quel : dit lequel des plans ouverts
  // capterait le prochain commit — voir hooks/plans.js et le badge « actif »
  // de l'Aperçu.
  const activePlanPointer = join(root, 'ovrsee', '.active-plan')
  const activePlan = existsSync(activePlanPointer) ? readFileSync(activePlanPointer, 'utf8').trim() : null

  const config = readJson(join(root, 'ovrsee.config.json'))

  const tableauData = tableau(root, illisibles)

  return {
    root,
    ...tableauData,
    // Un fait, pas une déduction : un `ovrsee/` vide et un `ovrsee/` absent
    // se ressemblent une fois les plans lus, et l'interface ne doit pas
    // proposer d'initialiser ce qui l'est déjà.
    equipped: existsSync(join(root, 'ovrsee')),
    plans,
    activePlan: isSafePlanFileName(activePlan) ? activePlan : null,
    packageJson: readJson(join(root, 'package.json')),
    // Le crawler y lit déjà `dev` et `baseUrl`. L'onglet Navigateur s'en sert
    // comme URL par défaut : le projet a déjà déclaré où il s'affiche, le
    // redemander à l'utilisateur serait une deuxième vérité à tenir à jour.
    config,
    // Le seul texte de l'ovrsee qui ne vient pas de `ovrsee/`. Il y a une bonne
    // raison : c'est le seul endroit du dépôt où quelqu'un a déjà écrit ce que
    // le projet fait. Le recopier dans `ovrsee/` en ferait une deuxième
    // version à maintenir, donc une version fausse en trois semaines.
    readme: readText(join(root, 'README.md')),
    pages: readJson(join(root, 'ovrsee', 'pages', 'pages.json')),
    scans: scans(root, illisibles),
    // Les raisons d'être des dépendances, lues dans le code : un commentaire
    // `WHY:` posé au-dessus d'un import. L'onglet Stack les affichait comme
    // s'il les lisait déjà ; il devinait à partir des plans.
    whys: readWhys(root),
    // Graphify, ou le coffre Obsidian déclaré dans la config. `graphSource` dit
    // lequel : l'onglet Données affiche la provenance, et un badge qui ment sur
    // l'origine d'une donnée est exactement ce que ce projet cherche à éviter.
    ...readGraph(root, config),
    shots: shotsByPage(root),
    // Les commits bruts ne sont pas renvoyés en plus : la frise porte déjà
    // sha, date et sujet, et deux copies de la même liste divergeraient.
    timeline: timeline(commits(root), plans),
    ticketTimeline: ticketTimeline(tableauData.tickets, plans),
    // État local, jamais rafraîchi par un fetch réseau ici — voir
    // `gitStatus.lastFetch` pour dater ce que le dépôt sait du distant.
    gitStatus: gitStatus(root),
    // Jamais le jeton : `readIntegrations` le rend chiffré, `tokenCipher` est
    // retiré ici pour que la seule route qui l'expose reste l'IPC Electron.
    integrations: readIntegrations(root).map(({ tokenCipher, ...rest }) => ({
      ...rest,
      hasToken: Boolean(tokenCipher),
    })),
    audits: audits(root, illisibles),
  }
}

/**
 * Chemin absolu d'une capture, ou null.
 *
 * Sécurité : `relative` vient de la barre d'adresse. Il ne doit pas permettre
 * de sortir du dossier des captures — et ce contrôle vaut d'autant plus qu'il
 * servira aussi dans l'application empaquetée.
 */
export function shotPath(root, relative) {
  const base = join(root, 'ovrsee', 'pages')
  const file = normalize(join(base, relative ?? ''))

  if (!inside(base, file) || !existsSync(file)) return null
  return file
}

/**
 * Un chemin est-il sous un dossier ?
 *
 * Le `sep` final n'est pas une coquetterie : `/a/b-secret` commence par `/a/b`,
 * et `join('/a/b', '../b-secret/x.png')` produit exactement ce chemin-là. Sans
 * le séparateur, la garde laisse passer le dossier voisin.
 */
const inside = (base, file) => file.startsWith(base.endsWith(sep) ? base : base + sep)

/**
 * Types servis par `/api/media`, et rien d'autre.
 *
 * L'allowlist d'extensions est la vraie garde de cette route. Sans elle,
 * `mediaPath` servirait `.env`, `id_rsa` ou n'importe quel fichier du dépôt à
 * qui saurait en écrire le chemin dans un README — le contrôle de préfixe
 * n'empêche que d'en sortir.
 */
const MEDIA_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

/**
 * Un média du dépôt — image ou vidéo citée par un README —, ou null.
 *
 * `relative` vient du README, donc d'un fichier qu'on lit sans l'avoir écrit :
 * il est traité comme une entrée hostile, au même titre que la barre d'adresse.
 */
export function mediaPath(root, relative) {
  const base = normalize(root)
  const file = normalize(join(base, relative ?? ''))
  const type = MEDIA_TYPES[extname(file).toLowerCase()]

  if (!type || !inside(base, file) || !existsSync(file)) return null
  return { file, type }
}
