/**
 * Chargement et dérivations pour l'interface.
 *
 * Remplace le `renderVals()` de la maquette : mêmes formes de données, mais
 * lues depuis `cockpit/` au lieu d'être écrites en dur. Ce qui se calculait
 * dans la maquette se calcule toujours ici — backlog, historique et densité ne
 * sont stockés nulle part.
 */

export interface Commit {
  sha: string
  date: string
  files: string[]
}

export interface Plan {
  file: string
  status: 'open' | 'closed'
  title: string
  opened: string
  closed: string | null
  commits: Commit[]
  /** Le plan tel qu'il a été approuvé, en markdown. */
  body: string
}

const section = (body: string, headings: RegExp): string | null => {
  const lines = (body ?? '').split('\n')
  const start = lines.findIndex(line => /^#{1,4}\s/.test(line) && headings.test(line))
  if (start === -1) return null

  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^#{1,4}\s/.test(line))
  const text = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return text || null
}

/**
 * Retire la syntaxe markdown pour un affichage en texte simple.
 *
 * Le corps d'un plan est du markdown écrit pour être lu par Claude ; l'afficher
 * brut fait apparaître les astérisques et les accents graves à l'écran. On
 * retire les marques, jamais les mots : le sens n'est pas touché.
 */
export function stripMarkdown(text: string): string {
  return (text ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const firstParagraph = (text: string): string =>
  text
    .split('\n\n')
    .map(p => p.trim())
    .find(p => p && !p.startsWith('#') && !p.startsWith('|')) ?? ''

/**
 * L'intention derrière un plan : le « pourquoi », pas le « quoi ».
 *
 * Extrait de la section Contexte / Problème / Intention, et réduit à son
 * premier paragraphe — celui qui pose le problème. On ne résume JAMAIS : un
 * résumé généré serait exactement la documentation fausse que ce projet existe
 * pour éviter. On coupe, ce qui est vérifiable ; on ne reformule pas.
 */
export function planWhy(plan: Plan): string {
  const found = section(plan.body, /contexte|probl[eè]me|intention|pourquoi/i)
  const raw = firstParagraph(found ?? plan.body ?? '')
  return raw ? stripMarkdown(raw) : 'Aucune intention écrite dans ce plan.'
}

/**
 * L'alternative explicitement écartée.
 *
 * C'est le critère qui distingue une décision d'une simple trace : une
 * décision ferme une porte. Un plan sans alternative écartée n'en avait pas.
 */
export function planRejected(plan: Plan): string | null {
  const found = section(plan.body, /[ée]cart|alternative|rejet|au lieu de|pourquoi pas/i)
  const raw = found ? firstParagraph(found) || found : null
  return raw ? stripMarkdown(raw) : null
}

/** Fichiers sources touchés par un plan, tous commits confondus. */
export const planFiles = (plan: Plan): string[] => [
  ...new Set(plan.commits.flatMap(commit => commit.files ?? [])),
]

export interface Page {
  route: string
  slug: string
  title: string
  sample: string
  excerpt: string
  links: string[]
  shot: string
  shotDate: string
}

export interface Scan {
  date: string
  commit: string
  ok: boolean
  pages?: number
  error?: string
}

export interface Project {
  path: string
  name: string
}

export interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export interface Snapshot {
  root: string
  plans: Plan[]
  packageJson: PackageJson | null
  pages: {
    date: string
    commit: string
    pages: Page[]
    /** route demandée → route réellement affichée. Dit qu'une route est protégée. */
    redirects?: Record<string, string>
  } | null
  scans: Scan[]
  graph: GraphifyGraph | null
  /** slug de page → captures successives, de la plus récente à la plus ancienne */
  shots: Record<string, string[]>
}

/** `2026-07-18-d2f1a3.png` → `2026-07-18`. */
export const shotDate = (file: string): string => file.slice(0, 10)

/**
 * Nom lisible d'une page.
 *
 * Le titre du document ne sert que s'il distingue la page des autres. Dans une
 * application à page unique, `document.title` est souvent le même partout :
 * l'afficher sur les huit cartes du graphe remplirait l'écran sans rien
 * apprendre. On se rabat alors sur la route, qui, elle, distingue toujours.
 */
export function pageName(page: Page, pages: Page[]): string {
  const title = page.title?.trim()
  const distinctive = title && pages.filter(p => p.title?.trim() === title).length === 1
  if (distinctive) return title

  const segments = page.route.split('/').filter(Boolean)
  if (segments.length === 0) return 'Accueil'

  const last = segments.at(-1) as string
  const label = last.startsWith(':') ? (segments.at(-2) ?? last) : last
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
}

/**
 * Disposition du graphe de navigation, en couches depuis la page d'entrée.
 *
 * La maquette place ses sept nœuds à la main (l. 124-208) ; ici les positions
 * se calculent, avec la même géométrie : colonnes de 175 px, cartes de 150 px,
 * point d'ancrage des arêtes à 66 px du haut de la carte.
 */
export const CARD_W = 150
export const COL_STEP = 175
export const ROW_STEP = 150
export const ANCHOR_Y = 66

export interface Placed {
  page: Page
  depth: number
  x: number
  y: number
}

export function layoutGraph(pages: Page[]): { placed: Placed[]; width: number; height: number } {
  if (pages.length === 0) return { placed: [], width: 0, height: 0 }

  const byRoute = new Map(pages.map(p => [p.route, p]))
  const entry = byRoute.get('/') ?? pages[0]

  // Parcours en largeur : la profondeur d'une page est sa distance à l'entrée.
  const depth = new Map<string, number>([[entry.route, 0]])
  const queue = [entry]
  while (queue.length > 0) {
    const page = queue.shift() as Page
    for (const link of page.links) {
      const next = byRoute.get(link)
      if (!next || depth.has(next.route)) continue
      depth.set(next.route, (depth.get(page.route) ?? 0) + 1)
      queue.push(next)
    }
  }

  // Une page qu'aucun lien n'atteint existe quand même : on la range au bout
  // plutôt que de la faire disparaître de la carte.
  const orphanDepth = Math.max(0, ...depth.values()) + 1
  for (const page of pages) if (!depth.has(page.route)) depth.set(page.route, orphanDepth)

  const columns = new Map<number, Page[]>()
  for (const page of pages) {
    const d = depth.get(page.route) ?? 0
    columns.set(d, [...(columns.get(d) ?? []), page])
  }

  const tallest = Math.max(...[...columns.values()].map(c => c.length))
  const placed: Placed[] = []

  for (const [d, column] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    // Colonne centrée verticalement : le graphe reste lisible quand les
    // colonnes ont des tailles très différentes.
    const offset = ((tallest - column.length) * ROW_STEP) / 2
    column.forEach((page, i) => {
      placed.push({ page, depth: d, x: d * COL_STEP, y: offset + i * ROW_STEP })
    })
  }

  return {
    placed,
    width: columns.size * COL_STEP,
    height: tallest * ROW_STEP,
  }
}

/**
 * Le graphe Graphify n'est pas sous notre contrôle : on le lit défensivement.
 * Structure réelle observée : `links` (pas `edges`), et la confiance
 * EXTRACTED / INFERRED / AMBIGUOUS porte sur le LIEN, pas sur le nœud.
 */
export interface GraphNode {
  id?: string
  label?: string
  file_type?: string
  source_file?: string
  source_location?: string
  community?: number
  [key: string]: unknown
}

export interface GraphLink {
  source?: string
  target?: string
  relation?: string
  confidence?: string
  [key: string]: unknown
}

export interface GraphifyGraph {
  nodes?: GraphNode[]
  links?: GraphLink[]
}

const json = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export const fetchProjects = () => json<Project[]>('/api/projects')

export const fetchSnapshot = (path: string) =>
  json<Snapshot>(`/api/project?path=${encodeURIComponent(path)}`)

export const shotUrl = (root: string, file: string) =>
  `/api/shot?path=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`

// --- dérivations -----------------------------------------------------------

/** Le backlog n'est pas saisi : ce sont les plans jamais clos. */
export const backlog = (plans: Plan[]): Plan[] =>
  plans.filter(p => p.status === 'open').sort((a, b) => (b.opened ?? '').localeCompare(a.opened ?? ''))

/** L'historique n'est pas saisi : ce sont les plans clos, par date de clôture. */
export const history = (plans: Plan[]): Plan[] =>
  plans
    .filter(p => p.status === 'closed')
    .sort((a, b) => (b.closed ?? '').localeCompare(a.closed ?? ''))

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Densité d'activité : commits par semaine, du plus ancien au plus récent. */
export function density(plans: Plan[], weeks = 16, now: Date = new Date()): number[] {
  const buckets = new Array(weeks).fill(0)
  for (const plan of plans) {
    for (const commit of plan.commits ?? []) {
      const at = Date.parse(commit.date)
      if (Number.isNaN(at)) continue
      const index = weeks - 1 - Math.floor((now.getTime() - at) / WEEK_MS)
      if (index >= 0 && index < weeks) buckets[index] += 1
    }
  }
  return buckets
}

/**
 * Plans clos ayant touché les fichiers d'une page.
 *
 * C'est ce qui relie l'historique à la carte : un plan touche des fichiers, et
 * ces fichiers appartiennent à une page. Le rapprochement se fait sur le nom
 * de fichier — une page `/plante/:id` retient les plans touchant un fichier
 * dont le nom évoque « plante ».
 *
 * Approximation assumée : sans analyse du routeur, on ne sait pas relier un
 * fichier à une route de façon certaine. Une page sans plan n'est pas une
 * erreur, c'est l'information qu'elle n'a pas bougé.
 */
export function plansForPage(plans: Plan[], page: Page): Plan[] {
  const words = page.route
    .split('/')
    .filter(segment => segment && !segment.startsWith(':'))
    .map(segment => segment.toLowerCase())

  if (words.length === 0) return [] // la racine ne se rapproche de rien de fiable

  return history(plans).filter(plan =>
    plan.commits.some(commit =>
      commit.files.some(file => words.some(word => file.toLowerCase().includes(word))),
    ),
  )
}

/** Dernier scan connu, réussi ou non. */
export const lastScan = (scans: Scan[]): Scan | null => scans.at(-1) ?? null

/**
 * Une page a-t-elle échoué au dernier scan ?
 * Sa capture est alors plus vieille que le commit, et le dire est le seul
 * comportement honnête.
 */
export const scanFailed = (scans: Scan[]): boolean => lastScan(scans)?.ok === false

/** « il y a 3 semaines » — une date brute ne dit pas si l'information a dérivé. */
export function humanAge(date: string | null | undefined, now: Date = new Date()): string {
  if (!date) return 'jamais'
  const at = Date.parse(date)
  if (Number.isNaN(at)) return String(date)

  const days = Math.floor((now.getTime() - at) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  if (days < 31) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'il y a 1 semaine' : `il y a ${weeks} semaines`
  }
  const months = Math.floor(days / 30)
  return months === 1 ? 'il y a 1 mois' : `il y a ${months} mois`
}

const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

/** `2026-07-18` → `18 juil. 2026`, comme dans la maquette. */
export function frDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = String(date).split('-').map(Number)
  if (!y || !m || !d) return String(date)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** `2026-07-18` → `18 juil.` — le pied des cartes du graphe est étroit. */
export function frDateShort(date: string | null | undefined): string {
  if (!date) return '—'
  const [, m, d] = String(date).split('-').map(Number)
  if (!m || !d) return String(date)
  return `${d} ${MONTHS[m - 1]}`
}

// --- lecture du graphe Graphify -------------------------------------------

export interface TableRow {
  name: string
  cols: string
  used: string
  conf: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'
}

const CONFIDENCES = ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'] as const

const confidenceOf = (value: unknown): TableRow['conf'] => {
  const upper = String(value ?? '').toUpperCase()
  return (CONFIDENCES as readonly string[]).includes(upper)
    ? (upper as TableRow['conf'])
    : 'INFERRED'
}

const isSchemaNode = (node: GraphNode): boolean =>
  /sql|schema|migration/i.test(String(node.source_file ?? '')) ||
  /sql|table|model/i.test(String(node.file_type ?? ''))

/**
 * Tables lues depuis Graphify. Le cockpit ne recalcule rien : il reprend les
 * nœuds de schéma et l'étiquette de confiance des liens qui y mènent.
 *
 * Un projet sans SQL rend une liste vide — ce n'est pas une panne, c'est
 * l'information qu'il n'y a pas de base à cartographier.
 */
export function tablesFrom(graph: GraphifyGraph | null): TableRow[] {
  const nodes = graph?.nodes ?? []
  const links = graph?.links ?? []

  return nodes.filter(isSchemaNode).map(node => {
    const id = String(node.id ?? node.label ?? '')
    const incoming = links.filter(link => link.target === id)
    const users = incoming
      .map(link => nodes.find(n => n.id === link.source)?.label)
      .filter((label): label is string => Boolean(label))

    // La confiance la plus faible parmi les liens gouverne la ligne : une
    // relation ambiguë ne doit pas être masquée par une relation certaine.
    const worst = CONFIDENCES.filter(level =>
      incoming.some(link => confidenceOf(link.confidence) === level),
    ).at(-1)

    return {
      name: String(node.label ?? id),
      cols: String(node.columns ?? '—'),
      used: users.length > 0 ? [...new Set(users)].slice(0, 3).join(' · ') : 'aucune page identifiée',
      conf: worst ?? 'INFERRED',
    }
  })
}

export interface StackRow {
  name: string
  version: string
  why: string
}

/**
 * Stack : les dépendances déclarées, et pourquoi elles sont là.
 *
 * Graphify cartographie le code, pas les dépendances — la liste vient donc du
 * package.json. La raison, elle, vient des plans : le plan clos le plus récent
 * qui mentionne la dépendance est celui qui l'a introduite ou justifiée.
 *
 * Une dépendance sans raison tracée le dit franchement. Inventer une
 * justification plausible serait précisément la documentation fausse que ce
 * projet existe pour éviter.
 */
export function stackFrom(packageJson: PackageJson | null, plans: Plan[]): StackRow[] {
  const all = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) }

  // Tous les plans, pas seulement les clos : un plan encore ouvert qui
  // mentionne une dépendance en est tout autant la raison. Du plus récent au
  // plus ancien, pour que la dernière décision l'emporte.
  const byRecency = [...plans].sort((a, b) =>
    (b.closed ?? b.opened ?? '').localeCompare(a.closed ?? a.opened ?? ''),
  )

  return Object.entries(all).map(([name, version]) => {
    const source = byRecency.find(plan =>
      (plan.body ?? '').toLowerCase().includes(name.toLowerCase()),
    )
    if (!source) {
      return { name, version, why: 'Aucune raison tracée : ni plan, ni commentaire # WHY:.' }
    }
    const when = source.closed
      ? `plan du ${frDate(source.closed)}`
      : `plan ouvert le ${frDate(source.opened)}`
    return { name, version, why: `${source.title} — ${when}.` }
  })
}
