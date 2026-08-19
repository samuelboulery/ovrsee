import { useEffect, useRef, useState } from 'react'

import {
  sortTickets,
  ticketAction,
  type Colonne,
  type GitStatus,
  type Illisible,
  type Tableau as TableauData,
  type TicketAction,
  type Ticket,
} from '../data'
import { Illisibles } from '../Illisibles'
import { t } from '../i18n'
import { s } from '../style'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'
import { Carte } from './TableauCarte'
import { estColonne, TYPE_CARTE, TYPE_COLONNE } from './TableauDnd'
import { Detail, type TicketPatch } from './TableauDetail'
import { TableauEpics } from './TableauEpics'

/** Où une colonne glissée veut atterrir : une cible, et de quel côté. */
type Insertion = { index: number; apres: boolean }

/**
 * Le tableau du projet : des tickets qu'on saisit, priorise et déplace.
 *
 * C'est la seule vue de l'ovrsee qui écrit. Tout le reste est capturé par un
 * hook et se lit ; un tableau, lui, n'a de sens que si on peut y poser une
 * intention avant qu'elle devienne un plan. Les fichiers écrits ici sont ceux
 * que Claude lit et écrit aussi — `ovrsee/tickets/`.
 *
 * Le glisser-déposer est celui du navigateur, sans bibliothèque : déplacer une
 * carte d'une colonne à l'autre est exactement ce que l'API HTML5 fait déjà.
 *
 * Les colonnes se règlent sur le tableau lui-même, en mode édition, et non dans
 * un panneau de côté : régler des colonnes sans les voir, c'est viser à
 * l'aveugle, et un réordonnancement par flèches ne dit jamais où la colonne va
 * tomber.
 */

/** Contexte d'un élément du Navigateur, à joindre au prochain ticket créé. */
type ContexteElement = { corps: string; tags: string[] }

