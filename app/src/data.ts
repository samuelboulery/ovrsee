/**
 * Chargement et dérivations pour l'interface.
 *
 * Remplace le `renderVals()` de la maquette : mêmes formes de données, mais
 * lues depuis `ovrsee/` au lieu d'être écrites en dur. Ce qui se calculait
 * dans la maquette se calcule toujours ici — backlog, historique et densité ne
 * sont stockés nulle part.
 */

import { t } from './i18n'

/**
 * La frontière entre ce que le serveur a envoyé et ce que l'interface suppose.
 *
 * Les types disent qu'un instantané a des tableaux ; le disque, lui, ne promet
 * rien — un `pages.json` écrit par un crawl interrompu, un champ ajouté après
 * coup, un fichier édité à la main. Le 9 août 2026, un champ qui n'était pas
 * un tableau a vidé toute l'application.
 *
 * Chaque dérivation passe donc par ici plutôt que de se fier à sa signature.
 * Un tableau vide dit « rien à montrer », ce que chaque onglet sait déjà
 * afficher ; une exception dit « écran noir ».
 */
const liste = <T,>(valeur: T[] | null | undefined): T[] => (Array.isArray(valeur) ? valeur : [])

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
  return raw ? stripMarkdown(raw) : t('msg.no_intention')
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
  /** Taille du viewport au moment de la capture. Absent des scans antérieurs. */
  shotSize?: { width: number; height: number }
}

/**
 * Rapport d'affichage d'une capture, sous la forme attendue par `aspect-ratio`.
 *
 * Une capture affichée au mauvais rapport est soit déformée, soit rognée à
 * l'extrême — et une vignette rognée ne montre qu'une bande du haut de l'écran,
 * identique d'une page à l'autre. Le rapport vient donc de la taille
 * enregistrée à la prise ; 16/10 sert de repli pour les scans plus anciens,
 * qui ne portent pas encore l'information.
 */
export function shotRatio(page: Page): string {
  const { width, height } = page.shotSize ?? {}
  return width && height ? `${width} / ${height}` : '16 / 10'
}

/** Un commit tel que `git log` le rend — sans les fichiers, que porte le plan. */
export interface GitCommit {
  sha: string
  /** ISO complet, heure comprise : deux commits d'un même jour restent ordonnés. */
  date: string
  subject: string
}

/**
 * Une ligne de la frise : soit une bande de plan, soit un commit hors plan.
 *
 * Calculée par `hooks/timeline.js`, jamais dans le rendu — voir le commentaire
 * de ce module pour le pourquoi.
 */
export type TimelineEntry =
  | {
      kind: 'plan'
      date: string
      /** Nom de fichier du plan, clé de recherche dans `snapshot.plans`. */
      plan: string
      title: string
      status: 'open' | 'closed'
      commits: GitCommit[]
    }
  | { kind: 'commit'; date: string; commit: GitCommit }

/**
 * Même frise que `TimelineEntry`, groupée par ticket plutôt que par commit.
 *
 * Calculée par `hooks/timeline.js::ticketTimeline()`. Un plan sans aucun
 * ticket qui le cite n'y figure pas — contrairement à `TimelineEntry`, qui
 * garde les plans jamais commencés parce que git ne les connaît pas encore.
 */
export type TicketTimelineEntry =
  | {
      kind: 'plan'
      date: string
      plan: string
      title: string
      status: 'open' | 'closed'
      tickets: Ticket[]
    }
  | { kind: 'ticket'; date: string; ticket: Ticket }

export interface Scan {
  date: string
  commit: string
  ok: boolean
  pages?: number
  error?: string
}

/** Une revue capturée par `ovrsee-capture-audit.js`, telle qu'écrite dans `ovrsee/audits.jsonl`. */
export interface Audit {
  /** ISO complet. */
  date: string
  /** Nom exact du skill invoqué, ex. `security-review`. */
  skill: string
}

/** Une branche locale, et son avance/retard sur la remote qu'elle suit. */
export interface GitBranch {
  name: string
  /** `origin/main`, ou `null` si la branche ne suit rien. */
  upstream: string | null
  ahead: number
  behind: number
}

/**
 * État git local, lu sans réseau — voir `hooks/git-status.js`. `lastFetch`
 * date ce que le dépôt sait du distant : sans clic sur Rafraîchir, `ahead`
 * et `behind` peuvent être aussi vieux que ce fetch.
 */
export interface GitStatus {
  branch: string | null
  dirty: { staged: number; unstaged: number; untracked: number; files: string[] }
  branches: GitBranch[]
  lastFetch: string | null
}

/**
 * Repli d'un `gitStatus` absent — un snapshot plus vieux que ce champ, ou un
 * instantané de test qui ne le porte pas. Même raison que `liste()` : un champ
 * manquant doit rendre un écran vide, jamais une exception.
 */
export const EMPTY_GIT_STATUS: GitStatus = {
  branch: null,
  dirty: { staged: 0, unstaged: 0, untracked: 0, files: [] },
  branches: [],
  lastFetch: null,
}

