/**
 * Lecture, écriture et dérivations des plans de /cockpit/plans/.
 *
 * Module pur : pas d'accès réseau, pas de shell, pas d'état global. C'est le
 * cœur logique dont dépendent les deux hooks et l'interface.
 *
 * ponytail: le frontmatter est du JSON, pas du YAML — JSON.parse est en
 * stdlib et ne se trompe pas, là où un mini-parseur YAML maison échouerait
 * silencieusement sur un titre contenant « : ». Ces fichiers sont écrits par
 * la machine et lus par Claude, jamais édités à la main : la lisibilité
 * humaine du YAML n'achèterait rien. Passer à YAML si un jour ils s'éditent.
 */

import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const FENCE = '---'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {string} src contenu brut d'un fichier de plan
 * @returns {{meta: object, body: string} | null} null si le fichier n'est pas
 *   un plan exploitable — jamais d'exception : un plan corrompu ne doit pas
 *   emporter la lecture des autres.
 */
export function parsePlan(src) {
  if (typeof src !== 'string' || !src.startsWith(FENCE + '\n')) return null

  const end = src.indexOf('\n' + FENCE, FENCE.length)
  if (end === -1) return null

  const front = src.slice(FENCE.length + 1, end)
  // Retire la fin de ligne de la clôture, puis la ligne vide de séparation.
  const body = src.slice(end + 1 + FENCE.length).replace(/^\r?\n(\r?\n)?/, '')

  let meta
  try {
    meta = JSON.parse(front)
  } catch {
    return null
  }
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return null

  return { meta, body }
}

/**
 * @param {object} meta
 * @param {string} body
 * @returns {string}
 */
export function serializePlan(meta, body) {
  return `${FENCE}\n${JSON.stringify(meta, null, 2)}\n${FENCE}\n\n${body}`
}

/**
 * Lit tous les plans d'un dossier cockpit.
 * @param {string} cockpitDir chemin de `<repo>/cockpit`
 * @returns {Array<{file: string, meta: object, body: string}>} du plus récent
 *   au plus ancien. Les fichiers illisibles sont ignorés en silence.
 */
export function readPlans(cockpitDir) {
  const dir = join(cockpitDir, 'plans')

  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  const plans = []
  for (const name of names.sort().reverse()) {
    if (!name.endsWith('.md')) continue
    let raw
    try {
      raw = readFileSync(join(dir, name), 'utf8')
    } catch {
      continue
    }
    const plan = parsePlan(raw)
    if (plan) {
      plans.push({ file: name, ...plan })
    } else {
      // Un plan illisible ne doit pas emporter la lecture des autres, mais il
      // ne doit pas disparaître en silence non plus : c'est précisément le
      // contenu qu'on ne peut pas reconstituer.
      process.stderr.write(`[cockpit] plan illisible, ignoré : ${name}\n`)
    }
  }
  return plans
}

/**
 * Lit un plan, transforme sa meta, le réécrit. Le corps n'est jamais touché.
 *
 * Seul chemin d'écriture d'un plan existant — les trois appelants (capture,
 * post-commit, CLI) passent par ici plutôt que de refaire chacun le cycle.
 *
 * @param {string} cockpitDir
 * @param {string} file nom de fichier, déjà validé par isSafePlanFileName
 * @param {(meta: object) => object | null} update rend la nouvelle meta, ou
 *   null pour renoncer à écrire.
 * @returns {boolean} true si le fichier a été réécrit
 */
export function updatePlanMeta(cockpitDir, file, update) {
  const path = join(cockpitDir, 'plans', file)

  let plan
  try {
    plan = parsePlan(readFileSync(path, 'utf8'))
  } catch {
    return false
  }
  if (!plan) return false

  const meta = update(plan.meta)
  if (!meta) return false

  writeFileNoFollow(path, serializePlan(meta, plan.body))
  return true
}

/** Le backlog n'est pas saisi : c'est l'ensemble des plans jamais clos. */
export function backlog(plans) {
  return plans
    .filter(p => p.meta.status === 'open')
    .sort((a, b) => String(b.meta.opened ?? '').localeCompare(String(a.meta.opened ?? '')))
}