export function Tableau({
  projet,
  root,
  board,
  tickets,
  illisibles = [],
  gitStatus,
  onChange,
  focusTicket = null,
  contexteElement = null,
}: {
  /** Nom affiché du projet, pour le fil d'Ariane de la barre de vue. */
  projet: string
  root: string
  board: Colonne[]
  tickets: Ticket[]
  illisibles?: Illisible[]
  gitStatus?: GitStatus
  onChange: (tableau: TableauData) => void
  /** Fichier du ticket à ouvrir au montage — arrivée depuis la frise Historique. */
  focusTicket?: string | null
  /** Contexte d'un élément du Navigateur à joindre au prochain ticket créé — voir `App.tsx`. */
  contexteElement?: ContexteElement | null
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [survolee, setSurvolee] = useState<string | null>(null)
  const [insertion, setInsertion] = useState<Insertion | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(focusTicket)
  const [edition, setEdition] = useState(false)
  const [vue, setVue] = useState<'kanban' | 'epics'>('kanban')
  const [enAttente, setEnAttente] = useState<ContexteElement | null>(contexteElement)

  /**
   * Applique une écriture, en montrant le résultat avant la réponse du serveur.
   *
   * Un glisser-déposer qui attend l'aller-retour disque paraît cassé. On
   * affiche donc l'état visé tout de suite ; en cas d'échec, `avant` reprend la
   * main et le message dit pourquoi.
   *
   * L'état vit chez l'appelant, jamais ici : cet onglet est démonté au premier
   * changement d'onglet, et un état local partirait avec lui — un ticket
   * déplacé serait revenu dans sa colonne d'origine au retour.
   */
  const ecrire = (optimiste: TableauData, action: TicketAction, payload: object) => {
    const avant = { board, tickets }
    onChange(optimiste)
    setErreur(null)

    ticketAction(action, root, payload as Record<string, unknown>)
      .then(onChange)
      .catch(err => {
        setErreur(String(err.message ?? err))
        onChange(avant)
      })
  }

  const deplacer = (file: string, colonne: string) => {
    const ticket = tickets.find(t => t.file === file)
    if (!ticket || ticket.colonne === colonne) return

    ecrire(
      { board, tickets: tickets.map(t => (t.file === file ? { ...t, colonne } : t)) },
      'move',
      { file, colonne },
    )
  }

  const creer = async (titre: string, colonne: string) => {
    if (!titre.trim()) return
    // Pas d'aperçu optimiste : l'identifiant vient du serveur, et inventer un
    // `T-00xx` qui changerait une seconde plus tard serait un mensonge court.
    if (!enAttente) {
      ecrire({ board, tickets }, 'create', { titre, colonne })
      return
    }

    // Un ticket depuis un élément du Navigateur : le contexte se joint à la
    // création elle-même, et le ticket s'ouvre aussitôt pour que le reste
    // (priorité, charge…) se remplisse à la main.
    setErreur(null)
    try {
      const avant = new Set(tickets.map(ticket => ticket.file))
      const suivant = await ticketAction('create', root, {
        titre,
        colonne,
        corps: enAttente.corps,
        tags: enAttente.tags,
      })
      onChange(suivant)
      const nouveau = suivant.tickets.find(ticket => !avant.has(ticket.file))
      if (nouveau) setOuverte(nouveau.file)
      setEnAttente(null)
    } catch (err) {
      setErreur(String((err as Error).message ?? err))
    }
  }

  /** Fusionne un patch dans un ticket : `null` efface le champ plutôt que d'être stocké tel quel. */
  const fusionnerPatch = (ticket: Ticket, patch: TicketPatch): Ticket => {
    const suivant: Ticket = { ...ticket, ...patch } as Ticket
    if (patch.charge === null) delete suivant.charge
    if (patch.type === null) delete suivant.type
    if (patch.epic === null) delete suivant.epic
    return suivant
  }

  const modifier = (file: string, patch: TicketPatch) =>
    ecrire(
      { board, tickets: tickets.map(t => (t.file === file ? fusionnerPatch(t, patch) : t)) },
      'update',
      { file, ...patch },
    )

  const supprimer = (file: string) => {
    setOuverte(null)
    ecrire({ board, tickets: tickets.filter(t => t.file !== file) }, 'delete', { file })
  }

  const renommer = (id: string, patch: { titre?: string; wip?: number | null }) => {
    // `wip: null` retire la limite : c'est l'absence du champ, pas un zéro.
    const applique = (colonne: Colonne): Colonne => {
      const suivante: Colonne = { ...colonne, titre: patch.titre ?? colonne.titre }
      if (patch.wip === undefined) return suivante
      if (patch.wip === null) {
        delete suivante.wip
        return suivante
      }
      return { ...suivante, wip: patch.wip }
    }

    ecrire({ board: board.map(c => (c.id === id ? applique(c) : c)), tickets }, 'column-rename', {
      id,
      ...patch,
    })
  }

  const retirer = (id: string, vers?: string) =>
    ecrire(
      {
        board: board.filter(c => c.id !== id),
        tickets: vers ? tickets.map(t => (t.colonne === id ? { ...t, colonne: vers } : t)) : tickets,
      },
      'column-remove',
      { id, vers },
    )

  const ajouter = (titre: string) => {
    if (!titre.trim()) return
    // L'identifiant vient du serveur, comme celui d'un ticket : pas d'aperçu.
    ecrire({ board, tickets }, 'column-add', { titre })
  }

  /**
   * Repose une colonne à l'endroit visé.
   *
   * `apres` dit de quel côté de la cible le curseur a été lâché. L'index final
   * s'en déduit en tenant compte du trou que la colonne laisse derrière elle
   * quand elle vient de la gauche — sans cette correction, tout déplacement
   * vers la droite s'arrêterait une position trop tôt.
   */
  const reordonner = (id: string, cible: number, apres: boolean) => {
    const depuis = board.findIndex(c => c.id === id)
    if (depuis === -1) return

    const insere = cible + (apres ? 1 : 0)
    const index = insere - (depuis < insere ? 1 : 0)
    if (index === depuis) return

    const suite = [...board]
    suite.splice(index, 0, ...suite.splice(depuis, 1))
    ecrire({ board: suite, tickets }, 'column-reorder', { id, index })
  }

  const selection = tickets.find(t => t.file === ouverte) ?? null

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; overflow: hidden;')}>
      <ViewBar projet={projet} vue={t('tableau.title')} meta={`${tickets.length} tickets · ovrsee/tickets/`}>
        <div className="seg">
          {(['kanban', 'epics'] as const).map(id => (
            <label key={id} className="seg-opt">
              <input
                type="radio"
                name="tableau-vue"
                checked={vue === id}
                onChange={() => {
                  setOuverte(null)
                  setVue(id)
                }}
              />
              {t(id === 'kanban' ? 'tableau.view_kanban' : 'tableau.view_epics')}
            </label>
          ))}
        </div>
        <button
          type="button"
          className={edition ? 'btn btn-primary' : 'btn btn-ghost'}
          style={s('font-size: 11.5px; padding: 5px 11px;')}
          onClick={() => {
            setOuverte(null)
            setEdition(!edition)
          }}
        >
          {edition ? t('tableau.finish_editing') : t('tableau.edit_columns')}
        </button>
      </ViewBar>
      <div style={s('padding: 12px 22px 12px;')}>
        {enAttente && (
          <div style={s('margin: 12px 0 12px; padding: 10px 12px; border-radius: 6px; background: var(--color-surface-card); border: 1px solid var(--color-border-control); display: flex; align-items: center; gap: 10px;')}>
            <div style={s('font-size: 12px; color: var(--color-text);')}>
              {t('tableau.element_context_banner')}
            </div>
            <div style={s('flex: 1;')} />
            <button
              type="button"
              className="btn btn-ghost"
              style={s('font-size: 11.5px; padding: 4px 8px;')}
              onClick={() => setEnAttente(null)}
            >
              {t('tableau.element_context_cancel')}
            </button>
          </div>
        )}
        <Illisibles entries={illisibles} quoi="ticket" />
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          {edition ? t('tableau.edit_mode_help') : t('tableau.read_mode_help')}
        </div>
        {erreur && (
          <div style={s('margin-top: 10px; font-size: 12px; color: var(--color-accent); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;')}>
            {erreur}
          </div>
        )}
      </div>

      <div style={s('flex: 1; display: flex; overflow: hidden;')}>
        {vue === 'epics' ? (
          <TableauEpics tickets={tickets} board={board} onOuvrir={setOuverte} ouverte={ouverte} />
        ) : (
        /* `stretch` plutôt que `flex-start` : une colonne vide doit rester une
           cible de dépôt de la hauteur du tableau, sinon on vise un liseré. */
        <div
          style={s('flex: 1; display: flex; gap: 12px; padding: 0 22px 20px; overflow-x: auto; align-items: stretch;')}
          onDragLeave={() => setInsertion(null)}
        >
          {board.map((colonne, index) => (
            <ColonneVue
              key={colonne.id}
              colonne={colonne}
              index={index}
              colonnes={board}
              tickets={sortTickets(tickets.filter(t => t.colonne === colonne.id && t.type !== 'epic'))}
              edition={edition}
              finale={index === board.length - 1 && board.length > 1}
              survolee={survolee === colonne.id}
              insertion={insertion?.index === index ? insertion : null}
              onSurvol={setSurvolee}
              onViser={setInsertion}
              onDeposeTicket={deplacer}
              onDeposeColonne={(id, apres) => {
                setInsertion(null)
                reordonner(id, index, apres)
              }}
              onCreer={titre => creer(titre, colonne.id)}
              onOuvrir={setOuverte}
              ouverte={ouverte}
              onRenommer={patch => renommer(colonne.id, patch)}
              onRetirer={vers => retirer(colonne.id, vers)}
              allTickets={tickets}
              saisieOuverte={index === 0 && Boolean(enAttente) && !edition}
            />
          ))}

          {edition && (
            <TuileAjout
              onAjouter={ajouter}
              vise={insertion?.index === board.length}
              onViser={vise => setInsertion(vise ? { index: board.length, apres: false } : null)}
              onDeposeColonne={id => {
                setInsertion(null)
                reordonner(id, board.length - 1, true)
              }}
            />
          )}
        </div>
        )}

        {selection && !edition && (
          <Detail
            key={selection.file}
            ticket={selection}
            colonnes={board}
            allTickets={tickets}
            root={root}
            gitStatus={gitStatus}
            onFermer={() => setOuverte(null)}
            onModifier={patch => modifier(selection.file, patch)}
            onDeplacer={colonne => deplacer(selection.file, colonne)}
            onSupprimer={() => supprimer(selection.file)}
          />
        )}
      </div>

      <StatusBar />
    </div>
  )
}