export interface Project {
  path: string
  name: string
  /** Dernière ouverture, en ISO. Absent des registres écrits avant le tri par usage. */
  lastOpened?: string
}

export interface PackageJson {
  name?: string
  description?: string
  /** Les commandes du projet : la réponse à « je tape quoi, déjà ? ». */
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export type Priorite = 'haute' | 'moyenne' | 'basse'

/** De la plus urgente à la moins urgente : l'ordre du tableau est l'ordre du tri. */
export const PRIORITES: Priorite[] = ['haute', 'moyenne', 'basse']

export type Charge = 'xs' | 's' | 'm' | 'l' | 'xl'

/** Un ordre de grandeur, pas un engagement — contrairement à `priorite`, pas de valeur par défaut. */
export const CHARGES: Charge[] = ['xs', 's', 'm', 'l', 'xl']

export interface Colonne {
  id: string
  titre: string
  /** Au-delà, la colonne se signale. Absent = pas de limite. */
  wip?: number
}

/**
 * La seule donnée de l'ovrsee qui se saisit.
 *
 * Un fichier par ticket dans `ovrsee/tickets/`, écrit aussi bien par cette
 * interface que par Claude — d'où les noms de champs en français, qui sont
 * ceux du frontmatter sur le disque.
 */
export interface Ticket {
  file: string
  id: string
  titre: string
  colonne: string
  priorite: Priorite
  /** Estimation en taille de t-shirt, absente tant que personne ne l'a évaluée. */
  charge?: Charge
  tags: string[]
  cree: string
  maj: string
  /** Plan lié, s'il existe. Les deux stocks restent indépendants. */
  plan: string | null
  /** Type du ticket : "epic" pour les epics, absent pour les tickets ordinaires. */
  type?: 'epic'
  /** ID du ticket parent si ce ticket est enfant d'un epic. */
  epic?: string
  corps: string
}

/**
 * `ovrsee.config.json` — le contrat du crawl, à la racine du dépôt.
 *
 * Seuls les champs que l'interface lit sont déclarés : le crawler en connaît
 * d'autres, et les recopier ici en ferait une deuxième définition à tenir.
 */
export interface OvrseeConfig {
  /** Commande qui démarre l'application. Affichée, jamais exécutée. */
  dev?: string
  /** Où l'application s'affiche une fois démarrée. */
  baseUrl?: string
  /**
   * Coffre Obsidian tenant lieu de source de graphe, quand Graphify n'a rien
   * produit. Absolu, `~`, ou relatif à la racine du dépôt.
   */
  obsidianVault?: string
  /**
   * Environnements déclarés à la main — rien ne les détecte. `branche`, si
   * renseignée, sert à marquer celui qui correspond à `gitStatus.branch` :
   * une correspondance de nom, pas une preuve de déploiement.
   */
  environments?: Array<{ nom: string; url?: string; branche?: string }>
}

/**
 * Préférences globales de l'ovrsee.
 *
 * Les défauts sont définis dans `hooks/settings.js`, jamais ici — une valeur
 * par défaut en deux endroits divergerait. Ce type décrit uniquement la forme.
 */
export interface Action {
  label: string
  text: string
}

export interface SettingsType {
  langue: string
  theme: string
  densiteActivite: { granularite: string; fenetre: string }
  onglets: { actifs: string[]; ordre: string[] }
  terminal: { visible: boolean; disposition: string; hauteur: number; largeur: number; disabled?: boolean }
  bootstrap: string[]
  packageManager: string
  sourceGraphe: string
  customActions?: Action[]
  /** La présentation de premier lancement a-t-elle été vue — ou passée ? */
  onboardingVu?: boolean
  /** Ce que la présentation a appris de l'usage de Claude Code. */
  claude?: { niveau: string; usage: string }
  /** `ovrsee/pages/shots/` doit-il être gitignoré dans le projet ? */
  gitignoreShots?: boolean
  /** `ovrsee/plans/` et `ovrsee/tickets/` doivent-ils être gitignorés ? */
  gitignorePlans?: boolean
}

export interface Snapshot {
  root: string
  board: Colonne[]
  tickets: Ticket[]
  /** Le dossier `ovrsee/` existe-t-il ? Lu sur le disque, pas déduit. */
  equipped: boolean
  plans: Plan[]
  packageJson: PackageJson | null
  /** `ovrsee.config.json` du dépôt — celui que lit déjà le crawler. */
  config: OvrseeConfig | null
  /** `README.md` du dépôt, tel quel. Absent = le dépôt n'en a pas. */
  readme: string | null
  pages: {
    date: string
    commit: string
    pages: Page[]
    /** route demandée → route réellement affichée. Dit qu'une route est protégée. */
    redirects?: Record<string, string>
    /** dossiers de captures ne correspondant à aucune page du scan courant */
    orphanShots?: string[]
  } | null
  scans: Scan[]
  graph: GraphifyGraph | null
  /**
   * D'où vient `graph` : Graphify, ou un coffre Obsidian déclaré en config.
   *
   * L'onglet Données l'affiche. Les deux sources n'ont ni la même fraîcheur ni
   * la même fiabilité — l'une est analysée, l'autre écrite à la main — et une
   * ligne dont on ignore l'origine ne se vérifie pas.
   */
  graphSource: 'graphify' | 'obsidian' | null
  /**
   * La source de graphe demandée : 'auto', 'graphify', ou 'obsidian'.
   * Permet de distinguer un choix explicite du défaut.
   */
  sourceRequested: string
  /**
   * true si la source demandée n'a pas pu être trouvée.
   * Affiche une alerte distincte selon le type de source.
   */
  sourceMissing: boolean
  /**
   * Date du graphe, au format YYYY-MM-DD, ou null si non daté.
   * Affichée dans le badge de provenance.
   */
  sourceDate: string | null
  /** slug de page → captures successives, de la plus récente à la plus ancienne */
  shots: Record<string, string[]>
  /** Commits et plans mêlés, du plus récent au plus ancien. */
  timeline: TimelineEntry[]
  /** Même frise, groupée par ticket plutôt que par commit. */
  ticketTimeline: TicketTimelineEntry[]
  /**
   * Nom de paquet → commentaire `WHY:` posé au-dessus de son import.
   *
   * La seule source de la colonne « pourquoi » de l'onglet Stack. Absent =
   * personne n'a écrit de raison, ce qui est une information.
   */
  whys?: Record<string, string>
  /**
   * Les fichiers de `ovrsee/` que la lecture n'a pas su ouvrir.
   *
   * Un fichier absent et un fichier illisible produisent le même écran vide, et
   * seul le second demande une intervention. Les taire faisait passer un
   * tableau abîmé pour un tableau vide.
   */
  illisibles?: Illisible[]
  /** État git local — branche, arbre de travail, branches et leur tracking. */
  gitStatus: GitStatus
  /** Revues capturées, de la plus récente à la plus ancienne dans le fichier. */
  audits: Audit[]
  /**
   * Intégrations déploiements/base de données — jamais le jeton, `hasToken`
   * seulement. Ajouter, éditer, supprimer une intégration et vérifier son
   * statut passent par `window.ovrsee.integrations` (IPC Electron), jamais
   * par une route HTTP : voir le corollaire dans `CLAUDE.md`.
   */
  integrations: Integration[]
}

/** Un fichier de `ovrsee/` présent sur le disque mais que l'ovrsee ne sait pas lire. */
export interface Illisible {
  /** Chemin relatif à `ovrsee/`, par exemple `tickets/T-0004-x.md`. */
  file: string
  /** `plan`, `ticket` ou `scan`. */
  quoi: string
  /** Pour un journal en append-only : combien de lignes sont perdues. */
  lignes?: number
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
 * **L'écoulement est vertical** : la profondeur descend, et les pages d'une
 * même profondeur s'étalent horizontalement. La maquette dessinait ses sept
 * nœuds à la main de gauche à droite ; au-delà de huit pages, cette direction
 * sort du cadre et les dernières cartes sont coupées. Un site se lit de haut en
 * bas, une carte de navigation aussi.
 *
 * `CARD_H` est explicite parce que les arêtes s'y ancrent : une hauteur
 * implicite les décalerait dès qu'un titre passe sur deux lignes. Les cartes
 * ont donc une hauteur fixe, et leur contenu est borné.
 */
export const CARD_W = 220
export const CARD_H = 210
export const COL_STEP = 244
export const ROW_STEP = 250

export interface Placed {
  page: Page
  depth: number
  x: number
  y: number
}

/**
 * La disposition ne dépend plus de la place disponible.
 *
 * Une profondeur trop large pour la fenêtre se repliait en sous-rangées. Des
 * pages à un clic de l'accueil se retrouvaient alors sur deux lignes — soit
 * exactement l'image de deux niveaux différents, c'est-à-dire le contraire de
 * ce que la carte existe pour montrer. Une rangée large déborde donc
 * volontairement : c'est le zoom du canevas qui la ramène à l'écran, et
 * dézoomer ne prétend rien sur la structure.
 */
export function layoutGraph(
  pages: Page[],
): { placed: Placed[]; width: number; height: number } {
  pages = liste(pages)
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

  // Une rangée par profondeur : toutes les pages à N clics de l'entrée sont
  // côte à côte, et l'entrée est seule tout en haut.
  const rows = new Map<number, Page[]>()
  for (const page of pages) {
    const d = depth.get(page.route) ?? 0
    rows.set(d, [...(rows.get(d) ?? []), page])
  }

  const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0])
  const widest = Math.max(...ordered.map(([, row]) => row.length))
  const placed: Placed[] = []