/** L'historique n'est pas saisi : ce sont les plans clos, par date de clôture. */
export function history(plans) {
  return plans
    .filter(p => p.meta.status === 'closed')
    .sort((a, b) => String(b.meta.closed ?? '').localeCompare(String(a.meta.closed ?? '')))
}

/**
 * Densité d'activité : nombre de commits par semaine, du plus ancien seau au
 * plus récent. Alimente la sparkline de la barre latérale.
 *
 * @param {Array} plans
 * @param {{weeks?: number, now?: Date}} [opts]
 * @returns {number[]} tableau de longueur `weeks`
 */
export function density(plans, { weeks = 16, now = new Date() } = {}) {
  const buckets = new Array(weeks).fill(0)
  const end = now.getTime()

  for (const plan of plans) {
    for (const commit of plan.meta.commits ?? []) {
      const at = Date.parse(commit.date)
      if (Number.isNaN(at)) continue
      // Seau 0 = la semaine la plus ancienne, dernier seau = la semaine courante.
      const index = weeks - 1 - Math.floor((end - at) / WEEK_MS)
      if (index >= 0 && index < weeks) buckets[index] += 1
    }
  }
  return buckets
}

const ACCENTS = /[̀-ͯ]/g

/**
 * Réduit un titre libre à un fragment de nom de fichier sûr.
 *
 * Sécurité : c'est la seule barrière entre un titre de plan et un chemin sur
 * disque. Tout ce qui n'est pas [a-z0-9] devient un tiret, ce qui neutralise
 * `/`, `\`, `..` et les séparateurs Windows d'un seul coup.
 */