const COLONNE_LARGEUR = 'width: 268px; min-width: 268px;'

const COLONNE_FOND =
  'display: flex; flex-direction: column; gap: 8px; border-radius: 8px; padding: 10px; max-height: 100%; '

function ColonneVue({
  colonne,
  index,
  colonnes,
  tickets,
  edition,
  finale,
  survolee,
  insertion,
  onSurvol,
  onViser,
  onDeposeTicket,
  onDeposeColonne,
  onCreer,
  onOuvrir,
  ouverte,
  onRenommer,
  onRetirer,
  allTickets,
  saisieOuverte = false,
}: {
  colonne: Colonne
  index: number
  colonnes: Colonne[]
  tickets: Ticket[]
  edition: boolean
  finale: boolean
  survolee: boolean
  insertion: Insertion | null
  onSurvol: (id: string | null) => void
  onViser: (insertion: Insertion | null) => void
  onDeposeTicket: (file: string, colonne: string) => void
  onDeposeColonne: (id: string, apres: boolean) => void
  onCreer: (titre: string) => void
  onOuvrir: (file: string) => void
  /** Fichier du ticket sélectionné (panneau Detail ouvert), pour marquer sa carte. */
  ouverte: string | null
  onRenommer: (patch: { titre?: string; wip?: number | null }) => void
  onRetirer: (vers?: string) => void
  allTickets: Ticket[]
  /** Ouvre la saisie du titre au montage — arrivée d'un contexte d'élément depuis Navigateur. */
  saisieOuverte?: boolean
}) {
  const [saisie, setSaisie] = useState<string | null>(() => (saisieOuverte ? '' : null))
  const [confirme, setConfirme] = useState(false)
  const [vers, setVers] = useState('')
  const corps = useRef<HTMLDivElement>(null)

  // `saisieOuverte` retombe à `false` (contexte annulé, ou déjà consommé par
  // la création) : la saisie ouverte pour lui se referme avec.
  useEffect(() => {
    if (!saisieOuverte) setSaisie(null)
  }, [saisieOuverte])

  const deborde = colonne.wip !== undefined && tickets.length > colonne.wip
  const autres = colonnes.filter(c => c.id !== colonne.id)

  /** La moitié franchie décide du côté : c'est ce qui permet de viser un entre-deux. */
  const cote = (event: React.DragEvent<HTMLDivElement>) => {
    const boite = event.currentTarget.getBoundingClientRect()
    return event.clientX > boite.left + boite.width / 2
  }

  const liseré = insertion
    ? insertion.apres
      ? 'box-shadow: inset -3px 0 0 var(--color-accent);'
      : 'box-shadow: inset 3px 0 0 var(--color-accent);'
    : ''

  return (
    <div
      ref={corps}
      onDragOver={event => {
        // Sans ce refus du comportement par défaut, le navigateur n'accepte
        // aucun dépôt : la carte reviendrait à sa place sans rien dire.
        event.preventDefault()
        if (estColonne(event.dataTransfer)) onViser({ index, apres: cote(event) })
        else onSurvol(colonne.id)
      }}
      onDragLeave={() => onSurvol(null)}
      onDrop={event => {
        event.preventDefault()
        onSurvol(null)

        const id = event.dataTransfer.getData(TYPE_COLONNE)
        if (id) return onDeposeColonne(id, cote(event))

        const file = event.dataTransfer.getData(TYPE_CARTE)
        if (file) onDeposeTicket(file, colonne.id)
      }}
      style={s(
        COLONNE_LARGEUR +
          COLONNE_FOND +
          // Cible de dépôt neutre — jamais un filet coloré pour signifier un
          // état (audit §5.1) : pointillé var(--color-border-selected), fond var(--color-surface-hover).
          (survolee
            ? 'background: var(--color-surface-hover); outline: 1px dashed var(--color-border-selected);'
            : // Une colonne est un panneau : elle porte des cartes, donc elle se
              // pose au-dessus du fond. L'ancien color-mix la rendait plus
              // sombre que le fond qu'elle recouvrait.
              'background: var(--color-surface-panel);') +
          liseré,
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 6px; padding: 0 2px;')}>
        {edition && (
          <span
            draggable
            onDragStart={event => {
              event.dataTransfer.setData(TYPE_COLONNE, colonne.id)
              event.dataTransfer.effectAllowed = 'move'
              // Le fantôme est la colonne entière, pas la poignée : on doit voir
              // ce qu'on déplace. La poignée seule reste le point de prise, pour
              // qu'un glissement parti d'une carte ne déplace jamais la colonne.
              if (corps.current) event.dataTransfer.setDragImage(corps.current, 24, 16)
            }}
            title={t('tableau.drag_column')}
            style={s('cursor: grab; font-size: 12px; color: var(--color-neutral-600); user-select: none; line-height: 1;')}
          >
            ⠿
          </span>
        )}

        {edition ? (
          <input
            key={colonne.titre}
            defaultValue={colonne.titre}
            onBlur={event => {
              const titre = event.target.value.trim()
              if (titre && titre !== colonne.titre) onRenommer({ titre })
              else event.target.value = colonne.titre
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                event.currentTarget.value = colonne.titre
                event.currentTarget.blur()
              }
            }}
            style={s('flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; font-family: inherit; color: var(--color-text); background: transparent; border: 1px solid var(--color-border-card); border-radius: 6px; padding: 3px 6px;')}
          />
        ) : (
          <>
            <div style={s('font-size: 12.5px; font-weight: 500;')}>{colonne.titre}</div>
            <div style={s('font-size: 11px; color: var(--color-neutral-600);')}>{tickets.length}</div>
            <div style={s('flex: 1;')} />
          </>
        )}

        {deborde && !edition && (
          <div
            style={s('font-size: 10.5px; color: var(--color-accent);')}
            title={t('tableau.over_wip', { n: colonne.wip ?? 0 })}
          >
            ⚠ {tickets.length}/{colonne.wip}
          </div>
        )}

        {edition ? (
          <>
            <input
              key={`wip-${colonne.wip ?? ''}`}
              type="number"
              min={1}
              placeholder="—"
              title={t('tableau.wip_limit_help')}
              defaultValue={colonne.wip ?? ''}
              onBlur={event => {
                const brut = event.target.value.trim()
                const wip = brut === '' ? null : Number(brut)
                if (wip !== null && (!Number.isInteger(wip) || wip < 1)) {
                  event.target.value = String(colonne.wip ?? '')
                  return
                }
                if (wip !== (colonne.wip ?? null)) onRenommer({ wip })
              }}
              style={s('width: 46px; font-size: 11px; font-family: inherit; color: var(--color-text); background: transparent; border: 1px solid var(--color-border-card); border-radius: 6px; padding: 3px 4px;')}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={s('font-size: 12px; padding: 0 5px; line-height: 1;')}
              title={autres.length === 0 ? t('tableau.cannot_remove_last') : t('tableau.remove_column')}
              disabled={autres.length === 0}
              onClick={() => {
                setVers(autres[0]?.id ?? '')
                setConfirme(true)
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            style={s('font-size: 14px; padding: 0 6px; line-height: 1;')}
            title={t('tableau.new_ticket')}
            aria-label={t('tableau.new_ticket_in', { colonne: colonne.titre })}
            onClick={() => setSaisie(saisie === null ? '' : null)}
          >
            +
          </button>
        )}
      </div>

      {edition && (
        <div style={s('font-size: 10px; color: var(--color-neutral-600); padding: 0 3px;')}>
          {colonne.id} · {tickets.length} {tickets.length > 1 ? 'tickets' : 'ticket'}
          {finale ? ` · ${t('tableau.final_column')}` : ''}
        </div>
      )}

      {saisie !== null && !edition && (
        <input
          className="input"
          autoFocus
          value={saisie}
          placeholder={t('tableau.ticket_title_placeholder')}
          onChange={event => setSaisie(event.target.value)}
          onBlur={() => setSaisie(null)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onCreer(saisie)
              setSaisie(null)
            }
            if (event.key === 'Escape') setSaisie(null)
          }}
          style={s('font-size: 12px; padding: 6px 8px;')}
        />
      )}

      {/* La confirmation prend la place des cartes plutôt que de flotter : ce
          qu'on s'apprête à vider est exactement ce qu'elle recouvre. */}
      {confirme ? (
        <div style={s('border: 1px solid var(--color-accent-700); border-radius: 8px; padding: 10px; background: var(--color-surface-card);')}>
          <div style={s('font-size: 11px; color: var(--color-neutral-400); line-height: 1.5;')}>
            {tickets.length > 0
              ? t(tickets.length > 1 ? 'tableau.tickets_to_relocate_plural' : 'tableau.tickets_to_relocate', { n: tickets.length })
              : t('tableau.empty_column')}
          </div>
          {tickets.length > 0 && (
            <select
              className="input"
              value={vers}
              onChange={event => setVers(event.target.value)}
              style={s('font-size: 11.5px; width: 100%; margin-top: 8px; padding: 4px 6px;')}
            >
              {autres.map(c => (
                <option key={c.id} value={c.id}>
                  {c.titre}
                </option>
              ))}
            </select>
          )}
          <div style={s('display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;')}>
            <button
              type="button"
              className="btn btn-secondary"
              style={s('font-size: 11.5px;')}
              onClick={() => setConfirme(false)}
            >
              {t('tableau.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={s('font-size: 11.5px;')}
              onClick={() => {
                setConfirme(false)
                onRetirer(tickets.length > 0 ? vers : undefined)
              }}
            >
              {t('tableau.remove')}
            </button>
          </div>
        </div>
      ) : (
        <div style={s('display: flex; flex-direction: column; gap: 8px; overflow-y: auto;')}>
          {survolee && (
            <div
              style={s(
                'font-size: 11px; color: var(--color-text-tertiary); text-align: center; padding: 8px; border-radius: 6px; border: 1px dashed var(--color-border-selected);',
              )}
            >
              {t('tableau.drop_here')}
            </div>
          )}
          {tickets.map(ticket => (
            <Carte
              key={ticket.file}
              ticket={ticket}
              onOuvrir={onOuvrir}
              ouverte={ouverte}
              allTickets={allTickets}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * La tuile de bout de rangée : ajouter une colonne là où elle apparaîtra.
 *
 * Elle sert aussi de cible de dépôt — c'est le seul endroit où lâcher une
 * colonne pour l'envoyer en dernière position sans viser un demi-pixel.
 */
function TuileAjout({
  onAjouter,
  vise,
  onViser,
  onDeposeColonne,
}: {
  onAjouter: (titre: string) => void
  vise: boolean
  onViser: (vise: boolean) => void
  onDeposeColonne: (id: string) => void
}) {
  const [saisie, setSaisie] = useState<string | null>(null)

  return (
    <div
      onDragOver={event => {
        if (!estColonne(event.dataTransfer)) return
        event.preventDefault()
        onViser(true)
      }}
      onDragLeave={() => onViser(false)}
      onDrop={event => {
        event.preventDefault()
        const id = event.dataTransfer.getData(TYPE_COLONNE)
        if (id) onDeposeColonne(id)
      }}
      style={s(
        COLONNE_LARGEUR +
          'display: flex; flex-direction: column; justify-content: flex-start; border-radius: 8px; padding: 10px; border: 1px dashed ' +
          (vise ? 'var(--color-accent);' : 'var(--color-neutral-800);'),
      )}
    >
      {saisie === null ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={s('font-size: 12px; width: 100%; justify-content: center;')}
          onClick={() => setSaisie('')}
        >
          {t('tableau.add_column')}
        </button>
      ) : (
        <input
          className="input"
          autoFocus
          value={saisie}
          placeholder={t('tableau.column_title_placeholder')}
          onChange={event => setSaisie(event.target.value)}
          onBlur={() => setSaisie(null)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onAjouter(saisie)
              setSaisie(null)
            }
            if (event.key === 'Escape') setSaisie(null)
          }}
          style={s('font-size: 12px; padding: 6px 8px;')}
        />
      )}
    </div>
  )
}