  let y = 0
  for (const [d, row] of ordered) {
    // Rangée centrée : le graphe reste lisible quand une profondeur porte une
    // seule page et la suivante en porte six.
    const offset = ((widest - row.length) * COL_STEP) / 2
    row.forEach((page, i) => {
      placed.push({ page, depth: d, x: offset + i * COL_STEP, y })
    })
    y += ROW_STEP
  }

  return {
    placed,
    width: widest * COL_STEP,
    height: y,
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

const json = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response.json() as Promise<T>
}

/** Une requête abandonnée n'est pas une panne : elle n'a plus de destinataire. */
export const estAbandon = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

export const fetchProjects = () => json<Project[]>('/api/projects')

export type ProjectAction = 'add' | 'remove' | 'touch' | 'init' | 'export-obsidian'

/**
 * Ajoute, retire, remonte en tête, équipe un projet ou en exporte le coffre.
 * Rend la liste à jour, déjà triée — l'interface n'a pas à refaire le tri du
 * serveur.
 *
 * `payload` porte ce qui est propre à un geste — les skills à installer pour
 * `init`. Les autres n'en ont pas besoin, d'où le paramètre optionnel plutôt
 * qu'une seconde fonction par action.
 *
 * `X-Ovrsee` n'est pas une authentification : c'est ce qui empêche une page
 * quelconque ouverte dans le navigateur de poster vers le dev server local.
 */
export async function projectAction(
  action: ProjectAction,
  path: string,
  payload: Record<string, unknown> = {},
): Promise<{ projects: Project[]; done?: string[] }> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ ...payload, action, path }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

