import { useState, type ReactNode } from 'react'

import {
  commitsDeLaFrise,
  frDate,
  humanAge,
  planFiles,
  plansOuverts,
  planRejected,
  planWhy,
  type GitCommit,
  type Illisible,
  type Plan,
  type Scan,
  type Ticket,
  type TicketTimelineEntry,
  type TimelineEntry,
} from '../data'
import { ActivityPanel } from '../ActivityPanel'
import { Illisibles } from '../Illisibles'
import { t } from '../i18n'
import { s } from '../style'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'
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
  projet,
  plans,
  activePlan,
  timeline,
  ticketTimeline,
  scans = [],
  illisibles = [],
  onOuvrirTicket,
}: {
  /** Nom affiché du projet, pour le fil d'Ariane de la barre de vue. */
  projet: string
  plans: Plan[]
  /** Fichier du plan actif, ou `null` — pour distinguer le rail d'une bande active. */
  activePlan: string | null
  timeline: TimelineEntry[]
  ticketTimeline: TicketTimelineEntry[]
  scans?: Scan[]
  illisibles?: Illisible[]
  onOuvrirTicket: (file: string) => void
}) {
  const [vue, setVue] = useState<Vue>('tickets')
  const byFile = new Map(plans.map(plan => [plan.file, plan]))
  const isEmpty = vue === 'tickets' ? ticketTimeline.length === 0 : timeline.length === 0
  const commits = commitsDeLaFrise(timeline)
  const dernierCommit = commits.reduce<string | null>(
    (recent, c) => (recent === null || c.date > recent ? c.date : recent),
    null,
  )

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
      <ViewBar
        projet={projet}
        vue={t('historique.title')}
        meta={`${plans.length} plans · ${commits.length} commits`}
      >
        <ViewSwitch vue={vue} onChange={setVue} />
      </ViewBar>
      <div style={s('flex: 1; display: flex; min-width: 0; min-height: 0;')}>
        <div style={s('flex: 1; min-width: 0; padding: 20px 22px; overflow: auto;')}>
          <Illisibles entries={illisibles} quoi="plan" />

          {isEmpty ? (
            <div style={s('padding: 40px 0; display: flex; align-items: center; justify-content: center;')}>
              <div
                style={s(
                  'padding: 48px 20px; max-width: 46ch; text-align: center; border: 1px dashed var(--color-border-control); border-radius: 8px; font-size: 12.5px; color: var(--color-neutral-500); line-height: 1.6;',
                )}
              >
                {t('apercu.project_timeline_empty')}
              </div>
            </div>
          ) : vue === 'tickets' ? (
            <TicketFrise entries={ticketTimeline} byFile={byFile} activePlan={activePlan} onOuvrirTicket={onOuvrirTicket} />
          ) : (
            <CommitFrise entries={timeline} byFile={byFile} activePlan={activePlan} />
          )}
        </div>

        <ActivityPanel timeline={timeline} ticketTimeline={ticketTimeline} scans={scans} />
      </div>

      <StatusBar
        left={[
          t('statusbar.plans_summary', { total: plans.length, open: plansOuverts(plans).length }),
          ...(dernierCommit ? [t('statusbar.last_commit', { age: humanAge(dernierCommit) })] : []),
        ]}
      />
    </div>
  )
}

function ViewSwitch({ vue, onChange }: { vue: Vue; onChange: (vue: Vue) => void }) {
  const option = (id: Vue, label: string) => (
    <label key={id} className="seg-opt">
      <input type="radio" name="historique-vue" checked={vue === id} onChange={() => onChange(id)} />
      {label}
    </label>
  )

  return (
    <div className="seg">
      {option('tickets', t('historique.view_tickets'))}
      {option('commits', t('historique.view_commits'))}
    </div>
  )
}

