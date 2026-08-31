/**
 * Les appels à `/api/*`, et rien d'autre.
 *
 * Les types importés de `./data` le sont en `import type` : la façade `data.ts`
 * re-exporte ce module, et un import de valeur refermerait le cycle.
 */

import type { Colonne, GitStatus, Project, SettingsType, Snapshot, Ticket } from './data'
import type { GraphPayload } from './graph'

const json = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response.json() as Promise<T>
}

/** Une requête abandonnée n'est pas une panne : elle n'a plus de destinataire. */
export const estAbandon = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

export const fetchProjects = () => json<Project[]>('/api/projects')

/** Nom d'utilisateur système — pas un secret, lecture seule. */
export const fetchUsername = () => json<{ username: string | null }>('/api/username')

/**
 * Clore le plan actif, depuis l'UI — même geste que `pnpm ovrsee:close`.
 * Rend les fichiers de plan effectivement clos (vide si aucun n'avait de commit).
 */
export async function closeActivePlans(path: string): Promise<{ closed: string[] }> {
  const response = await fetch('/api/plans/close-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ovrsee': '1' },
    body: JSON.stringify({ path }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`)
  return result
}

export type ProjectAction = 'accent' | 'add' | 'remove' | 'touch' | 'init' | 'export-obsidian'

/**
 * Ajoute, retire, remonte en tête, équipe un projet ou en exporte le coffre.
 * Rend la liste à jour, déjà triée — l'interface n'a pas à refaire le tri du
 * serveur.
 *
 * `payload` porte ce qui est propre à un geste — les skills à installer pour
 * `init`, la teinte pour `accent`. Les autres n'en ont pas besoin, d'où le paramètre optionnel plutôt
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

/**
 * Le graphe d'un projet, et d'où il vient — T-0134.
 *
 * Séparé du snapshot pour la même raison que le `signal` existe ci-dessus : le
 * fichier de Graphify pèse 687 ko, et le lire au changement de projet payait à
 * chaque fois un onglet que la plupart des sessions n'ouvrent pas.
 */
export const fetchGraph = (path: string, signal?: AbortSignal) =>
  json<GraphPayload>(`/api/graph?path=${encodeURIComponent(path)}`, signal)

/**
 * Préférences de l'ovrsee : globales si pas de projet, fusionnées si projet.
 *
 * Les champs `langue`, `densiteActivite` ne se surchargent jamais
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

/** Une colonne d'une table lue en direct, avec sa clé primaire et sa clé étrangère éventuelle. */
export interface SchemaColumn {
  name: string
  type: string
  pk: boolean
  /** `table.colonne` référencée, ou `null` si la colonne ne porte pas de clé étrangère. */
  fk: string | null
}

/** Une table du schéma public, lue en direct — Supabase uniquement en v1. */
export interface SchemaTable {
  name: string
  columns: SchemaColumn[]
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