/**
 * Lance `git fetch` sur le dépôt, et rend l'état git à jour.
 *
 * Séparé de `projectAction` : cette action ne rend pas `projects`, et lui
 * donner la même forme aurait obligé chaque appelant existant à composer
 * avec un champ qui, pour eux, ne manque jamais.
 */
export async function gitFetch(path: string): Promise<{ gitStatus: GitStatus }> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ action: 'git-fetch', path }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

export interface FolderState {
  isGit: boolean
  hasLockfile: boolean
  hasConfig: boolean
  equipped: boolean
  hasPackageJson: boolean
  /** Ce que le serveur propose de mettre dans `ovrsee.config.json`. */
  defaults: { dev: string; baseUrl: string }
}

export async function getFolderState(path: string): Promise<FolderState> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ action: 'state', path }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

/**
 * Un skill Claude Code du catalogue, tel que le serveur le rend.
 *
 * `bundled` : livré avec l'ovrsee, donc installable d'un clic. `externe` :
 * détecté seulement — l'ovrsee n'exécute pas l'installateur de quelqu'un
 * d'autre à la place de l'utilisateur.
 */
export interface SkillEntry {
  nom: string
  source: 'bundled' | 'externe'
  titre: string
  resume: string
  commande?: string
  url?: string
  installe: boolean
  aJour: boolean
}

export const fetchSkills = () => json<SkillEntry[]>('/api/skills')

export async function installSkills(
  noms: string[],
): Promise<{ done: string[]; skills: SkillEntry[] }> {
  const response = await fetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ noms }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

export type TicketAction =
  | 'create'
  | 'move'
  | 'update'
  | 'delete'
  | 'column-add'
  | 'column-rename'
  | 'column-remove'
  | 'column-reorder'

export interface Tableau {
  board: Colonne[]
  tickets: Ticket[]
}

/**
 * Écrit un ticket et rend le tableau à jour.
 *
 * La réponse ne porte que colonnes et tickets : après un glisser-déposer,
 * relire le graphe, les captures et le journal git serait payer tout le projet
 * pour un champ qui change.
 */
export async function ticketAction(
  action: TicketAction,
  path: string,
  payload: Record<string, unknown> = {},
): Promise<Tableau> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ ...payload, action, path }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

/**
 * Relit colonnes et tickets seuls — pour le polling qui garde le tableau à
 * jour quand un ticket est écrit hors de l'app (skill, terminal).
 */
export const fetchTableau = (path: string, signal?: AbortSignal) =>
  json<Tableau>(`/api/tickets?path=${encodeURIComponent(path)}`, signal)

/** Un projet sans dossier `ovrsee/` : rien à lire, donc rien à montrer. */
export const isUnequipped = (snapshot: Snapshot): boolean => !snapshot.equipped

/**
 * L'instantané d'un projet.
 *
 * Le `signal` n'est pas un détail : deux clics rapprochés dans la barre
 * latérale lançaient deux lectures, et la plus lente écrasait la plus récente.
 * L'écran affichait alors les plans du projet A sous le nom du projet B — le
 * genre de faux qui ne se remarque pas.
 */
export const fetchSnapshot = (path: string, signal?: AbortSignal) =>
  json<Snapshot>(`/api/project?path=${encodeURIComponent(path)}`, signal)

export const shotUrl = (root: string, file: string) =>
  `/api/shot?path=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`

/**
 * Une image ou une vidéo du dépôt, citée par un README.
 *
 * Chemin relatif à la racine, pas à `ovrsee/` — c'est toute la différence avec
 * `shotUrl`, et la raison pour laquelle le serveur n'accepte ici qu'une liste
 * blanche d'extensions.
 */
export const mediaUrl = (root: string, file: string) =>
  `/api/media?path=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`