function CommitFrise({
  entries,
  byFile,
  activePlan,
}: {
  entries: TimelineEntry[]
  byFile: Map<string, Plan>
  activePlan: string | null
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
            {entry.kind === 'commit' ? (
              <CommitRow commit={entry.commit} />
            ) : (
              <PlanBand entry={entry} plan={byFile.get(entry.plan) ?? null} actif={entry.plan === activePlan} />
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
  activePlan,
  onOuvrirTicket,
}: {
  entries: TicketTimelineEntry[]
  byFile: Map<string, Plan>
  activePlan: string | null
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
              <PlanBandTickets
                entry={entry}
                plan={byFile.get(entry.plan) ?? null}
                actif={entry.plan === activePlan}
                onOuvrirTicket={onOuvrirTicket}
              />
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
      <div className="kicker">{frDate(date)}</div>
      <div style={s('flex: 1; height: 1px; background: var(--color-border-chrome);')} />
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
      {/* L'accent n'est pas la couleur des commits (audit §5.2) — var(--color-info),
          la même teinte que les shas ailleurs dans l'app (colonne Revue). */}
      <span style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-info); flex: none;')}>
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
  // Heuristique sur l'id de colonne par défaut (board.json) : la frise n'a
  // pas la liste des colonnes du board pour distinguer « en cours »
  // autrement. Un board reconfiguré retombe simplement sur la variante repos.
  const enCours = ticket.colonne === 'en-cours'

  return (
    <button
      type="button"
      onClick={() => onOuvrir(ticket.file)}
      style={s(
        `display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; cursor: pointer; font-family: var(--font-body); color: inherit; margin: 3px 0; padding: 10px 11px; border-radius: 8px; border: 1px solid ${enCours ? 'var(--color-border-control)' : 'var(--color-border-card)'}; background: ${enCours ? 'var(--color-surface-panel)' : 'var(--color-surface-card)'};`,
      )}
    >
      <span
        style={s(`width: 5px; height: 5px; border-radius: 50%; flex: none; background: ${COULEUR_PRIORITE[ticket.priorite] ?? COULEUR_PRIORITE.moyenne};`)}
        title={`${t('tableau.priority_label')} ${ticket.priorite}`}
      />
      <span style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-quaternary); flex: none;')}>
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
      <span style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
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
  actif,
}: {
  entry: Extract<TimelineEntry, { kind: 'plan' }>
  plan: Plan | null
  actif: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <PlanBandShell
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={entry.title}
      status={entry.status}
      actif={actif}
      closingSha={plan?.commits.at(-1)?.sha ?? null}
      meta={entry.commits.length > 0 ? t('historique.commits_count', { n: entry.commits.length }) : undefined}
    >
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
  actif,
  onOuvrirTicket,
}: {
  entry: Extract<TicketTimelineEntry, { kind: 'plan' }>
  plan: Plan | null
  actif: boolean
  onOuvrirTicket: (file: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <PlanBandShell
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={entry.title}
      status={entry.status}
      actif={actif}
      closingSha={plan?.commits.at(-1)?.sha ?? null}
      meta={entry.tickets.length > 0 ? t('historique.tickets_count', { n: entry.tickets.length }) : undefined}
    >
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
        <div style={s('display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 9px 11px; border-radius: 6px; background: var(--color-plan-bg); border: 1px solid var(--color-plan-border); max-width: 62ch;')}>
          <span style={s('font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent-2); flex: none; padding-top: 1px;')}>
            {t('historique.rejected')}
          </span>
          <span style={s('font-size: 12px; color: var(--color-plan); line-height: 1.5;')}>
            {planRejected(plan)}
          </span>
        </div>
      )}
      <div style={s('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;')}>
        {planFiles(plan).map(file => (
          <span
            key={file}
            style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-neutral-500); border: 1px solid var(--color-border-card); border-radius: 4px; padding: 3px 7px;')}
          >
            {file}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * L'habillage commun aux deux bandes : rail, en-tête pliable, statut.
 *
 * Rail et étiquette distinguent trois états — actif (teinte plan), clos
 * (« clos par {sha} », neutre), ouvert non actif (neutre aussi) — jamais
 * un filet accent générique (audit §5.1 : le filet coloré ne signifie un
 * état qu'à la sélection, pas au statut d'un plan).
 */
function PlanBandShell({
  open,
  onToggle,
  title,
  status,
  actif,
  closingSha,
  meta,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  status: 'open' | 'closed'
  actif: boolean
  closingSha: string | null
  meta?: string
  children: ReactNode
}) {
  return (
    <div
      style={s(
        `border-left: 2px solid ${actif ? 'var(--color-plan-border)' : 'var(--color-surface-segment)'}; padding: 8px 0 8px 14px; margin: 6px 0 6px 1px;`,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        style={s(
          'display: flex; align-items: baseline; gap: 9px; width: 100%; text-align: left; background: transparent; border: 0; padding: 0; cursor: pointer; font-family: var(--font-body); color: inherit;',
        )}
      >
        <span className="kicker" style={s('font-size: 9.5px;')}>{t('historique.plan_label')}</span>
        <span style={s('font-size: 13px; font-weight: 500; color: var(--color-text);')}>{title}</span>
        <span style={s('flex: 1;')} />
        {actif ? (
          <span
            style={s(
              'font-size: 9.5px; padding: 1px 6px; border-radius: 4px; color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border); flex: none;',
            )}
          >
            {t('sante.active_badge')}
          </span>
        ) : status === 'closed' && closingSha ? (
          <span className="tag tag-neutral" style={s('font-size: 10px; flex: none;')}>
            {t('historique.closed_by', { sha: closingSha })}
          </span>
        ) : (
          <span className="tag tag-neutral" style={s('font-size: 10px; flex: none;')}>
            {status === 'closed' ? t('historique.closed') : t('historique.open')}
          </span>
        )}
        {meta && (
          <span style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
            {meta}
          </span>
        )}
        <span style={s('font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>{open ? '▾' : '▸'}</span>
      </button>

      {children}
    </div>
  )
}
