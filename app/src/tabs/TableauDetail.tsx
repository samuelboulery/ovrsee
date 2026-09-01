import { useRef, useState, type ReactNode } from 'react'
import { ArrowsIn, ArrowsOut, Check, PencilSimple, X } from '@phosphor-icons/react'

import {
  CHARGES,
  childrenOf,
  epicEtat,
  humanAge,
  PRIORITES,
  type Charge,
  type Colonne,
  type EpicEtat,
  type GitStatus,
  type Priorite,
  type Ticket,
} from '../data'
import { t, type TranslationKey } from '../i18n'
import { Markdown } from '../markdown'
import { s } from '../style'
import { collerImage, imageDe, insererImage } from '../ticket-image'
import { Divider, useResizable } from '../useResizable'

/**
 * Le panneau de détail d'un ticket — lecture, édition, suppression.
 *
 * Sorti de `Tableau.tsx` parce qu'il sait se rendre dans deux enveloppes : un
 * rail qu'on tire sur le côté, et une modale pour une longue lecture. Le corps
 * ne se dédouble pas ; seul l'emballage change.
 */

/**
 * Le patch envoyé à `updateTicket`.
 *
 * `charge`, `type` et `epic` acceptent `null` pour effacer le champ — un
 * ticket redevient non estimé, non-epic, ou détaché.
 */
export type TicketPatch = Partial<Omit<Ticket, 'charge' | 'type' | 'epic'>> & {
  charge?: Charge | null
  type?: 'epic' | null
  epic?: string | null
}

/**
 * L'état dérivé d'un epic, dit en toutes lettres — et porté par la classe de
 * son état.
 *
 * Une classe et pas une couleur inline : `tag-ok` apporte ensemble le fond, le
 * texte et la bordure. Poser la seule couleur par-dessus `tag-outline` donnait
 * un texte vert dans une bordure violette.
 */
const ETAT_EPIC: Record<EpicEtat, { cle: TranslationKey; classe: string }> = {
  vide: { cle: 'tableau.epic_state_empty', classe: 'tag tag-neutral' },
  'non-commencee': { cle: 'tableau.epic_state_todo', classe: 'tag tag-neutral' },
  'en-cours': { cle: 'tableau.epic_state_doing', classe: 'tag tag-accent' },
  terminee: { cle: 'tableau.epic_state_done', classe: 'tag tag-ok' },
}

export function TagEtat({
  etat,
  // Le défaut de `.tag` (10.5px, padding 1px 6px) est calibré pour une étiquette
  // posée dans une carte ; une pastille d'état seule au bout d'une ligne d'epic
  // se lit mal à cette échelle.
  style = 'font-size: 11.5px; padding: 3px 9px;',
}: {
  etat: EpicEtat
  style?: string
}) {
  return (
    <span className={ETAT_EPIC[etat].classe} style={s(style)}>
      {t(ETAT_EPIC[etat].cle)}
    </span>
  )
}

const EN_TETE =
  'display: flex; align-items: center; gap: 8px; margin: 0 calc(-1 * var(--detail-pad)); padding: var(--detail-pad) var(--detail-pad) 12px; position: sticky; top: 0; background: var(--color-surface-panel); z-index: 1;'

/** Un bouton d'en-tête : l'icône seule, la même boîte pour les trois. */
const ICONE = 'font-size: 12px; display: inline-flex; align-items: center; padding: 5px 8px;'

const PANNEAU =
  '--detail-pad: 18px; border-left: 1px solid var(--color-border-card); padding: 0 18px 20px; overflow-y: auto; background: var(--color-surface-panel);'