/**
 * Préférences de l'ovrsee : globales si pas de projet, fusionnées si projet.
 *
 * Les champs `langue`, `theme`, `densiteActivite` ne se surchargent jamais
 * par le projet — c'est une préférence personnelle.
 */
export const fetchSettings = (projectPath?: string): Promise<SettingsType> =>
  json<SettingsType>(
    projectPath
      ? `/api/settings?path=${encodeURIComponent(projectPath)}`
      : '/api/settings',
  )

/**
 * Met à jour les préférences globales.
 *
 * Rend les préférences écrites pour la confirmation.
 */
export async function updateSettings(settings: Partial<SettingsType>): Promise<SettingsType> {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify(settings),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

export type IntegrationProvider = 'vercel' | 'netlify' | 'supabase' | 'autre'

/** Jamais de jeton ici — `hasToken` seulement. Voir `hooks/integrations.js`. */
export interface Integration {
  id: string
  provider: IntegrationProvider
  label: string
  url?: string
  hasToken: boolean
}

export type IntegrationState = 'ok' | 'error' | 'building' | 'unknown'

/** Une ligne de la liste des déploiements récents — Vercel/Netlify seulement. */
export interface DeploymentInfo {
  id: string
  state: IntegrationState
  environment: string
  /** Lien direct vers le déploiement, cliquable — `null` s'il n'y en a pas. */
  url: string | null
  branch?: string
  commit?: string
  createdAt: string
}

export interface IntegrationStatus {
  state: IntegrationState
  detail: string
  checkedAt: string
  /** Absent pour Supabase/Autre : ces fournisseurs n'ont qu'un seul « déploiement ». */
  deployments?: DeploymentInfo[]
}

/** Une table du schéma public, lue en direct — Supabase uniquement en v1. */
export interface SchemaTable {
  name: string
  columns: string[]
}

/**
 * Compose une commande d'exécution adaptée au gestionnaire de paquets configuré.
 *
 * Utilisé par B3 pour construire les lignes d'injection dans le terminal.
 * Le gestionnaire doit être fourni explicitement pour éviter les défauts trompeurs.
 *
 * @param {string} script nom du script npm (ex. 'ovrsee:crawl')
 * @param {string} packageManager gestionnaire de paquets ('pnpm', 'npm', 'yarn', 'bun')
 * @returns {string} commande complète (ex. 'pnpm ovrsee:crawl' ou 'npm run ovrsee:crawl')
 */
export function composerCommande(script: string, packageManager: string): string {
  const isNpm = packageManager === 'npm'
  const prefix = isNpm ? 'npm run ' : `${packageManager} `
  return prefix + script
}

// --- dérivations -----------------------------------------------------------

/**
 * Les plans jamais clos.
 *
 * Ce n'est plus le backlog — celui-ci se saisit maintenant, ticket par ticket.
 * C'est l'intention en cours : ce qui a été approuvé et pas encore soldé par un
 * commit. Les deux listes se répondent sans se confondre.
 */
export const plansOuverts = (plans: Plan[]): Plan[] =>
  liste(plans).filter(p => p.status === 'open').sort((a, b) => (b.opened ?? '').localeCompare(a.opened ?? ''))

/**
 * Priorité d'abord, puis du plus récent au plus ancien.
 *
 * Même règle que `hooks/tickets.js` : le tri est refait ici pour réordonner une
 * carte déplacée sans attendre le serveur, jamais pour en décider autrement.
 */
export const sortTickets = (tickets: Ticket[]): Ticket[] =>
  [...liste(tickets)].sort(
    (a, b) =>
      PRIORITES.indexOf(a.priorite) - PRIORITES.indexOf(b.priorite) ||
      (b.cree ?? '').localeCompare(a.cree ?? ''),
  )

/**
 * Les enfants d'un epic, triés par priorité puis date.
 */
export const childrenOf = (tickets: Ticket[], epicId: string): Ticket[] =>
  sortTickets(liste(tickets).filter(t => t.epic === epicId))

/**
 * Progression d'un epic : nombre d'enfants en colonne finale vs. total.
 */
export interface EpicProgress {
  done: number
  total: number
  percent: number
}

export const epicProgress = (children: Ticket[], finalColumn: string | null): EpicProgress => {
  if (children.length === 0) return { done: 0, total: 0, percent: 0 }
  const done = finalColumn ? liste(children).filter(t => t.colonne === finalColumn).length : 0
  return {
    done,
    total: children.length,
    percent: done === 0 ? 0 : Math.round((done / children.length) * 100),
  }
}

/**
 * La colonne qui vaut « terminé », s'il y en a une.
 *
 * Miroir de `colonneFinale` dans `hooks/tickets.js` : la dernière colonne, mais
 * seulement s'il y en a plusieurs. Sur un tableau à une colonne, la traiter
 * comme terminale ferait disparaître tous les tickets du compte.
 */
export const colonneFinale = (board: Colonne[]): string | null =>
  liste(board).length > 1 ? (liste(board).at(-1)?.id ?? null) : null

/**
 * Ce qui reste à faire.
 *
 * Compte les tickets à faire, avec une logique spéciale pour les epics :
 * - Epic AVEC enfants : ne compte pas (ses enfants comptent à sa place)
 * - Epic SANS enfant : compte pour 1
 * - Enfant d'un epic existant : compte (les enfants prennent la place de l'epic)
 * - Enfant orphelin (epic inexistant) : compte comme ticket ordinaire
 * - Ticket ordinaire : compte toujours
 */
export const restant = (tickets: Ticket[], board: Colonne[]): number => {
  const fini = colonneFinale(board)
  const ticketsList = liste(tickets)

  // Déterminer quels epics ont des enfants
  const epicsAvecEnfants = new Set(
    ticketsList
      .filter(t => t.type === 'epic' && ticketsList.some(ch => ch.epic === t.id))
      .map(t => t.id)
  )

  return ticketsList
    .filter(t => {
      if (t.colonne === fini) return false // Rien en colonne finale ne compte
      if (t.type === 'epic' && epicsAvecEnfants.has(t.id)) return false // Epic AVEC enfants ne compte pas
      // Epic vide, enfant, ou ticket ordinaire → compte (les enfants prennent la place de l'epic)
      return true
    })
    .length
}

/** L'historique n'est pas saisi : ce sont les plans clos, par date de clôture. */
export const history = (plans: Plan[]): Plan[] =>
  liste(plans)
    .filter(p => p.status === 'closed')
    .sort((a, b) => (b.closed ?? '').localeCompare(a.closed ?? ''))

/**
 * `density()` vit dans `hooks/density.js`, et nulle part ailleurs.
 *
 * Elle a longtemps existé en double, ici et là-bas, et les deux copies avaient
 * fini par diverger sur la façon de reconnaître leur entrée. Le CLI et le
 * serveur MCP en ont besoin autant que l'interface, et eux ne peuvent pas
 * importer `app/src` — c'est ce qui fixe le sens de la dépendance.
 *
 * Le module est séparé de `plans.js`, qui importe `node:fs` : un module Node
 * dans le bundle du navigateur se fait externaliser par Vite, et l'application
 * tombe à la première lecture au lieu de refuser de compiler.
 */
import { density } from '../../hooks/density'
export { density }

/**
 * Tous les commits de la frise, ceux des plans comme les autres.
 *
 * La densité comptait naguère les seuls commits rattachés à un plan, et un
 * projet avancé par correctifs paraissait dormant. La frise, elle, connaît les
 * deux sortes : `hooks/timeline.js` explique pourquoi les taire donnait « une
 * chronologie à trous ». La densité lit donc la même source qu'elle.
 */
export const commitsDeLaFrise = (timeline: TimelineEntry[]): GitCommit[] =>
  liste(timeline).flatMap(entry =>
    entry.kind === 'plan' ? (entry.commits ?? []) : entry.commit ? [entry.commit] : [],
  )

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
export const lastScan = (scans: Scan[]): Scan | null => liste(scans).at(-1) ?? null

/** Dernier audit capturé, ou `null` si aucun n'a encore été tracé. */
export const lastAudit = (audits: Audit[]): Audit | null =>
  [...liste(audits)].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).at(0) ?? null

