import {
  humanAge,
  type Priorite,
  type Ticket,
} from '../data'
import { t } from '../i18n'
import { s } from '../style'
import { TYPE_CARTE } from './TableauDnd'

/**
 * La carte d'un ticket dans une colonne du Kanban.
 *
 * Un epic n'en a jamais : il vit dans la vue Epics, et son état se déduit de
 * ses enfants. Ce qui se rend ici est donc toujours un ticket, enfant ou non.
 */

/** Une pastille par priorité — c'est ce qui se lit avant le titre. */
export const COULEUR_PRIORITE: Record<Priorite, string> = {
  haute: 'var(--color-accent-fill)',
  moyenne: 'var(--color-neutral-500)',
  basse: 'var(--color-neutral-700)',
}

export function Carte({
  ticket,
  onOuvrir,
  ouverte,
  allTickets,
}: {
  ticket: Ticket
  onOuvrir: (file: string) => void
  /** Fichier du ticket dont le panneau Detail est ouvert — filet + halo, jamais un filet accent. */
  ouverte: string | null
  allTickets: Ticket[]
}) {
  const selectionnee = ticket.file === ouverte
  const parentEpic = ticket.epic ? allTickets.find(t => t.id === ticket.epic) : null

  return (
    <div
      draggable
      onDragStart={event => event.dataTransfer.setData(TYPE_CARTE, ticket.file)}
      onClick={() => onOuvrir(ticket.file)}
      style={s(
        'border: 1px solid ' +
          (selectionnee ? 'var(--color-border-selected)' : 'var(--color-border-card)') +
          '; border-radius: 8px; padding: 10px 11px; background: ' +
          (selectionnee ? 'var(--color-surface-elevated)' : 'var(--color-surface-card)') +
          '; cursor: pointer;' +
          (selectionnee ? ' box-shadow: var(--ring-selected);' : ''),
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 7px;')}>
        <span
          style={s(`width: 7px; height: 7px; border-radius: 50%; flex: none; background: ${COULEUR_PRIORITE[ticket.priorite] ?? COULEUR_PRIORITE.moyenne};`)}
          title={`${t('tableau.priority_label')} ${ticket.priorite}`}
        />
        {ticket.charge && (
          <span
            style={s('font-size: 9px; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.02em; flex: none;')}
            title={`${t('tableau.charge_label')} ${ticket.charge}`}
          >
            {ticket.charge}
          </span>
        )}
        <div style={s('font-size: 10px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums;')}>
          {ticket.id}
        </div>
        <div style={s('flex: 1;')} />
        <div style={s('font-size: 10px; color: var(--color-neutral-600);')}>{humanAge(ticket.cree)}</div>
      </div>

      <div style={s('font-size: 12.5px; margin-top: 6px; line-height: 1.45; text-wrap: pretty;')}>
        {ticket.titre}
      </div>

      <div style={s('display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px;')}>
        {ticket.tags.map(tag => (
          <span key={tag} className="tag tag-neutral" style={s('font-size: 10px;')}>
            {tag}
          </span>
        ))}
        {ticket.plan && (
          <span className="tag tag-outline" style={s('font-size: 10px;')} title={ticket.plan}>
            plan
          </span>
        )}
        {ticket.epic && (
          <span
            className="tag tag-outline"
            style={s('font-size: 10px;')}
            title={parentEpic ? `${t('tableau.child_of')} ${parentEpic.titre}` : t('tableau.parent_epic_missing')}
          >
            {parentEpic ? `${t('tableau.child_of')} ${ticket.epic}` : t('tableau.orphan_ticket')}
          </span>
        )}
      </div>
    </div>
  )
}
