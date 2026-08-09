import { useRef, useState } from 'react'

import {
  humanAge,
  PRIORITES,
  sortTickets,
  ticketAction,
  type Colonne,
  type Illisible,
  type Priorite,
  type Tableau as TableauData,
  type TicketAction,
  type Ticket,
} from '../data'
import { Illisibles } from '../Illisibles'
import { s } from '../style'

/**
 * Deux glisser-déposer partagent la même surface : les cartes et les colonnes.
 *
 * Ils se distinguent au type MIME, pas à la devinette. Pendant un `dragover`
 * le navigateur interdit de lire les données transportées — seuls les *types*
 * sont visibles — donc c'est aussi la seule façon de savoir quoi surligner
 * avant le dépôt.
 */
const TYPE_CARTE = 'text/plain'
const TYPE_COLONNE = 'application/x-cockpit-colonne'

const estColonne = (transfert: DataTransfer) => transfert.types.includes(TYPE_COLONNE)

/** Où une colonne glissée veut atterrir : une cible, et de quel côté. */
type Insertion = { index: number; apres: boolean }

/**
 * Le tableau du projet : des tickets qu'on saisit, priorise et déplace.
 *
 * C'est la seule vue du cockpit qui écrit. Tout le reste est capturé par un
 * hook et se lit ; un tableau, lui, n'a de sens que si on peut y poser une
 * intention avant qu'elle devienne un plan. Les fichiers écrits ici sont ceux
 * que Claude lit et écrit aussi — `cockpit/tickets/`.
 *
 * Le glisser-déposer est celui du navigateur, sans bibliothèque : déplacer une
 * carte d'une colonne à l'autre est exactement ce que l'API HTML5 fait déjà.
 *
 * Les colonnes se règlent sur le tableau lui-même, en mode édition, et non dans
 * un panneau de côté : régler des colonnes sans les voir, c'est viser à
 * l'aveugle, et un réordonnancement par flèches ne dit jamais où la colonne va
 * tomber.
 */
