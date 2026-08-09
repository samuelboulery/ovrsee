import { useState } from 'react'

import {
  frDate,
  planFiles,
  planRejected,
  planWhy,
  type GitCommit,
  type Illisible,
  type Plan,
  type TimelineEntry,
} from '../data'
import { Illisibles } from '../Illisibles'
import { s } from '../style'

/** `2026-08-08T12:00:00+02:00` → `2026-08-08`. Les plans, eux, datent déjà du jour. */
const day = (date: string): string => date.slice(0, 10)

/** `2026-08-08T12:00:00+02:00` → `12:00`. Vide pour une date sans heure. */
const hour = (date: string): string => (date.length > 10 ? date.slice(11, 16) : '')

/**
 * Chronologie du projet : commits et plans dans le même fil.
 *
 * L'onglet ne montrait que les plans clos. On voyait les intentions sans le
 * travail qui les sépare — et rien du tout des commits faits hors plan. Le fil
 * est maintenant celui de git ; les plans s'y posent comme des bandes qui
 * regroupent leurs commits, et gardent, une fois dépliés, ce que l'historique
 * disait déjà : le pourquoi, l'alternative écartée, les fichiers touchés.
 */
export function Historique({
  plans,
  timeline,
  illisibles = [],
}: {
  plans: Plan[]
  timeline: TimelineEntry[]
  illisibles?: Illisible[]
}) {
  const byFile = new Map(plans.map(plan => [plan.file, plan]))

  if (timeline.length === 0) {
    return (
      <div style={s('flex: 1; padding: 20px 22px; overflow: auto; display: flex; align-items: center; justify-content: center;')}>
        <div style={s('font-size: 12px; color: var(--color-neutral-600); text-align: center; max-width: 46ch; line-height: 1.6;')}>
          Rien à raconter pour l'instant : aucun commit lu et aucun plan écrit. La chronologie
          se remplira au premier des deux.
        </div>
      </div>
    )
  }

  let previous: string | null = null

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
        Chronologie du projet
      </h2>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>
        Chaque commit, dans l'ordre, et les plans qui les expliquent. Un plan est clos par le
        commit qui l'exécute.
      </div>

      <Illisibles entries={illisibles} quoi="plan" />

      <div style={s('display: flex; flex-direction: column;')}>
        {timeline.map((entry, index) => {
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
      <span style={s('font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-accent-300); flex: none;')}>
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
    <div
      style={s(
        'border-left: 2px solid var(--color-accent-700); padding: 8px 0 8px 12px; margin: 6px 0 6px 1px; background: linear-gradient(90deg, var(--color-accent-900) 0%, transparent 60%); border-radius: 0 6px 6px 0;',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={s(
          'display: flex; align-items: baseline; gap: 9px; width: 100%; text-align: left; background: transparent; border: 0; padding: 0; cursor: pointer; font-family: var(--font-body); color: inherit;',
        )}
      >
        <span style={s('font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent-300); flex: none;')}>
          Plan
        </span>
        <span style={s('font-size: 14px; font-weight: 500; color: var(--color-text);')}>
          {entry.title}
        </span>
        <span style={s('flex: 1;')} />
        <span className="tag tag-outline" style={s('font-size: 10px; flex: none;')}>
          {entry.status === 'closed' ? 'clos' : 'ouvert'}
        </span>
        <span style={s('font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && plan !== null && (
        <div style={s('margin-top: 9px;')}>
          <div style={s('font-size: 12.5px; color: var(--color-neutral-400); line-height: 1.55; max-width: 62ch; text-wrap: pretty;')}>
            {planWhy(plan)}
          </div>
          {planRejected(plan) !== null && (
            <div style={s('display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 9px 11px; border-radius: 6px; background: var(--color-accent-900); border: 1px solid var(--color-accent-800); max-width: 62ch;')}>
              <span style={s('font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent-300); flex: none; padding-top: 1px;')}>
                Écarté
              </span>
              <span style={s('font-size: 12px; color: var(--color-accent-200); line-height: 1.5;')}>
                {planRejected(plan)}
              </span>
            </div>
          )}
          <div style={s('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;')}>
            {planFiles(plan).map(file => (
              <span
                key={file}
                style={s('font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--color-neutral-500); border: 1px solid var(--color-neutral-800); border-radius: 4px; padding: 3px 7px;')}
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Le plan dont le fichier a disparu garde sa bande : la frise vient de
          git, qui, lui, se souvient du commit. */}
      {open && plan === null && (
        <div style={s('margin-top: 9px; font-size: 12px; color: var(--color-neutral-600);')}>
          Le fichier de ce plan n'est plus dans cockpit/plans/.
        </div>
      )}

      <div style={s('margin-top: 6px;')}>
        {entry.commits.length > 0 ? (
          entry.commits.map(commit => <CommitRow key={commit.sha} commit={commit} />)
        ) : (
          <div style={s('font-size: 11px; color: var(--color-neutral-600); padding: 4px 0;')}>
            Aucun commit — ce plan n'a pas encore été commencé.
          </div>
        )}
      </div>
    </div>
  )
}