/**
 * Une page a-t-elle échoué au dernier scan ?
 * Sa capture est alors plus vieille que le commit, et le dire est le seul
 * comportement honnête.
 */
export const scanFailed = (scans: Scan[]): boolean => lastScan(scans)?.ok === false

/**
 * Retourne l'abréviation du mois traduit.
 */
function getMonth(monthNumber: number): string {
  const monthKeys = [
    'months.jan', 'months.feb', 'months.mar', 'months.apr',
    'months.may', 'months.jun', 'months.jul', 'months.aug',
    'months.sep', 'months.oct', 'months.nov', 'months.dec',
  ] as const
  return t(monthKeys[monthNumber - 1])
}

/** « il y a 3 semaines » — une date brute ne dit pas si l'information a dérivé. */
export function humanAge(date: string | null | undefined, now: Date = new Date()): string {
  if (!date) return t('msg.never')
  const at = Date.parse(date)
  if (Number.isNaN(at)) return String(date)

  const days = Math.floor((now.getTime() - at) / (24 * 60 * 60 * 1000))
  if (days <= 0) return t('msg.today')
  if (days === 1) return t('msg.yesterday')
  if (days < 7) return t('msg.days_ago', { n: days })
  if (days < 31) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? t('msg.week_ago') : t('msg.weeks_ago', { n: weeks })
  }
  const months = Math.floor(days / 30)
  return months === 1 ? t('msg.month_ago') : t('msg.months_ago', { n: months })
}

/** `2026-07-18` → `18 juil. 2026`, comme dans la maquette. */
export function frDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = String(date).split('-').map(Number)
  if (!y || !m || !d) return String(date)
  return `${d} ${getMonth(m)} ${y}`
}

/** `2026-07-18` → `18 juil.` — le pied des cartes du graphe est étroit. */
export function frDateShort(date: string | null | undefined): string {
  if (!date) return '—'
  const [, m, d] = String(date).split('-').map(Number)
  if (!m || !d) return String(date)
  return `${d} ${getMonth(m)}`
}