export function Detail({
  ticket,
  colonnes,
  allTickets,
  root,
  gitStatus,
  onFermer,
  onModifier,
  onDeplacer,
  onSupprimer,
}: {
  ticket: Ticket
  colonnes: Colonne[]
  allTickets: Ticket[]
  root: string
  gitStatus?: GitStatus
  onFermer: () => void
  onModifier: (patch: TicketPatch) => void
  onDeplacer: (colonne: string) => void
  onSupprimer: () => void
}) {
  const [titre, setTitre] = useState(ticket.titre)
  const [tags, setTags] = useState(ticket.tags.join(', '))
  const [corps, setCorps] = useState(ticket.corps)
  const [confirme, setConfirme] = useState(false)
  // Un ticket s'ouvre pour être lu, pas pour être aussitôt modifié — le
  // formulaire d'édition n'apparaît que sur demande explicite. Le panneau est
  // remonté à chaque changement de ticket (`key={selection.file}` chez
  // l'appelant), donc ouvrir un autre ticket revient toujours en lecture.
  const [edition, setEdition] = useState(false)
  /** Lecture en grand : la même chose, dans une modale au lieu du rail. */
  const [agrandi, setAgrandi] = useState(false)
  /** L'échec d'un collage d'image — trop lourde, illisible, disque plein. */
  const [erreurImage, setErreurImage] = useState<string | null>(null)
  const zoneCorps = useRef<HTMLTextAreaElement>(null)

  /**
   * Colle une image dans le corps (T-0219).
   *
   * Le corps est sauvé dans la foulée plutôt qu'au `blur` : l'image est déjà
   * sur le disque, et un `![](…)` que l'utilisateur perdrait en fermant le
   * panneau laisserait un fichier orphelin sans rien à l'écran.
   */
  const collerDansLeCorps = async (donnees: DataTransfer | null) => {
    // Synchrone : un `DataTransfer` n'est lisible que pendant son événement.
    const fichier = imageDe(donnees)
    if (!fichier) return

    setErreurImage(null)
    try {
      const chemin = await collerImage(root, ticket.id, fichier)

      // Le champ fait foi, pas la fermeture : entre le collage et la fin de
      // l'envoi, l'utilisateur a pu continuer à taper. Repartir de `corps`
      // écraserait sa frappe, et sa position de curseur avec.
      const champ = zoneCorps.current
      const base = champ?.value ?? corps
      const { texte, curseur } = insererImage(
        base,
        chemin,
        champ?.selectionStart ?? base.length,
        champ?.selectionEnd ?? base.length,
      )

      setCorps(texte)
      onModifier({ corps: texte })
      // Après le rendu de React, sans quoi la position serait écrasée.
      requestAnimationFrame(() => champ?.setSelectionRange(curseur, curseur))
    } catch (error) {
      setErreurImage(error instanceof Error ? error.message : String(error))
    }
  }

  const colonne = colonnes.find(c => c.id === ticket.colonne)
  const parentEpic = ticket.epic ? allTickets.find(t => t.id === ticket.epic) : null
  const nonCommite = gitStatus?.dirty.files?.includes(`ovrsee/tickets/${ticket.file}`) ?? false

  return (
    <Enveloppe agrandi={agrandi} ticket={ticket} onReduire={() => setAgrandi(false)}>
      {/* Collant, donc opaque : sans fond, le corps défilerait dessous en
          transparence. Le fond juste est celui du conteneur, et les marges
          négatives lui font traverser le rembourrage au lieu de s'y asseoir —
          sans quoi l'en-tête se lit comme une bande plus sombre et plus
          étroite. `--detail-pad` est posé par l'enveloppe, qui seule connaît
          son rembourrage. */}
      <div style={s(EN_TETE)}>
        <div style={s('font-size: 11px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums;')}>
          {ticket.id}
        </div>
        <div style={s('flex: 1;')} />
        {/* Un bloc sans `gap` : le `gap` de l'en-tête ne sert qu'à détacher
            l'identifiant, les trois icônes se touchent. */}
        <div style={s('display: flex; align-items: center;')}>
        <button
          type="button"
          className={edition ? 'btn btn-primary' : 'btn btn-ghost'}
          style={s(ICONE)}
          title={t(edition ? 'tableau.finish_editing' : 'a11y.edit')}
          aria-label={t(edition ? 'tableau.finish_editing' : 'a11y.edit')}
          aria-pressed={edition}
          onClick={() => setEdition(!edition)}
        >
          {edition ? (
            <Check size={13} weight="bold" aria-hidden="true" />
          ) : (
            <PencilSimple size={13} weight="regular" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={s(ICONE)}
          title={t(agrandi ? 'tableau.collapse' : 'tableau.expand')}
          aria-label={t(agrandi ? 'tableau.collapse' : 'tableau.expand')}
          onClick={() => setAgrandi(!agrandi)}
        >
          {agrandi ? (
            <ArrowsIn size={13} weight="regular" aria-hidden="true" />
          ) : (
            <ArrowsOut size={13} weight="regular" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={s(ICONE)}
          title={t('tableau.close')}
          aria-label={t('tableau.close')}
          onClick={onFermer}
        >
          <X size={13} weight="regular" aria-hidden="true" />
        </button>
        </div>
      </div>

      {edition ? (
        <>
          <input
            className="input"
            value={titre}
            onChange={event => setTitre(event.target.value)}
            onBlur={() => titre.trim() && titre !== ticket.titre && onModifier({ titre })}
            style={s('font-size: 13px; width: 100%;')}
          />

          <div style={s('display: flex; gap: 8px; margin-top: 10px;')}>
            {/* Un epic n'a pas de colonne à choisir : son état se déduit de ses
                enfants. Laisser le sélecteur donnerait un champ qui s'écrit
                sans que rien ne l'affiche. */}
            {ticket.type === 'epic' ? (
              <TagEtat
                etat={epicEtat(childrenOf(allTickets, ticket.id), colonnes)}
                style="font-size: 11px; flex: 1; display: inline-flex; align-items: center; justify-content: center;"
              />
            ) : (
              <select
                className="input"
                value={ticket.colonne}
                onChange={event => onDeplacer(event.target.value)}
                style={s('font-size: 12px; flex: 1;')}
              >
                {colonnes.map(colonne => (
                  <option key={colonne.id} value={colonne.id}>
                    {colonne.titre}
                  </option>
                ))}
              </select>
            )}
            <select
              className="input"
              value={ticket.priorite}
              onChange={event => onModifier({ priorite: event.target.value as Priorite })}
              style={s('font-size: 12px; flex: 1;')}
            >
              {PRIORITES.map(priorite => (
                <option key={priorite} value={priorite}>
                  {priorite}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={ticket.charge ?? ''}
              onChange={event => onModifier({ charge: (event.target.value || null) as Charge | null })}
              style={s('font-size: 12px; flex: 1;')}
            >
              <option value="">{t('tableau.charge_none')}</option>
              {CHARGES.map(charge => (
                <option key={charge} value={charge}>
                  {charge}
                </option>
              ))}
            </select>
          </div>

          <div style={s('display: flex; align-items: center; gap: 8px; margin-top: 8px;')}>
            <label style={s('display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-neutral-500); white-space: nowrap;')}>
              <input
                type="checkbox"
                checked={ticket.type === 'epic'}
                disabled={Boolean(ticket.epic)}
                title={ticket.epic ? t('tableau.epic_checkbox_disabled') : undefined}
                onChange={event => onModifier({ type: event.target.checked ? 'epic' : null })}
              />
              {t('tableau.epic_checkbox')}
            </label>
            {ticket.type !== 'epic' && (
              <select
                className="input"
                value={ticket.epic ?? ''}
                onChange={event => onModifier({ epic: event.target.value || null })}
                style={s('font-size: 12px; flex: 1;')}
              >
                <option value="">{t('tableau.no_epic_parent')}</option>
                {allTickets
                  .filter(t => t.type === 'epic' && t.id !== ticket.id)
                  .map(epic => (
                    <option key={epic.id} value={epic.id}>
                      {epic.titre}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <input
            className="input"
            value={tags}
            placeholder={t('tableau.tags_placeholder')}
            onChange={event => setTags(event.target.value)}
            onBlur={() => onModifier({ tags: tags.split(',').map(t => t.trim()).filter(Boolean) })}
            style={s('font-size: 12px; width: 100%; margin-top: 8px;')}
          />

          <textarea
            ref={zoneCorps}
            className="input"
            value={corps}
            placeholder={t('tableau.acceptance_criteria_placeholder')}
            onChange={(event) => setCorps(event.target.value)}
            onBlur={() => { if (corps !== ticket.corps) onModifier({ corps }) }}
            // Coller ou déposer une capture l'écrit dans le dépôt et insère
            // son `![](…)` au curseur. `preventDefault` seulement s'il y avait
            // bien une image : un collage de texte doit rester un collage.
            onPaste={event => {
              if (imageDe(event.clipboardData)) event.preventDefault()
              void collerDansLeCorps(event.clipboardData)
            }}
            onDragOver={event => { if (imageDe(event.dataTransfer)) event.preventDefault() }}
            onDrop={event => {
              if (imageDe(event.dataTransfer)) event.preventDefault()
              void collerDansLeCorps(event.dataTransfer)
            }}
            style={s('font-size: 12px; width: 100%; margin-top: 8px; min-height: 220px; line-height: 1.55; font-family: var(--font-mono, monospace);')}
          />

          {erreurImage ? (
            <div style={s('font-size: 11px; color: var(--color-err); margin-top: 6px;')}>
              {t('tableau.image_echec')} {erreurImage}
            </div>
          ) : (
            <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 6px;')}>
              {t('tableau.image_astuce')}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={s('font-size: 15px; font-weight: 500; line-height: 1.4;')}>{ticket.titre}</div>

          <div style={s('font-size: 12px; color: var(--color-neutral-500); margin-top: 8px;')}>
            {colonne?.titre ?? ticket.colonne} · {t('tableau.priority_label')} {ticket.priorite}
            {ticket.charge && <> · {t('tableau.charge_label')} {ticket.charge}</>}
          </div>

          {(ticket.type === 'epic' || parentEpic || ticket.epic) && (
            <div style={s('margin-top: 8px;')}>
              {ticket.type === 'epic' ? (
                <span className="tag tag-outline" style={s('font-size: 10px;')}>
                  {t('tableau.epic_checkbox')}
                </span>
              ) : (
                <span
                  className="tag tag-outline"
                  style={s('font-size: 10px;')}
                  title={parentEpic ? undefined : t('tableau.parent_epic_missing')}
                >
                  {parentEpic ? `${t('tableau.child_of')} ${parentEpic.titre}` : t('tableau.orphan_ticket')}
                </span>
              )}
            </div>
          )}

          {ticket.tags.length > 0 && (
            <div style={s('display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px;')}>
              {ticket.tags.map(tag => (
                <span key={tag} className="tag tag-neutral" style={s('font-size: 10px;')}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div style={s('font-size: 12px; margin-top: 12px; min-height: 220px; line-height: 1.55;')}>
            {ticket.corps ? (
              <Markdown text={ticket.corps} root={root} />
            ) : (
              <span style={s('color: var(--color-neutral-600);')}>{t('tableau.no_description')}</span>
            )}
          </div>
        </>
      )}

      <div style={s('font-size: 10.5px; color: var(--color-neutral-600); margin-top: 10px; line-height: 1.6;')}>
        <div>{t('tableau.created')} {humanAge(ticket.cree)} · {t('tableau.modified')} {humanAge(ticket.maj)}</div>
        <div>
          ovrsee/tickets/{ticket.file}
          {nonCommite && (
            <span
              className="tag"
              style={s(
                'font-size: 10px; margin-left: 6px; color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border);',
              )}
            >
              {t('tableau.uncommitted')}
            </span>
          )}
        </div>
        {ticket.plan && <div>{t('tableau.linked_plan')} {ticket.plan}</div>}
      </div>

      {/* Détacher n'est pas destructeur : le bouton reste offert en lecture,
          contrairement à la suppression. Il vit ici et pas sur la carte —
          l'action est rare, et « détacher » seul ne disait pas de quoi. */}
      {ticket.epic && (
        <div style={s('display: flex; justify-content: flex-end; margin-top: 14px;')}>
          <button
            type="button"
            className="btn btn-ghost"
            style={s('font-size: 11.5px;')}
            onClick={() => onModifier({ epic: null })}
          >
            {t('tableau.detach_from_epic')}
          </button>
        </div>
      )}

      {edition && (
        <div style={s('display: flex; justify-content: flex-end; margin-top: 14px;')}>
          {confirme ? (
            <div style={s('display: flex; align-items: center; gap: 8px;')}>
              <span style={s('font-size: 11px; color: var(--color-neutral-400);')}>{t('tableau.delete_ticket_confirm')}</span>
              <button type="button" className="btn btn-secondary" style={s('font-size: 11.5px;')} onClick={() => setConfirme(false)}>
                {t('tableau.cancel')}
              </button>
              <button type="button" className="btn btn-primary" style={s('font-size: 11.5px;')} onClick={onSupprimer}>
                {t('tableau.delete')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" style={s('font-size: 11.5px;')} onClick={() => setConfirme(true)}>
              {t('tableau.delete')}
            </button>
          )}
        </div>
      )}
    </Enveloppe>
  )
}

/**
 * Le rail, ou la modale.
 *
 * Rail : largeur tirable, retenue par `useResizable` d'une session à l'autre,
 * double-clic sur la poignée pour revenir aux 340 px de la maquette.
 *
 * Modale : le motif de `CommandPalette.tsx` — `role="dialog"`, `aria-modal`,
 * fermeture par Escape et par le fond. Elle referme vers le rail et non vers
 * rien : agrandir puis échapper ne doit pas faire perdre le ticket ouvert. Les
 * classes `.dialog` du design system sont calibrées pour 440 px, ce qui est
 * l'inverse de ce qu'on cherche ici.
 */
function Enveloppe({
  agrandi,
  ticket,
  onReduire,
  children,
}: {
  agrandi: boolean
  ticket: Ticket
  onReduire: () => void
  children: ReactNode
}) {
  const largeur = useResizable({
    key: 'tableau.detail',
    initial: 340,
    min: 300,
    max: () => window.innerWidth * 0.7,
    axis: 'x',
    invert: true,
  })

  if (agrandi) {
    return (
      <div
        onClick={onReduire}
        style={s(
          'position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(6,7,14,.88); backdrop-filter: blur(3px);',
        )}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${ticket.id} — ${ticket.titre}`}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === 'Escape') onReduire()
          }}
          style={s(
            '--detail-pad: 24px; width: min(900px, 100%); max-height: 85vh; overflow-y: auto; padding: 0 24px 24px; border: 1px solid var(--color-border-card); border-radius: 10px; background: var(--color-surface-panel); box-shadow: var(--shadow-lg);',
          )}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <>
      <Divider axis="x" resizable={largeur} />
      <div style={s(`${PANNEAU} width: ${largeur.size}px; min-width: ${largeur.size}px;`)}>{children}</div>
    </>
  )
}