export function Tableau({
  root,
  board,
  tickets,
  illisibles = [],
  onChange,
}: {
  root: string
  board: Colonne[]
  tickets: Ticket[]
  illisibles?: Illisible[]
  onChange: (tableau: TableauData) => void
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [survolee, setSurvolee] = useState<string | null>(null)
  const [insertion, setInsertion] = useState<Insertion | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [edition, setEdition] = useState(false)

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

  const creer = (titre: string, colonne: string) => {
    if (!titre.trim()) return
    // Pas d'aperçu optimiste : l'identifiant vient du serveur, et inventer un
    // `T-00xx` qui changerait une seconde plus tard serait un mensonge court.
    ecrire({ board, tickets }, 'create', { titre, colonne })
  }

  const modifier = (file: string, patch: Partial<Ticket> & { corps?: string }) =>
    ecrire(
      { board, tickets: tickets.map(t => (t.file === file ? { ...t, ...patch } : t)) },
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
      <div style={s('padding: 20px 22px 12px;')}>
        <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
          <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
            Tableau
          </h2>
          <div style={s('flex: 1;')} />
          <button
            type="button"
            className={edition ? 'btn btn-primary' : 'btn btn-ghost'}
            style={s('font-size: 11.5px; padding: 5px 11px;')}
            onClick={() => {
              setOuverte(null)
              setEdition(!edition)
            }}
          >
            {edition ? 'Terminer' : 'Éditer les colonnes'}
          </button>
        </div>

        <Illisibles entries={illisibles} quoi="ticket" />
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          {edition
            ? 'Renomme sur place, fais glisser une colonne par sa poignée, ajoute-en une en bout de rangée. Un identifiant de colonne ne change jamais : les tickets le citent.'
            : 'Un fichier par ticket dans cockpit/tickets/, colonnes réglées dans cockpit/board.json. Écrit ici comme depuis le terminal.'}
        </div>
        {erreur && (
          <div style={s('margin-top: 10px; font-size: 12px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;')}>
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
              tickets={sortTickets(tickets.filter(t => t.colonne === colonne.id))}
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
              onRenommer={patch => renommer(colonne.id, patch)}
              onRetirer={vers => retirer(colonne.id, vers)}
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
            onFermer={() => setOuverte(null)}
            onModifier={patch => modifier(selection.file, patch)}
            onDeplacer={colonne => deplacer(selection.file, colonne)}
            onSupprimer={() => supprimer(selection.file)}
          />
        )}
      </div>
    </div>
  )
}

const PANNEAU =
  'width: 340px; min-width: 340px; border-left: 1px solid var(--color-neutral-800); padding: 0 18px 20px; overflow-y: auto; background: var(--color-bg);'

const COLONNE_LARGEUR = 'width: 268px; min-width: 268px;'

const COLONNE_FOND =
  'display: flex; flex-direction: column; gap: 8px; border-radius: 10px; padding: 10px; max-height: 100%; '

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
  onRenommer,
  onRetirer,
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
  onRenommer: (patch: { titre?: string; wip?: number | null }) => void
  onRetirer: (vers?: string) => void
}) {
  const [saisie, setSaisie] = useState<string | null>(null)
  const [confirme, setConfirme] = useState(false)
  const [vers, setVers] = useState('')
  const corps = useRef<HTMLDivElement>(null)

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
          (survolee
            ? 'background: var(--color-accent-900); outline: 1px dashed var(--color-accent-600);'
            : 'background: color-mix(in srgb, var(--color-surface) 55%, transparent);') +
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
            title="Déplacer la colonne"
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
            style={s('flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; font-family: inherit; color: var(--color-text); background: transparent; border: 1px solid var(--color-neutral-800); border-radius: 5px; padding: 3px 6px;')}
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
            style={s('font-size: 10.5px; color: var(--color-accent-300);')}
            title={`Plus de ${colonne.wip} tickets en parallèle dans cette colonne`}
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
              title="Limite de tickets en parallèle"
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
              style={s('width: 46px; font-size: 11px; font-family: inherit; color: var(--color-text); background: transparent; border: 1px solid var(--color-neutral-800); border-radius: 5px; padding: 3px 4px;')}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={s('font-size: 12px; padding: 0 5px; line-height: 1;')}
              title={autres.length === 0 ? 'La dernière colonne ne peut pas être retirée' : 'Retirer la colonne'}
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
            title="Nouveau ticket"
            aria-label={`Nouveau ticket dans ${colonne.titre}`}
            onClick={() => setSaisie(saisie === null ? '' : null)}
          >
            +
          </button>
        )}
      </div>

      {edition && (
        <div style={s('font-size: 10px; color: var(--color-neutral-600); padding: 0 3px;')}>
          {colonne.id} · {tickets.length} ticket(s){finale ? ' · vaut « terminé »' : ''}
        </div>
      )}

      {saisie !== null && !edition && (
        <input
          className="input"
          autoFocus
          value={saisie}
          placeholder="Titre du ticket"
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
        <div style={s('border: 1px solid var(--color-accent-700); border-radius: 8px; padding: 10px; background: var(--color-surface);')}>
          <div style={s('font-size: 11px; color: var(--color-neutral-400); line-height: 1.5;')}>
            {tickets.length > 0
              ? `${tickets.length} ticket(s) à reloger. Leur fichier sera réécrit.`
              : 'Colonne vide : rien à reloger.'}
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
              Annuler
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
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <div style={s('display: flex; flex-direction: column; gap: 8px; overflow-y: auto;')}>
          {tickets.map(ticket => (
            <Carte key={ticket.file} ticket={ticket} onOuvrir={onOuvrir} />
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
          'display: flex; flex-direction: column; justify-content: flex-start; border-radius: 10px; padding: 10px; border: 1px dashed ' +
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
          + Ajouter une colonne
        </button>
      ) : (
        <input
          className="input"
          autoFocus
          value={saisie}
          placeholder="Titre de la colonne"
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
const COULEUR: Record<Priorite, string> = {
  haute: 'var(--color-accent-400)',
  moyenne: 'var(--color-neutral-500)',
  basse: 'var(--color-neutral-700)',
}

function Carte({ ticket, onOuvrir }: { ticket: Ticket; onOuvrir: (file: string) => void }) {
  return (
    <div
      draggable
      onDragStart={event => event.dataTransfer.setData(TYPE_CARTE, ticket.file)}
      onClick={() => onOuvrir(ticket.file)}
      style={s('border: 1px solid var(--color-neutral-800); border-radius: 8px; padding: 10px 11px; background: var(--color-surface); cursor: pointer;')}
    >
      <div style={s('display: flex; align-items: center; gap: 7px;')}>
        <span
          style={s(`width: 7px; height: 7px; border-radius: 50%; flex: none; background: ${COULEUR[ticket.priorite] ?? COULEUR.moyenne};`)}
          title={`priorité ${ticket.priorite}`}
        />
        <div style={s('font-size: 10px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums;')}>
          {ticket.id}
        </div>
        <div style={s('flex: 1;')} />
        <div style={s('font-size: 10px; color: var(--color-neutral-600);')}>{humanAge(ticket.cree)}</div>
      </div>

      <div style={s('font-size: 12.5px; margin-top: 6px; line-height: 1.45; text-wrap: pretty;')}>
        {ticket.titre}
      </div>

      {(ticket.tags.length > 0 || ticket.plan) && (
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
        </div>
      )}
    </div>
  )
}

function Detail({
  ticket,
  colonnes,
  onFermer,
  onModifier,
  onDeplacer,
  onSupprimer,
}: {
  ticket: Ticket
  colonnes: Colonne[]
  onFermer: () => void
  onModifier: (patch: { titre?: string; priorite?: Priorite; tags?: string[]; corps?: string }) => void
  onDeplacer: (colonne: string) => void
  onSupprimer: () => void
}) {
  const [titre, setTitre] = useState(ticket.titre)
  const [tags, setTags] = useState(ticket.tags.join(', '))
  const [corps, setCorps] = useState(ticket.corps)
  const [confirme, setConfirme] = useState(false)

  return (
    <div style={s(PANNEAU)}>
      <div style={s('display: flex; align-items: center; gap: 8px; padding: 4px 0 12px; position: sticky; top: 0; background: var(--color-bg);')}>
        <div style={s('font-size: 11px; color: var(--color-neutral-600); font-variant-numeric: tabular-nums;')}>
          {ticket.id}
        </div>
        <div style={s('flex: 1;')} />
        <button type="button" className="btn btn-ghost" style={s('font-size: 12px;')} onClick={onFermer}>
          Fermer
        </button>
      </div>

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
      </div>

      <input
        className="input"
        value={tags}
        placeholder="tags, séparés par des virgules"
        onChange={event => setTags(event.target.value)}
        onBlur={() => onModifier({ tags: tags.split(',').map(t => t.trim()).filter(Boolean) })}
        style={s('font-size: 12px; width: 100%; margin-top: 8px;')}
      />

      <textarea
        className="input"
        value={corps}
        placeholder={'## Contexte\n\n## Critères d’acceptation\n- [ ] …'}
        onChange={event => setCorps(event.target.value)}
        onBlur={() => corps !== ticket.corps && onModifier({ corps })}
        style={s('font-size: 12px; width: 100%; margin-top: 8px; min-height: 220px; line-height: 1.55; font-family: var(--font-mono, monospace);')}
      />

      <div style={s('font-size: 10.5px; color: var(--color-neutral-600); margin-top: 10px; line-height: 1.6;')}>
        <div>créé {humanAge(ticket.cree)} · modifié {humanAge(ticket.maj)}</div>
        <div>cockpit/tickets/{ticket.file}</div>
        {ticket.plan && <div>plan lié : {ticket.plan}</div>}
      </div>

      <div style={s('display: flex; justify-content: flex-end; margin-top: 14px;')}>
        {confirme ? (
          <div style={s('display: flex; align-items: center; gap: 8px;')}>
            <span style={s('font-size: 11px; color: var(--color-neutral-400);')}>Supprimer ce ticket ?</span>
            <button type="button" className="btn btn-secondary" style={s('font-size: 11.5px;')} onClick={() => setConfirme(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" style={s('font-size: 11.5px;')} onClick={onSupprimer}>
              Supprimer
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" style={s('font-size: 11.5px;')} onClick={() => setConfirme(true)}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