export function slugify(title) {
  const slug = String(title ?? '')
    .normalize('NFD')
    .replace(ACCENTS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')

  return slug || 'plan'
}

/** Préfixe par la date : le tri alphabétique du dossier est chronologique. */
export function planFileName(title, date = new Date()) {
  return `${date.toISOString().slice(0, 10)}-${slugify(title)}.md`
}

/**
 * Écriture refusant les liens symboliques sur la cible et sur son dossier.
 *
 * Sécurité : git sait versionner un lien symbolique. Un dépôt hostile peut
 * livrer `cockpit/plans -> ~/.ssh`, et le lien est en place dès le `git clone`,
 * avant toute action de l'utilisateur. Une écriture naïve suivrait le lien.
 * On refuse d'écrire, on ne « répare » pas : un lien à cet endroit n'a aucune
 * raison légitime d'exister.
 *
 * L'écriture passe par un fichier temporaire puis un renommage, pour qu'une
 * interruption ne laisse jamais un plan à moitié écrit.
 */
export function writeFileNoFollow(path, content) {
  const dir = dirname(path)

  mkdirSync(dir, { recursive: true })
  if (lstatSync(dir).isSymbolicLink()) {
    throw new Error(`refus d'écrire : ${dir} est un lien symbolique`)
  }
  let target
  try {
    target = lstatSync(path)
  } catch {
    target = null
  }
  if (target?.isSymbolicLink()) {
    throw new Error(`refus d'écrire : ${path} est un lien symbolique`)
  }

  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}

/**
 * Le registre des projets connus, partagé par les hooks et l'interface.
 *
 * Une seule définition du chemin : `snapshot.js` l'importe d'ici plutôt que de
 * le recomposer, sans quoi une lecture et une écriture pourraient viser deux
 * fichiers différents le jour où il bouge.
 *
 * `COCKPIT_REGISTRY` existe pour les tests : ils écrivent réellement dans le
 * registre, et un test qui vide la liste de projets de la machine serait un
 * test qui casse l'outil qu'il vérifie.
 */
export const registryPath = () =>
  process.env.COCKPIT_REGISTRY ?? join(homedir(), '.claude', 'cockpit', 'projects.json')

/** @returns {Array<{path: string, name: string, lastOpened?: string}>} */
export function readRegistry() {
  try {
    const parsed = JSON.parse(readFileSync(registryPath(), 'utf8'))
    // Registre absent, corrompu, ou entrées sans chemin : on garde ce qui est
    // exploitable plutôt que d'abandonner l'opération en cours.
    return Array.isArray(parsed) ? parsed.filter(p => p?.path) : []
  } catch {
    return []
  }
}

const writeRegistry = projects =>
  writeFileNoFollow(registryPath(), JSON.stringify(projects, null, 2) + '\n')

/**
 * Enregistre un projet pour la barre latérale multi-projets.
 *
 * Vit ici pour la même raison que `closeOpenPlans` : le hook automatique et le
 * CLI de secours doivent produire exactement le même état. Un projet capturé à
 * la main qui n'apparaîtrait pas dans la liste serait un cockpit qui ment sur
 * ce qu'il connaît.
 *
 * `lastOpened` porte l'ordre de la barre latérale. Un projet qu'on vient
 * d'ajouter est daté d'aujourd'hui : on vient précisément de s'y intéresser.
 */
export function registerProject(root, now = new Date()) {
  const projects = readRegistry()
  if (projects.some(p => p.path === root)) return false

  writeRegistry([...projects, { path: root, name: basename(root), lastOpened: now.toISOString() }])
  return true
}

/**
 * Retire un projet de la liste. **Aucun fichier du projet n'est touché** — ni
 * le dépôt, ni son dossier `cockpit/`. C'est un oubli, pas une suppression :
 * réenregistrer le même chemin retrouve tout l'historique intact.
 *
 * @returns {boolean} vrai si le projet y était
 */
export function unregisterProject(root) {
  const projects = readRegistry()
  const kept = projects.filter(p => p.path !== root)
  if (kept.length === projects.length) return false

  writeRegistry(kept)
  return true
}

/**
 * Note qu'un projet vient d'être ouvert — c'est ce qui le fait remonter en tête
 * de la barre latérale.
 *
 * Sans effet sur un projet inconnu : ouvrir n'est pas enregistrer, et une
 * ouverture ne doit pas faire entrer dans la liste un chemin que personne n'y a
 * mis.
 *
 * @returns {boolean} vrai si la date a été écrite
 */
export function touchProject(root, now = new Date()) {
  const projects = readRegistry()
  if (!projects.some(p => p.path === root)) return false

  writeRegistry(
    projects.map(p => (p.path === root ? { ...p, lastOpened: now.toISOString() } : p)),
  )
  return true
}

/**
 * Clôt les plans ouverts qui portent au moins un commit.
 *
 * Un plan se ferme à l'ouverture du suivant, pas au premier commit : un plan
 * est une intention, et une intention prend souvent plusieurs commits. Un plan
 * ouvert SANS commit n'est pas clos — c'est du backlog, approuvé puis
 * abandonné.
 *
 * Vit ici, et non dans le hook, parce que le chemin manuel (`/cockpit
 * capture`) doit se comporter exactement comme le chemin automatique. Deux
 * règles de clôture différentes produiraient deux historiques différents selon
 * la façon dont le plan a été capturé.
 *
 * @returns {string[]} fichiers effectivement clos
 */
export function closeOpenPlans(cockpitDir, log = () => {}) {
  const closed = []

  for (const plan of readPlans(cockpitDir)) {
    const commits = plan.meta.commits ?? []
    if (plan.meta.status !== 'open' || commits.length === 0) continue

    const date = commits.at(-1)?.date
    if (!date) {
      // Un plan clos sans date de clôture se trierait n'importe où dans la
      // chronologie. Mieux vaut le laisser ouvert que d'écrire une date fausse.
      log(`${plan.file} : dernier commit sans date, laissé ouvert`)
      continue
    }

    const written = updatePlanMeta(cockpitDir, plan.file, meta => ({
      ...meta,
      status: 'closed',
      closed: date,
    }))
    if (written) closed.push(plan.file)
  }

  return closed
}

/**
 * Un nom de fichier de plan est-il sûr à recoller à un chemin ?
 * Utilisé sur le contenu de `.active-plan`, seule valeur relue depuis le
 * disque et réinjectée dans un chemin.
 */
export function isSafePlanFileName(file) {
  return (
    typeof file === 'string' &&
    file.length > 0 &&
    file.endsWith('.md') &&
    !file.includes('/') &&
    !file.includes('\\') &&
    !file.includes('\0') &&
    file !== '..' &&
    !file.startsWith('.')
  )
}
