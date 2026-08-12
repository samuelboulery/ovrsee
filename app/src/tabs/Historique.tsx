import { useState, type ReactNode } from 'react'

import {
  commitsDeLaFrise,
  dailyCounts,
  frDate,
  humanAge,
  planEntriesDeLaFrise,
  planFiles,
  planRejected,
  planWhy,
  ticketsDeLaFrise,
  type GitCommit,
  type Illisible,
  type Plan,
  type Scan,
  type Ticket,
  type TicketTimelineEntry,
  type TimelineEntry,
} from '../data'
import { Illisibles } from '../Illisibles'
import { t } from '../i18n'
import { s } from '../style'
import { COULEUR_PRIORITE } from './Tableau'

/** `2026-08-08T12:00:00+02:00` → `2026-08-08`. Les plans, eux, datent déjà du jour. */
const day = (date: string): string => date.slice(0, 10)

/** `2026-08-08T12:00:00+02:00` → `12:00`. Vide pour une date sans heure. */
const hour = (date: string): string => (date.length > 10 ? date.slice(11, 16) : '')

type Vue = 'tickets' | 'commits'

/**
 * Chronologie du projet : deux lectures du même fil, plus un panneau
 * d'activité permanent — maquette 2e. Le panneau n'est plus une troisième
 * vue qui remplace la frise (comme avant) : il vit à côté d'elle, tout le
 * temps.
 *
 * La vue commits vient de git : chaque commit, et les plans qui les
 * expliquent. Elle dit ce qui a été fait. La vue tickets vient du tableau :
 * chaque ticket, sous le plan qu'il cite ou seul s'il n'en cite aucun. Elle
 * dit ce qui a été tracé — depuis que le ticket est devenu l'unité de travail
 * obligatoire, c'est elle qui répond le mieux à « qu'est-ce qui s'est passé
 * ici ? », donc c'est elle qui ouvre par défaut.
 */
export function Historique({
  plans,
  timeline,
  ticketTimeline,
  scans = [],
  illisibles = [],
  onOuvrirTicket,
}: {
  plans: Plan[]
  timeline: TimelineEntry[]
  ticketTimeline: TicketTimelineEntry[]
  scans?: Scan[]
  illisibles?: Illisible[]
  onOuvrirTicket: (file: string) => void
}) {
  const [vue, setVue] = useState<Vue>('tickets')
  const byFile = new Map(plans.map(plan => [plan.file, plan]))
  const isEmpty = vue === 'tickets' ? ticketTimeline.length === 0 : timeline.length === 0

  return (
    <div style={s('flex: 1; display: flex; min-width: 0; min-height: 0;')}>
      <div style={s('flex: 1; min-width: 0; padding: 20px 22px; overflow: auto;')}>
        <div style={s('display: flex; align-items: baseline; gap: 14px; margin-bottom: 4px;')}>
          <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0;')}>
            {t('historique.title')}
          </h2>
          <div style={s('flex: 1;')} />
          <ViewSwitch vue={vue} onChange={setVue} />
        </div>
        <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>
          {t('historique.subtitle')}
        </div>

        <Illisibles entries={illisibles} quoi="plan" />

        {isEmpty ? (
          <div style={s('padding: 40px 0; display: flex; align-items: center; justify-content: center;')}>
            <div style={s('font-size: 12px; color: var(--color-neutral-600); text-align: center; max-width: 46ch; line-height: 1.6;')}>
              {t('apercu.project_timeline_empty')}
            </div>
          </div>
        ) : vue === 'tickets' ? (
          <TicketFrise entries={ticketTimeline} byFile={byFile} onOuvrirTicket={onOuvrirTicket} />
        ) : (
          <CommitFrise entries={timeline} byFile={byFile} />
        )}
      </div>

      <ActivityPanel timeline={timeline} ticketTimeline={ticketTimeline} scans={scans} />
    </div>
  )
}

function ViewSwitch({ vue, onChange }: { vue: Vue; onChange: (vue: Vue) => void }) {
  const option = (id: Vue, label: string) => (
    <button
      type="button"
      className={vue === id ? 'btn btn-primary' : 'btn btn-ghost'}
      style={s('font-size: 11px; padding: 5px 11px;')}
      onClick={() => onChange(id)}
      aria-pressed={vue === id}
    >
      {label}
    </button>
  )

  return (
    <div style={s('display: flex; gap: 4px; flex: none;')}>
      {option('tickets', t('historique.view_tickets'))}
      {option('commits', t('historique.view_commits'))}
    </div>
  )
}

