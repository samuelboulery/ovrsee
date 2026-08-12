import { useState } from 'react'

import {
  commitsDeLaFrise,
  dailyCounts,
  planEntriesDeLaFrise,
  planRejected,
  ticketsDeLaFrise,
  type Plan,
  type Scan,
  type TicketTimelineEntry,
  type TimelineEntry,
} from './data'
import { t } from './i18n'
import { s } from './style'

type SousVue = 'empile' | 'densite' | 'type'

/** Valeurs littérales de l'audit design (§4.4) — pas les rampes de token,
    dont ni le mapping ni les teintes ne correspondaient à la maquette. */
/** Accord singulier/pluriel — règle d'or §5.7, jamais de parenthèse. */
const plur = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

const COULEUR_SERIE = {
  plans: '#7d76f0',
  tickets: '#4b46a3',
  commits: '#2a2b33',
} as const

/**
 * Panneau d'activité — maquette 2e (Historique), panneau droit permanent de
 * 300px. Trois lectures du même fil, en comptage plutôt qu'en liste : ce que
 * la fréquence dit et qu'un défilement de cartes ne montre pas.
 *
 * `plans` est optionnel : n'affiche la section « Plans rejetés » que si
 * l'appelant les fournit.
 */
export function ActivityPanel({
  timeline,
  ticketTimeline,
  scans,
  plans,
}: {
  timeline: TimelineEntry[]
  ticketTimeline: TicketTimelineEntry[]
  scans: Scan[]
  plans?: Plan[]
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
  const plansAffiches = avecPlans ? plansBruts : []
  const ticketsAffiches = avecTickets ? ticketsBruts : []
  const commitsAffiches = avecCommitsHorsPlan ? commitsHorsPlan : []

  const total = plansBruts.length + ticketsBruts.length + commitsHorsPlan.length

  const rejetes = plans?.filter(p => planRejected(p) !== null) ?? []

  return (
    <div
      style={s(
        'width: 300px; flex: none; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); padding: 16px 14px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;',
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <div
          style={s(
            'font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600); flex: 1;',
          )}
        >
          {t('historique.view_graph')}
        </div>
        <div
          style={s(
            'display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: var(--color-surface-control); border: 1px solid var(--color-divider);',
          )}
        >
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
          <StackedBars commits={commitsAffiches} plans={plansAffiches} tickets={ticketsAffiches} days={14} />
          <Legend />
        </>
      ) : sousVue === 'densite' ? (
        <>
          <WeeklyDensityGrid commits={commitsAffiches} plans={plansAffiches} tickets={ticketsAffiches} weeks={12} />
          <DensityLegend />
        </>
      ) : (
        <ByTypeMeters commits={commitsDeLaFrise(timeline)} plans={plansBruts} tickets={ticketsBruts} scans={scans} days={30} />
      )}

      <div style={s('height: 1px; background: var(--color-divider);')} />

      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);',
        )}
      >
        {t('historique.filter_title')}
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
        <FilterToggle checked={avecPlans} onChange={setAvecPlans} label={t('historique.filter_plans')} />
        <FilterToggle checked={avecTickets} onChange={setAvecTickets} label={t('historique.filter_tickets')} />
        <FilterToggle
          checked={avecCommitsHorsPlan}
          onChange={setAvecCommitsHorsPlan}
          label={t('historique.filter_commits_out_of_plan')}
        />
      </div>

      {plans && rejetes.length > 0 && (
        <>
          <div style={s('height: 1px; background: var(--color-divider);')} />
          <div>
            <div
              style={s(
                'font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px;',
              )}
            >
              {t('sidebar.rejected_plans', { n: rejetes.length })}
            </div>
            <div style={s('display: flex; flex-direction: column; gap: 5px;')}>
              {rejetes.map(plan => (
                <div
                  key={plan.file}
                  title={planRejected(plan) ?? ''}
                  style={s(
                    'font-size: 11.5px; color: var(--color-neutral-400); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                  )}
                >
                  {plan.title}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FilterToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label style={s('display: flex; align-items: center; gap: 9px; cursor: pointer;')}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={s(
          `box-sizing: border-box; flex: none; width: 28px; height: 16px; border-radius: 999px; padding: 2px; display: flex; align-items: center; ${
            checked
              ? 'background: var(--color-accent); justify-content: flex-end;'
              : 'background: var(--color-neutral-800); justify-content: flex-start;'
          }`,
        )}
      >
        <span style={s('width: 12px; height: 12px; border-radius: 50%; background: var(--color-bg); display: block;')} />
      </span>
      <span style={s(`font-size: 12.5px; color: ${checked ? 'var(--color-text)' : 'var(--color-neutral-500)'};`)}>
        {label}
      </span>
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
            title={`${total} · ${plur(p[i], 'plan')}, ${plur(k[i], 'ticket')}, ${plur(c[i], 'commit')}`}
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
 * Densité combinée, en grille — douze semaines en colonnes, sept jours en
 * lignes, l'intensité en couleur. La grille CSS remplit ses cellules dans
 * l'ordre du DOM en priorité ligne — on pousse donc les jours d'une même
 * semaine consécutivement, comme `foldWeekly()` les replie déjà, plutôt que
 * d'aligner sur le vrai lundi civil : ni l'un ni l'autre n'est plus
 * « correct », et suivre la même convention que le pliage existant évite
 * d'introduire une deuxième façon de découper une semaine.
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
    <div
      style={s(
        `display: grid; grid-template-columns: repeat(${weeks}, 1fr); grid-template-rows: repeat(7, 1fr); gap: 3px; height: 92px;`,
      )}
    >
      {Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: weeks }, (_, col) => {
          const value = daily[col * 7 + row]
          return (
            <div
              key={`${row}-${col}`}
              title={plur(value, 'activité')}
              role="img"
              aria-label={plur(value, 'activité')}
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
 * sparkline journalière : ce que chaque nature d'activité pèse sur trente
 * jours, pas son rythme jour par jour (déjà disponible via la vue empilée).
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
