import type { ReactNode } from 'react'

import { childrenOf, colonneFinale, epicEtat, epicProgress, sortTickets, type Colonne, type Ticket } from '../data'
import { t } from '../i18n'
import { s } from '../style'
import { TagEtat } from './TableauDetail'

/**
 * La vue Epics — les grappes, à côté du Kanban et pas dedans.
 *
 * Un epic n'a plus de colonne : son état se déduit de ses enfants
 * (`epicEtat`). Il n'est donc ni glissable ni déposable, et cette vue
 * n'écrit rien — elle liste, et délègue l'ouverture au panneau `Detail` du
 * tableau, exactement comme une carte du Kanban.
 */

// `color` explicite : un `<button>` nu hérite du noir par défaut du navigateur,
// pas de la couleur de la page — illisible sur le fond sombre.
//
// Pas de `background` ici : un style inline bat toute règle de feuille, y
// compris `:hover`. Le fond au repos vit donc dans `.ligne-clic`
// (`_ds/ovrsee/styles.css`), et seul celui de la ligne ouverte reste inline —
// lui doit bien l'emporter sur le survol.
const LIGNE =
  'display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; cursor: pointer; border: 0; color: var(--color-text); padding: 6px 8px; border-radius: 6px;'

export function TableauEpics({
  tickets,
  board,
  onOuvrir,
  ouverte,
}: {
  tickets: Ticket[]
  board: Colonne[]
  onOuvrir: (file: string) => void
  /** Fichier du ticket dont le panneau Detail est ouvert. */
  ouverte: string | null
}) {
  const epics = sortTickets(tickets.filter(ticket => ticket.type === 'epic'))
  const finale = colonneFinale(board)
  // Un enfant dont le parent a disparu : il reste un ticket du tableau, mais il
  // n'apparaîtrait sous aucun epic. Le taire le rendrait introuvable ici.
  const orphelins = sortTickets(
    tickets.filter(ticket => ticket.epic && !tickets.some(e => e.id === ticket.epic && e.type === 'epic')),
  )

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 0 22px 20px; overflow-y: auto;')}>
      {epics.length === 0 && orphelins.length === 0 && (
        <div style={s('font-size: 12.5px; color: var(--color-text-tertiary);')}>{t('tableau.no_epics')}</div>
      )}

      {epics.map(epic => {
        const enfants = childrenOf(tickets, epic.id)
        const progression = epicProgress(enfants, finale)
        const etat = epicEtat(enfants, board)

        return (
          <div key={epic.file}>
            <Ligne ticket={epic} ouverte={ouverte} onOuvrir={onOuvrir}>
              <div style={s('flex: 1; font-size: 13px; font-weight: 500; text-wrap: pretty;')}>{epic.titre}</div>
              <TagEtat etat={etat} />
            </Ligne>

            {enfants.length === 0 ? (
              <div style={s('margin: 4px 0 0 30px; font-size: 11.5px; color: var(--color-text-tertiary);')}>
                {t('tableau.epic_no_children')}
              </div>
            ) : (
              <>
                <div style={s('display: flex; align-items: center; gap: 8px; margin: 6px 0 4px 30px; font-size: 11px;')}>
                  <div style={s('flex: 1; max-width: 260px; height: 4px; border-radius: 2px; background: var(--color-neutral-800); overflow: hidden;')}>
                    <div style={s(`height: 100%; background: var(--color-accent-400); width: ${progression.percent}%;`)} />
                  </div>
                  <span style={s('color: var(--color-neutral-600); white-space: nowrap; font-variant-numeric: tabular-nums;')}>
                    {progression.done}/{progression.total}
                  </span>
                </div>
                <div style={s('display: flex; flex-direction: column; margin-left: 22px;')}>
                  {enfants.map(enfant => (
                    <Ligne key={enfant.file} ticket={enfant} ouverte={ouverte} onOuvrir={onOuvrir}>
                      <div style={s('flex: 1; font-size: 12.5px; color: var(--color-text-secondary); text-wrap: pretty;')}>
                        {enfant.titre}
                      </div>
                      <span style={s('font-size: 11px; color: var(--color-text-tertiary); white-space: nowrap;')}>
                        {titreColonne(board, enfant.colonne)}
                      </span>
                    </Ligne>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}

      {orphelins.length > 0 && (
        <div>
          <div style={s('font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); margin-bottom: 4px;')}>
            {t('tableau.epic_orphans')}
          </div>
          <div style={s('display: flex; flex-direction: column;')}>
            {orphelins.map(orphelin => (
              <Ligne key={orphelin.file} ticket={orphelin} ouverte={ouverte} onOuvrir={onOuvrir}>
                <div style={s('flex: 1; font-size: 12.5px; color: var(--color-text-secondary); text-wrap: pretty;')}>
                  {orphelin.titre}
                </div>
                <span style={s('font-size: 11px; color: var(--color-text-tertiary); white-space: nowrap;')}>
                  {orphelin.epic}
                </span>
              </Ligne>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Le titre d'une colonne, jamais son `id` : c'est le second que le tableau montre. */
const titreColonne = (board: Colonne[], id: string): string =>
  board.find(colonne => colonne.id === id)?.titre ?? id

function Ligne({
  ticket,
  ouverte,
  onOuvrir,
  children,
}: {
  ticket: Ticket
  ouverte: string | null
  onOuvrir: (file: string) => void
  children: ReactNode
}) {
  const selectionnee = ticket.file === ouverte

  return (
    <button
      type="button"
      className="ligne-clic"
      onClick={() => onOuvrir(ticket.file)}
      style={s(LIGNE + (selectionnee ? ' background: var(--color-surface-elevated);' : ''))}
    >
      <span style={s('font-size: 10px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums; flex: none;')}>
        {ticket.id}
      </span>
      {children}
    </button>
  )
}
