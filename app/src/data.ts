/**
 * Chargement et dérivations pour l'interface.
 *
 * Remplace le `renderVals()` de la maquette : mêmes formes de données, mais
 * lues depuis `ovrsee/` au lieu d'être écrites en dur. Ce qui se calculait
 * dans la maquette se calcule toujours ici — backlog, historique et densité ne
 * sont stockés nulle part.
 */

import { t } from './i18n'
import { liste } from './liste'
import type { Plan } from './plans'
import type { Page } from './pages'
import type { Integration } from './api'

/**
 * La façade du domaine.
 *
 * `data.ts` garde l'instantané — ses types et les dérivations qu'on en tire —
 * et re-exporte les quatre domaines qui vivent à part depuis T-0206 : les plans,
 * les pages, les graphes et les appels `/api/*`. Quarante et un modules
 * importent d'ici ; la découpe ne valait pas quarante et un imports réécrits.
 *
 * `brief.ts` est l'exception : il lit ces dérivations, et le re-exporter
 * fermerait un cycle. Ses appelants l'importent directement.
 */
export * from './liste'
export * from './plans'
export * from './pages'
export * from './graph'
export * from './api'

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
  densiteActivite: { granularite: string; fenetre: string }
  onglets: { actifs: string[]; ordre: string[] }
  terminal: { visible: boolean; disposition: string; hauteur: number; largeur: number; disabled?: boolean }
  bootstrap: string[]
  packageManager: string
  sourceGraphe: string
  customActions?: Action[]
  /** La présentation de premier lancement a-t-elle été vue — ou passée ? */
  onboardingVu?: boolean
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
  /**
   * Les plans qui capteraient le prochain commit — un par session Claude.
   *
   * Une liste, et non un plan : plusieurs sessions peuvent travailler sur le
   * même dépôt, chacune avec la sienne. Le serveur n'appartient à aucune, il ne
   * peut donc pas en désigner une.
   */
  activePlans: string[]
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




/** Un projet sans dossier `ovrsee/` : rien à lire, donc rien à montrer. */
export const isUnequipped = (snapshot: Snapshot): boolean => !snapshot.equipped





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
 * L'état d'un epic, déduit de ses enfants — jamais de son propre `colonne`.
 *
 * Un epic est un conteneur : lui donner un statut à part de ceux qu'il
 * contient produit la contradiction qu'on a vécue, l'epic posé en « Fait »
 * pendant que trois enfants dorment en Backlog. Dérivé, « terminé tant qu'il
 * reste un enfant » devient impossible à écrire, pas seulement interdit.
 *
 * Sur un tableau à une seule colonne, `colonneFinale` rend `null` : rien n'y
 * est jamais « terminé », et tout y est « non commencé ».
 */
export type EpicEtat = 'vide' | 'non-commencee' | 'en-cours' | 'terminee'

export const epicEtat = (children: Ticket[], board: Colonne[]): EpicEtat => {
  const enfants = liste(children)
  if (enfants.length === 0) return 'vide'

  const finale = colonneFinale(board)
  if (finale && enfants.every(t => t.colonne === finale)) return 'terminee'

  const premiere = liste(board)[0]?.id ?? null
  if (premiere && enfants.every(t => t.colonne === premiere)) return 'non-commencee'

  return 'en-cours'
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
 * Nom affiché du projet — `package.json` s'il en déclare un, sinon le nom du
 * dossier. Même dérivation que celle d'`Apercu.tsx`, extraite ici pour que la
 * barre de vue (`ViewBar`) l'utilise sans dupliquer la logique.
 */
export const projectDisplayName = (snapshot: Pick<Snapshot, 'root' | 'packageJson'>): string =>
  snapshot.packageJson?.name ?? snapshot.root.split('/').filter(Boolean).at(-1) ?? snapshot.root

/**
 * Compte des tickets retenus par `colonneCompte`, avec une logique spéciale
 * pour les epics :
 * - Epic AVEC enfants : ne compte pas (ses enfants comptent à sa place)
 * - Epic SANS enfant : compte pour 1
 * - Enfant d'un epic existant : compte (les enfants prennent la place de l'epic)
 * - Enfant orphelin (epic inexistant) : compte comme ticket ordinaire
 * - Ticket ordinaire : compte s'il est dans une colonne retenue
 */
const compterTickets = (tickets: Ticket[], colonneCompte: (colonne: string) => boolean): number => {
  const ticketsList = liste(tickets)

  // Déterminer quels epics ont des enfants
  const epicsAvecEnfants = new Set(
    ticketsList
      .filter(t => t.type === 'epic' && ticketsList.some(ch => ch.epic === t.id))
      .map(t => t.id)
  )

  return ticketsList
    .filter(t => {
      if (!colonneCompte(t.colonne)) return false
      if (t.type === 'epic' && epicsAvecEnfants.has(t.id)) return false // Epic AVEC enfants ne compte pas
      // Epic vide, enfant, ou ticket ordinaire → compte (les enfants prennent la place de l'epic)
      return true
    })
    .length
}

/** Ce qui reste à faire — tout ticket hors de la colonne finale. */
export const restant = (tickets: Ticket[], board: Colonne[]): number => {
  const fini = colonneFinale(board)
  return compterTickets(tickets, colonne => colonne !== fini)
}

/**
 * Ce qui est actionnable maintenant — les tickets en colonne « Prêt ».
 *
 * Contrairement à `restant()`, ignore le backlog et « à spécifier » : y
 * atterrissent des intentions dont on ne sait pas encore si elles se feront
 * (issue #52). L'id `pret` est celui du tableau par défaut (`DEFAULT_COLUMNS`
 * dans `hooks/board.js`) ; un projet dont le board ne l'a pas repris rend 0,
 * comme `colonneFinale` rend `null` sur un board sans dernière colonne
 * significative.
 */
export const ticketsPrets = (tickets: Ticket[]): number =>
  compterTickets(tickets, colonne => colonne === 'pret')


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
import { density, dailyCounts, foldWeekly } from '../../hooks/density'
export { density, dailyCounts, foldWeekly }

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

/** Une entrée par plan de la frise commits — sa date est celle du commit qui l'a ouvert. */
export const planEntriesDeLaFrise = (timeline: TimelineEntry[]): TimelineEntry[] =>
  liste(timeline).filter(entry => entry.kind === 'plan')

/** Tous les tickets de la frise tickets, ceux des bandes de plan comme les autres — même principe que `commitsDeLaFrise`. */
export const ticketsDeLaFrise = (ticketTimeline: TicketTimelineEntry[]): Ticket[] =>
  liste(ticketTimeline).flatMap(entry =>
    entry.kind === 'plan' ? (entry.tickets ?? []) : entry.ticket ? [entry.ticket] : [],
  )


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