// --- lecture du graphe Graphify -------------------------------------------

export interface TableRow {
  name: string
  cols: string
  used: string
  conf: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'
  /**
   * Date que l'auteur d'une note du coffre y a écrite, `null` s'il n'en a pas
   * mis. **`undefined` signifie que la ligne ne vient pas d'un coffre** — c'est
   * ce qui distingue une table déclarée d'une table dérivée du code, et donc ce
   * qui décide si l'onglet affiche une confiance ou une date.
   */
  declared?: string | null
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
 * Tables lues depuis Graphify. L'ovrsee ne recalcule rien : il reprend les
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
      // Transporté tel quel : seul un nœud venu d'un coffre le porte.
      ...('declared' in node ? { declared: (node.declared as string | null) ?? null } : {}),
    }
  })
}

export interface StackRow {
  name: string
  version: string
  /** Le commentaire `WHY:` trouvé au-dessus de l'import, ou rien. */
  why: string | null
}

/**
 * Stack : les dépendances déclarées, et pourquoi elles sont là.
 *
 * Graphify cartographie le code, pas les dépendances — la liste vient donc du
 * package.json. La raison vient d'un commentaire `WHY:` posé au-dessus de
 * l'import du paquet, et de rien d'autre : voir `hooks/whys.js`.
 *
 * Elle venait des plans, par recherche de sous-chaîne dans leur corps. Un plan
 * qui citait `node-pty` en passant en devenait la justification affichée —
 * constaté le 9 août 2026, où le plan d'audit s'est retrouvé présenté comme la
 * raison d'être de `node-pty`. Une mention n'est pas une justification, et une
 * fausse raison est pire que pas de raison : c'est ce qui fait cesser de croire
 * au reste de l'écran.
 */
export function stackFrom(
  packageJson: PackageJson | null,
  whys: Record<string, string> = {},
): StackRow[] {
  const all = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) }

  return Object.entries(all).map(([name, version]) => ({
    name,
    version,
    why: whys[name] ?? null,
  }))
}

// --- Configuration Claude Code -----------------------------------------------

/**
 * Un agent Claude Code, tel que le serveur le rend.
 *
 * Le frontmatter du `.md` est parsé côté serveur, les secrets masqués.
 */
export interface Agent {
  name: string
  description?: string | string[]
  tools?: string | string[]
  model?: string
  timeout?: string | number
  [key: string]: unknown
}

/**
 * Une commande Claude Code, telle que le serveur la rend.
 */
export interface Command {
  name: string
  description?: string | string[]
  [key: string]: unknown
}

/**
 * Un plugin Claude Code, depuis `installed_plugins.json`.
 */
export interface Plugin {
  name: string
  status: string
}

/**
 * Configuration complète de Claude Code.
 */
export interface ConfigClaude {
  agents: Agent[]
  commands: Command[]
  plugins: Plugin[]
  hooks: Record<string, { hooks: Array<{ type: string }> }>
  env: Record<string, string>
}

export const fetchConfigClaude = () => json<ConfigClaude>('/api/config-claude')

/**
 * Ce que l'ovrsee sait dire du projet, sans lire une ligne de code.
 *
 * Vit ici et pas dans le panneau terminal : c'est une lecture d'instantané, pas
 * du rendu. Le panneau, lui, importe xterm et sa feuille de style — l'y laisser
 * rendait ces lignes intestables autrement qu'en démarrant un navigateur.
 */
export function briefLines(snapshot: Snapshot | null): Array<{ text: string; style: string }> {
  const dim = 'color: var(--color-neutral-400);'
  if (!snapshot)
    return [{ text: t('brief.reading'), style: 'color: var(--color-neutral-600);' }]

  const open = plansOuverts(snapshot.plans ?? [])
  const closed = (snapshot.plans ?? []).length - open.length
  const pages = snapshot.pages?.pages?.length ?? 0
  const scan = lastScan(snapshot.scans ?? [])

  const lines = [
    { text: '$ claude', style: 'color: var(--color-neutral-500);' },
    {
      text: `◆ ${t('brief.readable_in', { root: snapshot.root })} — ${t(pages > 1 ? 'brief.pages_plural' : 'brief.pages', { n: pages })}, ${t(closed > 1 ? 'brief.closed_plural' : 'brief.closed', { n: closed })}, ${t(open.length > 1 ? 'brief.open_plural' : 'brief.open', { n: open.length })}`,
      style: 'color: var(--color-accent);',
    },
    { text: '', style: '' },
  ]

  if (scan) {
    lines.push({
      text: scan.ok
        ? t('brief.scan_ok', { date: frDate(scan.date), commit: scan.commit })
        : t('brief.scan_failed', {
            date: frDate(scan.date),
            error: scan.error ?? t('brief.no_reason'),
          }),
      style: scan.ok ? dim : 'color: var(--color-accent);',
    })
  } else {
    lines.push({ text: t('brief.no_scan'), style: dim })
  }

  const oldest = open.at(-1)
  if (oldest) {
    lines.push({ text: t('brief.oldest_plan', { title: oldest.title }), style: dim })
  }
  lines.push({ text: '', style: '' })
  return lines
}

