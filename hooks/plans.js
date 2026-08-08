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
import { dirname, join } from 'node:path'

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
