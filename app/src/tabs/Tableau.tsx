import { useEffect, useRef, useState } from 'react'

import {
  CHARGES,
  childrenOf,
  colonneFinale,
  epicProgress,
  humanAge,
  PRIORITES,
  sortTickets,
  ticketAction,
  type Charge,
  type Colonne,
  type GitStatus,
  type Illisible,
  type Priorite,
  type Tableau as TableauData,
  type TicketAction,
  type Ticket,
} from '../data'
import { Illisibles } from '../Illisibles'
import { t } from '../i18n'
import { Markdown } from '../markdown'
import { s } from '../style'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'

/**
 * Deux glisser-déposer partagent la même surface : les cartes et les colonnes.
 *
 * Ils se distinguent au type MIME, pas à la devinette. Pendant un `dragover`
 * le navigateur interdit de lire les données transportées — seuls les *types*
 * sont visibles — donc c'est aussi la seule façon de savoir quoi surligner
 * avant le dépôt.
 */
const TYPE_CARTE = 'text/plain'
const TYPE_COLONNE = 'application/x-ovrsee-colonne'

const estColonne = (transfert: DataTransfer) => transfert.types.includes(TYPE_COLONNE)

/** Où une colonne glissée veut atterrir : une cible, et de quel côté. */
type Insertion = { index: number; apres: boolean }

/**
 * Fait suivre chaque epic de ses enfants présents dans la même colonne.
 *
 * `sortTickets` n'a aucune notion d'epic — sans ce passage, les enfants d'un
 * même epic se dispersent dans la colonne au gré de leur priorité et de leur
 * date. Un enfant en priorité haute peut trier *avant* son epic en priorité
 * basse : les enfants sont donc exclus du parcours principal et réinjectés
 * juste après leur epic, jamais laissés à leur place d'origine. Purement un
 * ordre d'affichage : l'ordre stocké (celui de `board.json`) n'existe pas, il
 * est recalculé à chaque rendu, donc réordonner ici ne perd rien. Un enfant
 * dont l'epic est dans une autre colonne garde sa place.
 */
const groupEpics = (tickets: Ticket[]): Ticket[] => {
  const epicsIci = new Set(tickets.filter(t => t.type === 'epic').map(t => t.id))
  const enfantIci = (t: Ticket) => t.epic !== undefined && epicsIci.has(t.epic)

  const suite: Ticket[] = []
  for (const ticket of tickets) {
    if (enfantIci(ticket)) continue
    suite.push(ticket)
    if (ticket.type === 'epic') suite.push(...tickets.filter(t => t.epic === ticket.id))
  }
  return suite
}

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

/**
 * Ce qu'un ticket peut recevoir en modification.
 *
 * `charge`, `type` et `epic` acceptent `null` pour effacer le champ — un
 * ticket redevient non estimé, non-epic, ou détaché. `Partial<Ticket>` seul ne
 * le permettrait pas : ses champs optionnels acceptent `undefined` (ne pas
 * toucher), pas `null` (effacer). D'où l'exclusion puis la redéfinition.
 */
