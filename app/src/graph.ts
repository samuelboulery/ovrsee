/**
 * Les deux graphes : la carte de navigation dérivée des pages, et le graphe
 * Graphify lu depuis `graphify-out/graph.json`.
 */

import { liste } from './liste'
import type { Page } from './pages'
import type { PackageJson } from './data'

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
const COL_STEP = 244
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
  /** Déclarée dans `devDependencies`, plutôt que `dependencies`. */
  dev: boolean
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
  const prod = Object.entries(packageJson?.dependencies ?? {}).map(([name, version]) => ({
    name,
    version,
    why: whys[name] ?? null,
    dev: false,
  }))
  const dev = Object.entries(packageJson?.devDependencies ?? {}).map(([name, version]) => ({
    name,
    version,
    why: whys[name] ?? null,
    dev: true,
  }))

  return [...prod, ...dev]
}

/**
 * Ce que rend `/api/graph` — le graphe et sa provenance.
 *
 * Hors du snapshot depuis T-0134 : `graphify-out/graph.json` pèse 687 ko, et
 * l'onglet Données est le seul à le lire. Le charger au changement de projet
 * coûtait une lecture synchrone que personne ne regardait.
 */
export interface GraphPayload {
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
}