type SousVue = 'empile' | 'densite' | 'type'

/** commit → accent, plan → accent-2, ticket → neutral : la seule autre paire de teintes du système. */
const COULEUR_SERIE = {
  commits: 'var(--color-accent-500)',
  plans: 'var(--color-accent-2-500)',
  tickets: 'var(--color-neutral-400)',
} as const

/**
 * Panneau d'activité — maquette 2e, colonne fixe à droite de la frise.
 *
 * Trois lectures du même fil, en comptage plutôt qu'en liste : ce que la
 * fréquence dit et qu'un défilement de cartes ne montre pas. Trois bascules
 * lui sont propres (Plans/Tickets/Commits hors plan) : elles ne touchent que
 * ce panneau, jamais la frise à sa gauche — la maquette les qualifie de « ses
 * propres filtres ».
 *
 * Les dates viennent des mêmes props que les frises (`timeline`,
 * `ticketTimeline`) — aucune agrégation côté serveur, aucun nouvel appel
 * réseau. `hooks/density.js` reste la seule source du calcul de seaux, comme
 * pour la densité de la barre latérale.
 */
function ActivityPanel({
  timeline,
  ticketTimeline,
  scans,
}: {
  timeline: TimelineEntry[]
  ticketTimeline: TicketTimelineEntry[]
  scans: Scan[]
}) {
  const [sousVue, setSousVue] = useState<SousVue>('empile')
  const [avecPlans, setAvecPlans] = useState(true)
  const [avecTickets, setAvecTickets] = useState(true)
  const [avecCommitsHorsPlan, setAvecCommitsHorsPlan] = useState(true)

  const commitsHorsPlan = timeline.filter(e => e.kind === 'commit').map(e => e.commit)
  const plansBruts = planEntriesDeLaFrise(timeline)
  const ticketsBruts = ticketsDeLaFrise(ticketTimeline).map(ticket => ({ date: ticket.maj }))

  // Seules les vues agrégées (empilée, densité) lisent les trois bascules —
  // la vue par type reste un décompte, filtrer une catégorie n'y aurait pas
  // de sens : autant regarder son nombre.
  const plans = avecPlans ? plansBruts : []
  const tickets = avecTickets ? ticketsBruts : []
  const commits = avecCommitsHorsPlan ? commitsHorsPlan : []

  const total = plansBruts.length + ticketsBruts.length + commitsHorsPlan.length

  return (
    <div
      style={s(
        'width: 300px; flex: none; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); padding: 16px 14px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;',
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <div style={s('font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600); flex: 1;')}>
          {t('historique.view_graph')}
        </div>
        <div style={s('display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: var(--color-surface-control); border: 1px solid var(--color-divider);')}>
          {(
            [
              ['empile', t('historique.window_14d'), t('historique.graph_stacked')],
              ['densite', t('historique.window_12w'), t('historique.graph_density')],
              ['type', t('historique.window_type'), t('historique.graph_by_type')],
            ] as const
          ).map(([id, label, title]) => (
            <button
              key={id}
              type="button"
              title={title}
              onClick={() => setSousVue(id)}
              aria-pressed={sousVue === id}
              style={s(
                `font-size: 10.5px; padding: 2px 7px; border-radius: 4px; border: 0; cursor: pointer; font-family: var(--font-body); ${
                  sousVue === id
                    ? 'background: var(--color-surface); color: var(--color-text);'
                    : 'background: transparent; color: var(--color-neutral-500);'
                }`,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div style={s('font-size: 11.5px; color: var(--color-neutral-600); line-height: 1.6;')}>
          {t('historique.graph_empty')}
        </div>
      ) : sousVue === 'empile' ? (
        <>
          <StackedBars commits={commits} plans={plans} tickets={tickets} days={14} />
          <Legend />
        </>
      ) : sousVue === 'densite' ? (
        <>
          <WeeklyDensityGrid commits={commits} plans={plans} tickets={tickets} weeks={12} />
          <DensityLegend />
        </>
      ) : (
        <ByTypeMeters commits={commitsDeLaFrise(timeline)} plans={plansBruts} tickets={ticketsBruts} scans={scans} days={30} />
      )}

      <div style={s('height: 1px; background: var(--color-divider);')} />

      <div style={s('font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);')}>
        {t('historique.filter_title')}
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
        <FilterToggle checked={avecPlans} onChange={setAvecPlans} label={t('historique.filter_plans')} />
        <FilterToggle checked={avecTickets} onChange={setAvecTickets} label={t('historique.filter_tickets')} />
        <FilterToggle checked={avecCommitsHorsPlan} onChange={setAvecCommitsHorsPlan} label={t('historique.filter_commits_out_of_plan')} />
      </div>
    </div>
  )
}

function FilterToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={s('display: flex; align-items: center; gap: 9px; cursor: pointer;')}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={s(
          `box-sizing: border-box; flex: none; width: 28px; height: 16px; border-radius: 999px; padding: 2px; display: flex; align-items: center; ${
            checked ? 'background: var(--color-accent); justify-content: flex-end;' : 'background: var(--color-neutral-800); justify-content: flex-start;'
          }`,
        )}
      >
        <span style={s('width: 12px; height: 12px; border-radius: 50%; background: var(--color-bg); display: block;')} />
      </span>
      <span style={s(`font-size: 12.5px; color: ${checked ? 'var(--color-text)' : 'var(--color-neutral-500)'};`)}>{label}</span>
    </label>
  )
}

function Legend() {
  return (
    <div style={s('display: flex; gap: 16px; font-size: 10px; color: var(--color-neutral-500); font-family: var(--font-mono);')}>
      {(
        [
          ['plans', t('historique.plan_label')],
          ['tickets', t('historique.ticket_label')],
          ['commits', t('historique.commits_label')],
        ] as const
      ).map(([key, label]) => (
        <div key={key} style={s('display: flex; align-items: center; gap: 5px;')}>
          <span style={s(`width: 7px; height: 7px; border-radius: 2px; background: ${COULEUR_SERIE[key]}; display: block;`)} />
          {label}
        </div>
      ))}
    </div>
  )
}

const NIVEAUX_DENSITE = ['#1c1d24', '#2a2660', '#4b46a3', '#6259cc', '#7d76f0']

function DensityLegend() {
  return (
    <div style={s('display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--color-neutral-500); font-family: var(--font-mono);')}>
      <span>{t('historique.density_less')}</span>
      {NIVEAUX_DENSITE.map(couleur => (
        <span key={couleur} style={s(`width: 9px; height: 9px; border-radius: 2px; background: ${couleur}; display: block;`)} />
      ))}
      <span>{t('historique.density_more')}</span>
    </div>
  )
}

/** Barres empilées, un jour par colonne : ce qui s'est passé chaque jour, et de quelle nature. */
function StackedBars({
  commits,
  plans,
  tickets,
  days,
}: {
  commits: Array<{ date: string }>
  plans: Array<{ date: string }>
  tickets: Array<{ date: string }>
  days: number
}) {
  const c = dailyCounts(commits, days)
  const p = dailyCounts(plans, days)
  const k = dailyCounts(tickets, days)
  const totals = c.map((v, i) => v + p[i] + k[i])
  const max = Math.max(1, ...totals)
  const HEIGHT = 88

  return (
    <div style={s('display: flex; gap: 4px; align-items: flex-end; height: ' + HEIGHT + 'px;')}>
      {totals.map((total, i) => {
        const scale = total === 0 ? 0 : (HEIGHT * (total / max)) / total
        return (
          <div
            key={i}
            title={`${total} · ${p[i]} plan(s), ${k[i]} ticket(s), ${c[i]} commit(s)`}
            style={s('flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 1px;')}
          >
            {c[i] > 0 && <div style={s(`background: ${COULEUR_SERIE.commits}; height: ${Math.max(2, c[i] * scale)}px; border-radius: 1px;`)} />}
            {k[i] > 0 && <div style={s(`background: ${COULEUR_SERIE.tickets}; height: ${Math.max(2, k[i] * scale)}px; border-radius: 1px;`)} />}
            {p[i] > 0 && <div style={s(`background: ${COULEUR_SERIE.plans}; height: ${Math.max(2, p[i] * scale)}px; border-radius: 1px;`)} />}
            {total === 0 && <div style={s('background: var(--color-neutral-800); height: 3px; border-radius: 1px;')} />}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Densité combinée, en grille — maquette 2l (planche B) : douze semaines en
 * colonnes, sept jours en lignes, l'intensité en couleur. La grille CSS
 * remplit ses cellules dans l'ordre du DOM en priorité ligne — on pousse donc
 * les jours d'une même semaine consécutivement, comme `foldWeekly()` les
 * replie déjà, plutôt que d'aligner sur le vrai lundi civil : ni l'un ni
 * l'autre n'est plus « correct », et suivre la même convention que le pliage
 * existant évite d'introduire une deuxième façon de découper une semaine.
 */
function WeeklyDensityGrid({
  commits,
  plans,
  tickets,
  weeks,
}: {
  commits: Array<{ date: string }>
  plans: Array<{ date: string }>
  tickets: Array<{ date: string }>
  weeks: number
}) {
  const days = weeks * 7
  const combined = [...commits, ...plans, ...tickets]
  const daily = dailyCounts(combined, days)
  const max = Math.max(1, ...daily)

  const couleur = (value: number) => {
    if (value === 0) return NIVEAUX_DENSITE[0]
    const ratio = value / max
    if (ratio > 0.75) return NIVEAUX_DENSITE[4]
    if (ratio > 0.5) return NIVEAUX_DENSITE[3]
    if (ratio > 0.25) return NIVEAUX_DENSITE[2]
    return NIVEAUX_DENSITE[1]
  }

  return (
    <div style={s(`display: grid; grid-template-columns: repeat(${weeks}, 1fr); grid-template-rows: repeat(7, 1fr); gap: 3px; height: 92px;`)}>
      {Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: weeks }, (_, col) => {
          const value = daily[col * 7 + row]
          return (
            <div
              key={`${row}-${col}`}
              title={`${value} activité(s)`}
              role="img"
              aria-label={`${value} activité(s)`}
              style={s(`background: ${couleur(value)}; border-radius: 2px;`)}
            />
          )
        }),
      )}
    </div>
  )
}

/**
 * Quatre lectures côte à côte, en barre proportionnelle plutôt qu'en
 * sparkline journalière — maquette 2l (planche C) : ce que chaque nature
 * d'activité pèse sur trente jours, pas son rythme jour par jour (déjà
 * disponible via la vue empilée).
 */
function ByTypeMeters({
  commits,
  plans,
  tickets,
  scans,
  days,
}: {
  commits: Array<{ date: string }>
  plans: Array<{ date: string }>
  tickets: Array<{ date: string }>
  scans: Scan[]
  days: number
}) {
  const since = (entries: Array<{ date: string }>) => dailyCounts(entries, days).reduce((sum, n) => sum + n, 0)

  const series = [
    { key: 'commits', label: t('historique.commits_label'), count: since(commits), couleur: COULEUR_SERIE.commits },
    { key: 'tickets', label: t('historique.tickets_written'), count: since(tickets), couleur: COULEUR_SERIE.tickets },
    { key: 'plans', label: t('historique.plans_captured'), count: since(plans), couleur: COULEUR_SERIE.plans },
    { key: 'scans', label: t('historique.scans_label'), count: since(scans), couleur: 'var(--color-neutral-600)' },
  ] as const

  const max = Math.max(1, ...series.map(item => item.count))

  return (
    <div style={s('display: flex; flex-direction: column; gap: 12px;')}>
      {series.map(item => (
        <div key={item.key} style={s('display: flex; flex-direction: column; gap: 6px;')}>
          <div style={s('display: flex; align-items: baseline; gap: 8px;')}>
            <div style={s('font-size: 12px; color: var(--color-text);')}>{item.label}</div>
            <div style={s('flex: 1;')} />
            <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-500);')}>{item.count}</div>
          </div>
          <div style={s('height: 6px; border-radius: 3px; background: var(--color-surface-control); overflow: hidden;')}>
            <div style={s(`width: ${(item.count / max) * 100}%; height: 100%; background: ${item.couleur};`)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CommitFrise({ entries, byFile }: { entries: TimelineEntry[]; byFile: Map<string, Plan> }) {
  let previous: string | null = null

  return (
    <div style={s('display: flex; flex-direction: column;')}>
      {entries.map((entry, index) => {
        const today = day(entry.date)
        const heading = today !== previous ? today : null
        previous = today

        return (
          <div key={`${entry.kind}-${index}`}>
            {heading !== null && <DayHeading date={heading} />}
            {entry.kind === 'commit' ? (
              <CommitRow commit={entry.commit} />
            ) : (
              <PlanBand entry={entry} plan={byFile.get(entry.plan) ?? null} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TicketFrise({
  entries,
  byFile,
  onOuvrirTicket,
}: {
  entries: TicketTimelineEntry[]
  byFile: Map<string, Plan>
  onOuvrirTicket: (file: string) => void
}) {
  let previous: string | null = null

  return (
    <div style={s('display: flex; flex-direction: column;')}>
      {entries.map((entry, index) => {
        const today = day(entry.date)
        const heading = today !== previous ? today : null
        previous = today

        return (
          <div key={`${entry.kind}-${index}`}>
            {heading !== null && <DayHeading date={heading} />}
            {entry.kind === 'ticket' ? (
              <TicketCard ticket={entry.ticket} onOuvrir={onOuvrirTicket} />
            ) : (
              <PlanBandTickets entry={entry} plan={byFile.get(entry.plan) ?? null} onOuvrirTicket={onOuvrirTicket} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayHeading({ date }: { date: string }) {
  return (
    <div style={s('display: flex; align-items: center; gap: 10px; margin: 18px 0 8px;')}>
      <div style={s('font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--color-neutral-500); flex: none;')}>
        {frDate(date)}
      </div>
      <div style={s('flex: 1; height: 1px; background: var(--color-divider);')} />
    </div>
  )
}

/**
 * Une ligne de commit — même rendu dans une bande de plan et hors bande.
 *
 * Les deux disent la même chose ; les distinguer visuellement laisserait croire
 * qu'un commit sous plan est d'une autre nature.
 */
function CommitRow({ commit }: { commit: GitCommit }) {
  return (
    <div style={s('display: flex; align-items: baseline; gap: 10px; padding: 4px 0;')}>
      <span style={s('width: 5px; height: 5px; border-radius: 50%; background: var(--color-neutral-600); flex: none; align-self: center;')} />
      <span style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-accent); flex: none;')}>
        {commit.sha}
      </span>
      <span style={s('font-size: 12.5px; color: var(--color-neutral-300); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
        {commit.subject}
      </span>
      <span style={s('flex: 1;')} />
      <span style={s('font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
        {hour(commit.date)}
      </span>
    </div>
  )
}

/**
 * Une ligne de ticket — même rendu dans une bande de plan et hors bande.
 *
 * Cliquable : ouvre le panneau Detail du ticket dans l'onglet Tableau.
 */
function TicketCard({ ticket, onOuvrir }: { ticket: Ticket; onOuvrir: (file: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(ticket.file)}
      style={s(
        'display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; background: transparent; border: 0; padding: 5px 0; cursor: pointer; font-family: var(--font-body); color: inherit;',
      )}
    >
      <span
        style={s(`width: 7px; height: 7px; border-radius: 50%; flex: none; background: ${COULEUR_PRIORITE[ticket.priorite] ?? COULEUR_PRIORITE.moyenne};`)}
        title={`${t('tableau.priority_label')} ${ticket.priorite}`}
      />
      <span style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-accent); flex: none;')}>
        {ticket.id}
      </span>
      <span style={s('font-size: 12.5px; color: var(--color-neutral-300); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
        {ticket.titre}
      </span>
      <span style={s('flex: 1;')} />
      {ticket.tags.slice(0, 2).map(tag => (
        <span key={tag} className="tag tag-neutral" style={s('font-size: 10px; flex: none;')}>
          {tag}
        </span>
      ))}
      <span className="tag tag-outline" style={s('font-size: 10px; flex: none;')}>
        {ticket.colonne}
      </span>
      <span style={s('font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
        {humanAge(ticket.maj)}
      </span>
    </button>
  )
}

/**
 * Une bande de plan.
 *
 * Repliée par défaut : la frise doit rester parcourable d'un coup d'œil. Le
 * détail — pourquoi, alternative écartée, fichiers — est à un clic, et c'est
 * exactement ce que cet onglet affichait avant.
 */
function PlanBand({
  entry,
  plan,
}: {
  entry: Extract<TimelineEntry, { kind: 'plan' }>
  plan: Plan | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <PlanBandShell open={open} onToggle={() => setOpen(o => !o)} title={entry.title} status={entry.status}>
      {open && plan !== null && <PlanDetail plan={plan} />}

      {/* Le plan dont le fichier a disparu garde sa bande : la frise vient de
          git, qui, lui, se souvient du commit. */}
      {open && plan === null && (
        <div style={s('margin-top: 9px; font-size: 12px; color: var(--color-neutral-600);')}>
          {t('historique.plan_file_missing')}
        </div>
      )}

      <div style={s('margin-top: 6px;')}>
        {entry.commits.length > 0 ? (
          entry.commits.map(commit => <CommitRow key={commit.sha} commit={commit} />)
        ) : (
          <div style={s('font-size: 11px; color: var(--color-neutral-600); padding: 4px 0;')}>
            {t('historique.no_commits')}
          </div>
        )}
      </div>
    </PlanBandShell>
  )
}

/** Même bande, mais listant les tickets qui citent le plan plutôt que ses commits. */
function PlanBandTickets({
  entry,
  plan,
  onOuvrirTicket,
}: {
  entry: Extract<TicketTimelineEntry, { kind: 'plan' }>
  plan: Plan | null
  onOuvrirTicket: (file: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <PlanBandShell open={open} onToggle={() => setOpen(o => !o)} title={entry.title} status={entry.status}>
      {open && plan !== null && <PlanDetail plan={plan} />}
      {open && plan === null && (
        <div style={s('margin-top: 9px; font-size: 12px; color: var(--color-neutral-600);')}>
          {t('historique.plan_file_missing')}
        </div>
      )}

      <div style={s('margin-top: 6px;')}>
        {entry.tickets.map(ticket => (
          <TicketCard key={ticket.file} ticket={ticket} onOuvrir={onOuvrirTicket} />
        ))}
      </div>
    </PlanBandShell>
  )
}

/** Le pourquoi, l'alternative écartée, les fichiers — commun aux deux bandes. */
function PlanDetail({ plan }: { plan: Plan }) {
  return (
    <div style={s('margin-top: 9px;')}>
      <div style={s('font-size: 12.5px; color: var(--color-neutral-400); line-height: 1.55; max-width: 62ch; text-wrap: pretty;')}>
        {planWhy(plan)}
      </div>
      {planRejected(plan) !== null && (
        <div style={s('display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 9px 11px; border-radius: 6px; background: #14132a; border: 1px solid #2a2660; max-width: 62ch;')}>
          <span style={s('font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #8079c9; flex: none; padding-top: 1px;')}>
            {t('historique.rejected')}
          </span>
          <span style={s('font-size: 12px; color: #a49dfa; line-height: 1.5;')}>
            {planRejected(plan)}
          </span>
        </div>
      )}
      <div style={s('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;')}>
        {planFiles(plan).map(file => (
          <span
            key={file}
            style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-neutral-500); border: 1px solid var(--color-neutral-800); border-radius: 4px; padding: 3px 7px;')}
          >
            {file}
          </span>
        ))}
      </div>
    </div>
  )
}

/** L'habillage commun aux deux bandes : liseré, en-tête pliable, statut. */
function PlanBandShell({
  open,
  onToggle,
  title,
  status,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  status: 'open' | 'closed'
  children: ReactNode
}) {
  return (
    <div
      style={s(
        'border-left: 2px solid var(--color-accent-700); padding: 8px 0 8px 12px; margin: 6px 0 6px 1px; background: linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 60%); border-radius: 0 6px 6px 0;',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        style={s(
          'display: flex; align-items: baseline; gap: 9px; width: 100%; text-align: left; background: transparent; border: 0; padding: 0; cursor: pointer; font-family: var(--font-body); color: inherit;',
        )}
      >
        <span style={s('font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent); flex: none;')}>
          {t('historique.plan_label')}
        </span>
        <span style={s('font-size: 14px; font-weight: 500; color: var(--color-text);')}>{title}</span>
        <span style={s('flex: 1;')} />
        <span className="tag tag-outline" style={s('font-size: 10px; flex: none;')}>
          {status === 'closed' ? t('historique.closed') : t('historique.open')}
        </span>
        <span style={s('font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>{open ? '▾' : '▸'}</span>
      </button>

      {children}
    </div>
  )
}