/** Les blocs de contexte que les boutons du panneau écrivent dans la session. */
export function buildInjections(snapshot: Snapshot | null): Array<{ label: string; text: string }> {
  if (!snapshot) return []

  const open = plansOuverts(snapshot.plans ?? [])
  const pages = snapshot.pages?.pages ?? []
  const tickets = snapshot.tickets ?? []
  const epicIds = new Set(tickets.filter(t => t.type === 'epic').map(t => t.id))
  const epicCount = epicIds.size

  return [
    {
      label: `Carte des pages (${pages.length})`,
      text: pages
        .map(p => `${p.route} — ${p.title} → ${(p.links ?? []).join(', ') || 'aucun lien'}`)
        .join('\n'),
    },
    {
      label: `${open.length} plan(s) ouvert(s)`,
      text: open.map(p => `- ${p.title} (ouvert le ${frDate(p.opened)})`).join('\n'),
    },
    {
      label: `Tableau (${tickets.length} ticket(s)${epicCount > 0 ? `, dont ${epicCount} epic(s)` : ''})`,
      // Colonne par colonne, dans l'ordre du tableau : c'est ce qui permet à
      // Claude de proposer un déplacement plutôt qu'un ticket de plus.
      // Les epics affichent leur progression ; les enfants affichent leur parent.
      text: (snapshot.board ?? [])
        .map(colonne => {
          const dedans = sortTickets(tickets.filter(t => t.colonne === colonne.id))
          const lignes = dedans.map(t => {
            let ligne = `  ${t.id} [${t.priorite}] ${t.titre}`
            // Si c'est un epic, afficher la progression
            if (t.type === 'epic') {
              const children = childrenOf(tickets, t.id)
              const prog = epicProgress(children, colonneFinale(snapshot.board ?? []))
              ligne += ` [${prog.done}/${prog.total} fait]`
            }
            // Si c'est un enfant, afficher le parent
            if (t.epic && epicIds.has(t.epic)) {
              ligne += ` (enfant de ${t.epic})`
            }
            return ligne
          })
          return [`${colonne.titre} (${dedans.length})`, ...lignes].join('\n')
        })
        .join('\n'),
    },
    {
      label: "Chemin de l'ovrsee",
      text: `Lis ${snapshot.root}/ovrsee/ pour l'état du projet. N'ouvre pas le code.`,
    },
  ]
}

/**
 * Décide si un texte est une commande (! ou /) ou du contexte.
 *
 * Les commandes s'injectent directement avec `\n` final : elles partent illico
 * dans le shell. Les contextes passent par le collage encadré (bracket paste) :
 * littéral, multiligne accepté, sans `\n` final — l'utilisateur relit et valide.
 *
 * @param text texte à injecter
 * @returns objet avec mode ('command' ou 'context') et texte adapté
 */
export function decideInjection(text: string): { mode: 'command' | 'context'; text: string } {
  // Les commandes commencent par ! ou /
  if (text.startsWith('!') || text.startsWith('/')) {
    // Commande : ajouter \n pour exécuter immédiatement
    return { mode: 'command', text: text + '\n' }
  }

  // Contexte : l'encadrement (bracket paste) sera fait par pasteToClaude()
  // On ne met pas de \n final — l'utilisateur valide lui-même
  return { mode: 'context', text }
}

/**
 * Actions livrées + actions personnalisées, avec validation des sauts de ligne.
 *
 * Les actions livrées demandent le gestionnaire : `!pnpm ovrsee:crawl` sur un
 * projet pnpm, `!npm run ovrsee:crawl` sur npm. Les actions perso sont tapées
 * telles quelles et refusent les sauts de ligne : une action multiligne serait
 * une commande shell qui s'exécute ligne par ligne, ce qui n'est pas explicite
 * au clic.
 *
 * Une action perso qui contient `\n` retourne une erreur dans le tableau.
 */
export function buildActions(
  snapshot: Snapshot | null,
  settings: SettingsType,
): Array<Action | { label: string; error: string }> {
  const packageManager = settings.packageManager

  // Actions livrées, composées avec le gestionnaire
  const delivered = [
    {
      label: `⟳ ${t('action.crawl')}`,
      text: `!${composerCommande('ovrsee:crawl', packageManager)}`,
    },
    {
      label: `◆ ${t('action.graph')}`,
      text: '/graphify',
    },
    {
      label: `◈ ${t('action.graph_obsidian')}`,
      text: '/graphify . --obsidian --obsidian-dir ovrsee/obsidian/graphe',
    },
  ]

  // Actions personnalisées, validées
  const custom = (settings.customActions ?? []).map(action => {
    // Rejette les sauts de ligne
    if (action.text.includes('\n')) {
      return {
        label: action.label,
        error: t('actions.newline_refused'),
      }
    }
    return action
  })

  return [...delivered, ...custom]
}