type TicketPatch = Partial<Omit<Ticket, 'charge' | 'type' | 'epic'>> & {
  corps?: string
  charge?: Charge | null
  type?: 'epic' | null
  epic?: string | null
}

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
  const [filtreEpic, setFiltreEpic] = useState<string | null>(null)
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
  // Sans filtre, tout s'affiche — epics, leurs enfants, les orphelins. « Voir
  // enfants » isole les enfants d'un epic donné ; ça n'a jamais eu vocation à
  // cacher les epics eux-mêmes de la vue par défaut.
  const ticketsAffichables = filtreEpic ? tickets.filter(t => t.epic === filtreEpic) : tickets

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; overflow: hidden;')}>
      <ViewBar projet={projet} vue={t('tableau.title')} meta={`${tickets.length} tickets · ovrsee/tickets/`}>
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
        {filtreEpic && (
          <div style={s('margin: 12px 0 12px; padding: 10px 12px; border-radius: 6px; background: var(--color-surface-card); border: 1px solid var(--color-border-control); display: flex; align-items: center; gap: 10px;')}>
            <span className="tag tag-accent" style={s('font-size: 10px;')}>epic</span>
            <div style={s('font-size: 12px; color: var(--color-text);')}>
              {t('tableau.children_of')} <span style={s('font-weight: 500;')}>{filtreEpic}</span>
            </div>
            <div style={s('flex: 1;')} />
            <button
              type="button"
              className="btn btn-ghost"
              style={s('font-size: 11.5px; padding: 4px 8px;')}
              onClick={() => setFiltreEpic(null)}
            >
              {t('tableau.back')}
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
        {/* `stretch` plutôt que `flex-start` : une colonne vide doit rester une
            cible de dépôt de la hauteur du tableau, sinon on vise un liseré. */}
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
              tickets={groupEpics(sortTickets(ticketsAffichables.filter(t => t.colonne === colonne.id)))}
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
              filtreEpic={filtreEpic}
              setFiltreEpic={setFiltreEpic}
              allTickets={tickets}
              onModifier={modifier}
              boardColonnes={board}
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

const PANNEAU =
  'width: 340px; min-width: 340px; border-left: 1px solid var(--color-border-card); padding: 0 18px 20px; overflow-y: auto; background: var(--color-surface-panel);'

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
  filtreEpic,
  setFiltreEpic,
  allTickets,
  onModifier,
  boardColonnes,
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
  filtreEpic: string | null
  setFiltreEpic: (epic: string | null) => void
  allTickets: Ticket[]
  onModifier: (file: string, patch: TicketPatch) => void
  boardColonnes: Colonne[]
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
          {tickets
            .filter(ticket => !(ticket.epic && tickets.some(e => e.id === ticket.epic && e.type === 'epic')))
            .map(ticket => (
              <Carte
                key={ticket.file}
                ticket={ticket}
                onOuvrir={onOuvrir}
                ouverte={ouverte}
                enfantsIci={ticket.type === 'epic' ? tickets.filter(c => c.epic === ticket.id) : undefined}
                filtreEpic={filtreEpic}
                setFiltreEpic={setFiltreEpic}
                allTickets={allTickets}
                onModifier={onModifier}
                boardColonnes={boardColonnes}
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

/** Une pastille par priorité — c'est ce qui se lit avant le titre. */
export const COULEUR_PRIORITE: Record<Priorite, string> = {
  haute: 'var(--color-accent-400)',
  moyenne: 'var(--color-neutral-500)',
  basse: 'var(--color-neutral-700)',
}

function Carte({
  ticket,
  onOuvrir,
  ouverte,
  enfantsIci,
  filtreEpic,
  setFiltreEpic,
  allTickets,
  onModifier,
  boardColonnes,
}: {
  ticket: Ticket
  onOuvrir: (file: string) => void
  /** Fichier du ticket dont le panneau Detail est ouvert — filet + halo, jamais un filet accent. */
  ouverte: string | null
  /** Enfants de cet epic présents dans cette même colonne — rendus imbriqués, sans liseré. */
  enfantsIci?: Ticket[]
  filtreEpic: string | null
  setFiltreEpic: (epic: string | null) => void
  allTickets: Ticket[]
  onModifier: (file: string, patch: TicketPatch) => void
  boardColonnes: Colonne[]
}) {
  const isEpic = ticket.type === 'epic'
  const selectionnee = ticket.file === ouverte
  const children = isEpic ? childrenOf(allTickets, ticket.id) : []
  const finalColumn = colonneFinale(boardColonnes)
  const progress = isEpic ? epicProgress(children, finalColumn) : null
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
        {isEpic && (
          <span
            className="tag tag-outline"
            style={s('font-size: 9px; padding: 2px 6px; margin: 0;')}
            title="Epic"
          >
            epic
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

      {isEpic && progress && (
        <div style={s('display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 11px;')}>
          <div style={s('flex: 1; height: 4px; border-radius: 2px; background: var(--color-neutral-800); overflow: hidden;')}>
            <div
              style={s(`height: 100%; background: var(--color-accent-400); width: ${progress.percent}%;`)}
            />
          </div>
          <span style={s('color: var(--color-neutral-600); white-space: nowrap;')}>
            {progress.done}/{progress.total}
          </span>
        </div>
      )}

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

      <div style={s('display: flex; gap: 6px; margin-top: 8px;')}>
        {isEpic && children.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={s('font-size: 10px; padding: 3px 6px; flex: 1;')}
            onClick={(e) => {
              e.stopPropagation()
              setFiltreEpic(ticket.id)
            }}
          >
            {t('tableau.view_children', { n: children.length })}
          </button>
        )}
        {ticket.epic && (
          <button
            type="button"
            className="btn btn-ghost"
            style={s('font-size: 10px; padding: 3px 6px; flex: 1;')}
            onClick={(e) => {
              e.stopPropagation()
              onModifier(ticket.file, { epic: null })
            }}
          >
            {t('tableau.detach')}
          </button>
        )}
      </div>

      {enfantsIci && enfantsIci.length > 0 && (
        <div style={s('display: flex; flex-direction: column; gap: 8px; margin-top: 10px;')}>
          {enfantsIci.map(enfant => (
            <Carte
              key={enfant.file}
              ticket={enfant}
              onOuvrir={onOuvrir}
              ouverte={ouverte}
              filtreEpic={filtreEpic}
              setFiltreEpic={setFiltreEpic}
              allTickets={allTickets}
              onModifier={onModifier}
              boardColonnes={boardColonnes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({
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

  const colonne = colonnes.find(c => c.id === ticket.colonne)
  const parentEpic = ticket.epic ? allTickets.find(t => t.id === ticket.epic) : null
  const nonCommite = gitStatus?.dirty.files?.includes(`ovrsee/tickets/${ticket.file}`) ?? false

  return (
    <div style={s(PANNEAU)}>
      <div style={s('display: flex; align-items: center; gap: 8px; padding: 4px 0 12px; position: sticky; top: 0; background: var(--color-bg);')}>
        <div style={s('font-size: 11px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums;')}>
          {ticket.id}
        </div>
        <div style={s('flex: 1;')} />
        <button
          type="button"
          className={edition ? 'btn btn-primary' : 'btn btn-ghost'}
          style={s('font-size: 12px;')}
          onClick={() => setEdition(!edition)}
        >
          {edition ? t('tableau.finish_editing') : t('tableau.edit_ticket')}
        </button>
        <button type="button" className="btn btn-ghost" style={s('font-size: 12px;')} onClick={onFermer}>
          {t('tableau.close')}
        </button>
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
            className="input"
            value={corps}
            placeholder={t('tableau.acceptance_criteria_placeholder')}
            onChange={(event) => setCorps(event.target.value)}
            onBlur={() => { if (corps !== ticket.corps) onModifier({ corps }) }}
            style={s('font-size: 12px; width: 100%; margin-top: 8px; min-height: 220px; line-height: 1.55; font-family: var(--font-mono, monospace);')}
          />
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
    </div>
  )
}
