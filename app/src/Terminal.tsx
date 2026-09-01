import { useEffect, useRef, useState, type ComponentType } from 'react'
import { briefLines, buildActions, decideInjection } from './brief'
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  GitFork,
  Minus,
  NotePencil,
  PencilSimple,
  Play,
  Plus,
  PushPin,
  Square,
  SquareHalf,
  SquareHalfBottom,
  type IconProps,
} from '@phosphor-icons/react'

import {
  type Snapshot,
  type SettingsType,
} from './data'
import { etiquetteDe } from './attention'
import { DIT_ATTENTION, Etat } from './EtatSession'
import { composer, resumeProjet, type MenuBarAttention, type MenuBarSession } from './menubar'
import { s } from './style'
import type { ThemeMode } from './theme'
import { t, type TranslationKey } from './i18n'
import { useTerminals } from './useTerminal'
import { cibleDeCommande, pasteTo, submitTo } from './pty'
import { pinFor, pinKey, readPins, togglePin, writePins, type Pins } from './terminalPins'
import { Divider, useResizable } from './useResizable'
import type { TabId } from './views'

/**
 * Icône par commande livrée — maquette l. 555-558. `buildActions()` compose le
 * libellé traduit tel quel (T-0080 a retiré les glyphes Unicode qui y étaient
 * concaténés, remplacés ici par de vraies icônes) ; les actions
 * personnalisées, elles, n'ont pas d'icône dédiée.
 *
 * Calculée à chaque rendu, pas au chargement du module : les clés sont des
 * libellés traduits, et une bascule de langue à chaud les changerait sous les
 * pieds d'une table figée une fois pour toutes.
 */
const iconeCommande = (): Record<string, ComponentType<IconProps>> => ({
  [t('action.graph')]: GitFork,
  [t('action.graph_obsidian')]: NotePencil,
})

export type Layout = 'bottom' | 'side' | 'full'

/** Ce que `App` peut demander au panneau terminal quand il est monté. */
export interface TerminalActions {
  /** Un terminal a-t-il le focus ? Lu au moment du geste, jamais rendu. */
  focus: () => boolean
  ouvrirShell: () => void
  /** Ferme l'onglet actif, ou `null` s'il n'est pas fermable (session Claude). */
  fermerActif: (() => void) | null
}

const LAYOUT_IDS: Layout[] = ['bottom', 'side', 'full']

/**
 * Le bouton qui replie et déplie le panneau des commandes.
 *
 * Dans le panneau, jamais dans la barre d'outils du terminal : un bouton qui
 * commande un panneau se tient dedans, et replié il reste le seul contenu de
 * la bande — c'est ce qui dit que le panneau existe encore (T-0225).
 *
 * Le chevron pointe vers le geste : vers le bord quand il replie, vers le
 * centre quand il rouvre. En disposition « côté », la bande est en bas et les
 * chevrons deviennent verticaux.
 */
function BoutonBande({
  ouverte,
  layout,
  onToggle,
}: {
  ouverte: boolean
  layout: Layout
  onToggle: () => void
}) {
  const Icone =
    layout === 'side' ? (ouverte ? CaretDown : CaretUp) : ouverte ? CaretRight : CaretLeft
  const dit = t(ouverte ? 'terminal.actions_hide' : 'terminal.actions_show')

  return (
    <button
      type="button"
      className="btn-icon"
      onClick={onToggle}
      aria-expanded={ouverte}
      title={dit}
      aria-label={dit}
      style={s(
        'flex: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 0; border-radius: 6px; background: transparent;',
      )}
    >
      <Icone size={13} weight="bold" aria-hidden="true" color="var(--color-text-quaternary)" />
    </button>
  )
}

const layoutLabel = (layout: Layout): string => {
  const map: Record<Layout, TranslationKey> = {
    'bottom': 'terminal.layout_bottom',
    'side': 'terminal.layout_side',
    'full': 'terminal.layout_full',
  }
  return t(map[layout])
}

/**
 * Un carré Phosphor par disposition — la part pleine dit où va le terminal.
 *
 * En `fill` et pas en `regular` : c'est le poids qui donne la géométrie juste.
 * `SquareHalf` rempli l'est à droite, `SquareHalfBottom` en bas — aucune
 * rotation à écrire. En `regular`, ce dernier hachure sa moitié de barres
 * verticales, illisible à 13 px.
 *
 * L'état actif se dit par la pastille du segmenté, jamais par le poids : les
 * trois icônes gardent la même graisse, sinon « plein » paraîtrait toujours
 * sélectionné.
 */
const LAYOUT_ICONS: Record<Layout, ComponentType<IconProps>> = {
  'bottom': SquareHalfBottom,
  'side': SquareHalf,
  'full': Square,
}

/** `.seg-opt` est calibré pour du texte ; une icône seule n'a pas besoin de ses 10 px. */
const SEG_ICONE = 'padding: 5px 8px;'

/**
 * Le panneau se dimensionne selon sa disposition.
 *
 * « Plein » n'a pas de taille propre : il prend tout. Les deux autres ont leur
 * séparateur, avec une clé de conservation distincte — une hauteur de 244 px
 * et une largeur de 468 px ne se mélangent pas.
 */
const panelStyle = (layout: Layout, size: number): string => {
  if (layout === 'full') {
    return 'flex: 1; background: var(--color-surface); display: flex; flex-direction: column; min-height: 0; min-width: 0;'
  }
  if (layout === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid var(--color-border-chrome); background: var(--color-surface); display: flex; flex-direction: column; min-height: 0;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid var(--color-border-chrome); background: var(--color-surface); display: flex; flex-direction: column; min-height: 0;`
}

/**
 * Panneau terminal — maquette l. 374-418.
 *
 * Un vrai shell tourne derrière, par IPC, dans le dossier du projet
 * sélectionné, avec `claude` lancé d'office ; les boutons d'injection y
 * écrivent. Quitter Claude laisse le shell — le panneau reste utilisable.
 *
 * Dans un navigateur il n'y a pas d'IPC, donc pas de session : le panneau le
 * dit et les boutons se rabattent sur le presse-papier. Un bouton qui
 * prétendrait écrire dans une session inexistante serait un mensonge
 * d'interface ; un bouton qui copie fait ce qu'il annonce.
 */
export function Terminal({
  tab,
  layout,
  onLayout,
  onToggle,
  onReload,
  snapshot,
  settings,
  terminalHeight,
  terminalWidth,
  onTerminalHeightChange,
  onTerminalWidthChange,
  onProjet,
  onSessions,
  onOpenPreferences,
  actions,
  themeMode,
}: {
  /** La vue affichée — c'est à elle que s'épingle une taille de panneau. */
  tab: TabId
  layout: Layout
  onLayout: (layout: Layout) => void
  onToggle: () => void
  /** Relit `ovrsee/` — après un scan, l'interface ne se met pas à jour seule. */
  onReload: () => void
  snapshot: Snapshot | null
  /** Vient d'`App` et pas d'un `fetchSettings()` local : une copie chargée au
      montage ne verrait jamais l'enregistrement des préférences. */
  settings: SettingsType | null
  terminalHeight: number
  terminalWidth: number
  onTerminalHeightChange: (height: number) => void
  onTerminalWidthChange: (width: number) => void
  /** Affiche un projet — au clic sur une notification venue d'un autre. */
  onProjet: (path: string) => void
  /**
   * L'état des sessions Claude, republié à chaque signal.
   *
   * Exactement ce que la barre de menu reçoit — même `composer()`, même appel :
   * le sélecteur de projet montre ce que le popover montre, il ne le recalcule
   * pas. Vidé au démontage, parce que replier le panneau démonte ce composant
   * et coupe l'écoute des pty : annoncer un état qu'on ne reçoit plus serait un
   * mensonge d'interface.
   */
  onSessions: (sessions: MenuBarSession[]) => void
  /** Ouvre les préférences sur la section Projet, pour y créer une commande. */
  onOpenPreferences?: () => void
  /**
   * Le thème résolu, `light` ou `dark`.
   *
   * Il descend d'`App` plutôt que d'être lu ici : la chrome du panneau suit
   * les jetons CSS toute seule, mais le canvas xterm ne lit pas le CSS, et il
   * lui faut un rendu pour être repeint (T-0229).
   */
  themeMode: ThemeMode
  /**
   * Ce que le menu natif peut demander au panneau — ⌘W, ⌘D.
   *
   * Une référence remplie à chaque rendu et vidée au démontage, plutôt que des
   * rappels remontés : `App` est démonté de ce composant dès qu'on replie le
   * panneau, et c'est justement l'absence qui doit se lire.
   */
  actions?: { current: TerminalActions | null }
}) {
  const [notice, setNotice] = useState<string | null>(null)

  // Déclaré avant `useTerminals` pour lui être passé, mais il lit `active` et
  // `cibler` qui en sortent : d'où la référence, tenue à jour à chaque rendu.
  const etat = useRef<{
    active: string | null
    cibler: (key: string) => void
    renommer: (key: string, label: string, options?: { manuel?: boolean }) => void
    reinitialiser: (key: string) => void
    onProjet: (path: string) => void
  }>({
    active: null,
    cibler: () => {},
    renommer: () => {},
    reinitialiser: () => {},
    onProjet,
  })

  // Les signaux reçus, par clé de session. Une référence et pas un state : les
  // rafraîchir déclencherait un rendu du panneau à chaque fin de tour de
  // Claude, pour un affichage qui vit dans une autre fenêtre.
  //
  // Ce n'est que la moitié de ce que la barre de menu montre : l'autre est la
  // liste des sessions ouvertes, qui existe indépendamment. Voir `composer()`.
  const attentions = useRef<Record<string, MenuBarAttention>>({})
  /**
   * Les sessions où une commande cliquée tourne encore.
   *
   * Rien dans un pty ne dit de façon fiable qu'une commande y tourne : le
   * signal `busy` vient des hooks de Claude Code, et un `pnpm dev` dans un
   * shell nu n'émet rien. On ne retient donc que ce qu'on a lancé soi-même —
   * relâché dès que l'utilisateur tape dedans, ce qui veut dire qu'il a repris
   * la main, ou que le pty disparaît. Se tromper coûte un terminal de trop,
   * jamais une commande écrasée.
   *
   * Une référence, pas un state : personne ne l'affiche.
   */
  const occupees = useRef<Set<string>>(new Set())
  /**
   * L'écriture qui attend l'ouverture d'un shell.
   *
   * `openShell()` rend sa clé tout de suite mais son pty n'existe qu'après
   * l'aller-retour IPC. Sans ce relais, le texte retomberait sur la session
   * Claude et partirait chez elle.
   */
  const enAttente = useRef<{ key: string; text: string; label: string } | null>(null)
  // Compteur de publication : un signal ne change pas les dépendances de
  // l'effet ci-dessous, il faut le lui dire.
  const [signaux, setSignaux] = useState(0)
  /** Onglet dont le libellé est en cours de saisie. */
  const [renomme, setRenomme] = useState<string | null>(null)

  const {
    sessions,
    allSessions,
    active,
    setActive,
    attach,
    openShell,
    closeShell,
    renommer,
    reinitialiser,
    errors,
    focusSession,
    cibler,
    claudeKey,
    available,
    ptyIds,
  } = useTerminals(snapshot?.root ?? null, themeMode, (sessionKey, event) => {
    const { kind, detail } = event
    const projet = sessionKey.slice(0, Math.max(0, sessionKey.lastIndexOf('#')))
    // Le nom du dossier plutôt que celui du registre : la notification peut
    // venir d'un projet qui n'est pas l'affiché, dont le snapshot n'est pas là.
    const nom = projet.split('/').filter(Boolean).pop() ?? projet

    // La barre de menu reçoit tout, y compris ce qui est sous les yeux : elle
    // affiche un état, pas un événement, et une session en attente doit y
    // figurer même si sa fenêtre est au premier plan.
    //
    // Seul le signal est retenu ici ; la publication est faite par l'effet
    // plus bas, qui sait aussi quelles sessions tournent. `ptyId` n'est pas
    // relu de ce signal : il vient de `ptyIds`, qui fait autorité.
    // Une conversation repartie de zéro : l'onglet rend son nom et n'a plus
    // rien à annoncer. `reset` n'est pas un état, il en efface un.
    if (kind === 'reset') {
      etat.current.reinitialiser(sessionKey)
      const { [sessionKey]: _efface, ...reste } = attentions.current
      attentions.current = reste
      setSignaux(n => n + 1)
      return
    }

    attentions.current = { ...attentions.current, [sessionKey]: { kind, detail, at: Date.now() } }
    setSignaux(n => n + 1)

    // La demande envoyée nomme l'onglet : c'est le seul moment où elle est
    // connue. `manuel: false` — un onglet nommé au double-clic garde son nom.
    if (kind === 'busy') {
      if (detail) etat.current.renommer(sessionKey, etiquetteDe(detail), { manuel: false })
      // Et rien de plus : une notification système au départ d'un tour
      // annoncerait à l'utilisateur ce qu'il vient lui-même de demander.
      return
    }

    // Rien à signaler si la session est sous les yeux : la notification
    // doublonnerait ce que l'utilisateur est déjà en train de regarder.
    if (sessionKey === etat.current.active && document.hasFocus()) return
    if (typeof Notification === 'undefined') return

    const titre = t(kind === 'question' ? 'terminal.notify_question' : 'terminal.notify_stop')

    // `tag` : une session qui signale deux fois remplace sa notification au
    // lieu d'en empiler une seconde. Le détail, quand le hook en a joint un,
    // dit *quelle* permission est demandée — « une question » ne suffit pas
    // pour décider sans revenir à la fenêtre.
    const notification = new Notification(titre, {
      body: detail ? `${nom} — ${detail}` : nom,
      tag: sessionKey,
    })
    notification.onclick = () => {
      window.ovrsee?.app.focus()
      etat.current.cibler(sessionKey)
      if (projet) onProjet(projet)
    }
  },
  // Une frappe dans une session qui attendait une réponse *est* la réponse :
  // l'invite de permission se referme et Claude repart. Aucun signal ne le dit
  // — `UserPromptSubmit` ne concerne que les demandes tapées dans la
  // conversation — et la pastille serait restée sur « attend une réponse »,
  // masquée sur l'onglet actif, donc muette pendant tout le travail qui suit.
  sessionKey => {
    // Taper dans une session, c'est en reprendre la main : la commande qu'on y
    // avait lancée ne la réserve plus.
    occupees.current.delete(sessionKey)

    if (attentions.current[sessionKey]?.kind !== 'question') return
    // Sans détail : renommer l'onglet d'après une touche n'aurait aucun sens.
    attentions.current = {
      ...attentions.current,
      [sessionKey]: { kind: 'busy', detail: null, at: Date.now() },
    }
    setSignaux(n => n + 1)
  })

  etat.current = { active, cibler, renommer, reinitialiser, onProjet }

  // Rempli à chaque rendu, vidé au démontage : `App` lit l'absence comme « le
  // panneau n'est pas là », et ⌘W retombe alors sur la fermeture de fenêtre.
  if (actions) {
    actions.current = {
      focus: () => Boolean(document.activeElement?.closest('.xterm')),
      ouvrirShell: openShell,
      // La session Claude n'est pas fermable : c'est le panneau lui-même.
      fermerActif: active && active !== claudeKey ? () => closeShell(active) : null,
    }
  }
  useEffect(() => () => {
    if (actions) actions.current = null
  }, [actions])

  /**
   * Ce que la barre de menu affiche : les sessions Claude dont le pty tourne
   * vraiment, plus le résumé du projet quand il n'y en a aucune.
   *
   * Filtré sur `ptyIds` et pas sur `allSessions` : un onglet dont le terminal
   * n'a jamais été monté n'a pas de pty, et sa carte proposerait d'écrire dans
   * le vide. Une session fermée en sort d'elle-même, sans élagage séparé.
   */
  const ouvertes = allSessions
    .filter(session => session.kind === 'claude' && ptyIds[session.key])
    .map(session => {
      const projet = session.key.slice(0, Math.max(0, session.key.lastIndexOf('#')))
      return {
        sessionKey: session.key,
        ptyId: ptyIds[session.key],
        projet,
        // Le nom du dossier plutôt que celui du registre : une session peut
        // venir d'un projet qui n'est pas l'affiché, dont le snapshot est absent.
        nom: projet.split('/').filter(Boolean).pop() ?? projet,
      }
    })

  const projet = resumeProjet(snapshot)

  // `JSON.stringify` comme clé de dépendance : `ouvertes` et `projet` sont
  // reconstruits à chaque rendu, et les comparer par référence republierait
  // sans fin. Les deux sont petits — quelques sessions, une poignée de champs.
  const publie = JSON.stringify({ ouvertes, projet, signaux })
  useEffect(() => {
    const sessions = composer(ouvertes, attentions.current)
    onSessions(sessions)
    void window.ovrsee?.menubar?.report({ sessions, projet })
    // `ouvertes` et `projet` sont dans `publie` ; les lister aussi rendrait
    // l'effet dépendant de références neuves à chaque rendu. `onSessions` non
    // plus : `App` la redéfinit à chaque rendu et l'effet republierait sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publie])

  // Panneau replié : plus aucun pty n'est écouté, donc plus aucun état à
  // montrer. La barre de menu, elle, garde le sien — c'est `tray.js` qui le
  // retient, et le vider ici viderait le popover à chaque repli.
  useEffect(
    () => () => onSessions([]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // « Ouvrir la session » depuis le popover : même chemin que le clic sur une
  // notification, la fenêtre étant déjà ramenée au premier plan par `tray.js`.
  //
  // Abonnement unique, et tout passe par `etat.current` : dépendre de
  // `onProjet` réabonnerait à chaque rendu du panneau, pour un écouteur qui
  // n'a besoin que de la version la plus récente.
  useEffect(
    () =>
      window.ovrsee?.menubar?.onReveal(sessionKey => {
        etat.current.cibler(sessionKey)
        const projet = sessionKey.slice(0, Math.max(0, sessionKey.lastIndexOf('#')))
        if (projet) etat.current.onProjet(projet)
      }),
    [],
  )

  const error = active ? (errors[active] ?? null) : null

  // Tirer vers le haut agrandit le panneau du bas ; tirer vers la gauche
  // agrandit celui du côté. D'où `invert` dans les deux cas.
  //
  // Les tailles initiales viennent des préférences, et la callback met à jour
  // le state parent au lieu du localStorage.
  const height = useResizable({
    key: 'terminal.bottom',
    initial: terminalHeight,
    min: 120,
    max: () => window.innerHeight * 0.7,
    axis: 'y',
    invert: true,
    onResize: onTerminalHeightChange,
  })
  const widthSide = useResizable({
    key: 'terminal.side',
    initial: terminalWidth,
    min: 320,
    max: () => window.innerWidth * 0.7,
    axis: 'x',
    invert: true,
    onResize: onTerminalWidthChange,
  })

  const sizing = layout === 'side' ? widthSide : height

  /**
   * Les tailles épinglées à une page.
   *
   * Le magasin est relu une fois au montage : personne d'autre que ce panneau
   * n'y écrit, et le panneau est démonté dès qu'on le replie.
   */
  const [pins, setPins] = useState<Pins>(readPins)
  const epingle = pinFor(pins, tab, layout)

  /**
   * La bande de commandes est-elle déployée ?
   *
   * `localStorage` et pas les préférences : c'est une habitude de poste, comme
   * la rétractation de la barre latérale (`App.tsx`) et les épingles de taille
   * — la faire transiter par l'API coûterait un schéma et un aller-retour pour
   * un booléen qui ne quitte jamais la machine. Le stockage peut lever (mode
   * privé) : le défaut est « déployée ».
   */
  const [bandeOuverte, setBandeOuverte] = useState(() => {
    try {
      return localStorage.getItem('ovrsee.terminal.actions') !== 'ferme'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ovrsee.terminal.actions', bandeOuverte ? 'ouvert' : 'ferme')
    } catch {
      /* Rien à faire : la préférence ne survivra pas à la session. */
    }
  }, [bandeOuverte])

  /**
   * Arriver sur une page pose sa taille : la sienne si elle est épinglée, la
   * taille globale sinon — sans quoi la hauteur d'une page épinglée suivrait
   * sur toutes les autres.
   *
   * La restauration est silencieuse : `App` prendrait sinon une arrivée pour
   * un geste et écrirait la taille d'une seule page dans les préférences
   * (voir `setSizeQuiet`).
   *
   * Elle ne se déclenche qu'au **changement de page ou de disposition**, jamais
   * sur l'épingle elle-même : poser ou retirer une épingle ne doit rien faire
   * bouger sous les yeux. Dépinglé, le panneau garde la taille qu'il a ; c'est
   * seulement le séparateur qui redevient vivant.
   */
  const restaurer = sizing.setSizeQuiet
  const globale = layout === 'side' ? terminalWidth : terminalHeight
  const cle = pinKey(tab, layout)
  const pageVue = useRef(cle)
  // Les épingles et la taille globale sont lues au moment de l'arrivée, pas
  // suivies : les faire entrer dans les dépendances relancerait l'effet à
  // chaque image d'un glissement.
  const aLArrivee = useRef({ epingle, globale })
  aLArrivee.current = { epingle, globale }

  useEffect(() => {
    if (pageVue.current === cle) return
    pageVue.current = cle
    const { epingle: retenue, globale: defaut } = aLArrivee.current
    restaurer(retenue ?? defaut)
  }, [cle, restaurer])

  // Dépingler ne fait pas sauter le panneau : la taille courante reste, seul
  // le séparateur redevient vivant.
  const basculerEpingle = () => {
    const suivant = togglePin(pins, tab, layout, sizing.size)
    setPins(suivant)
    writePins(suivant)
  }

  /** Dépose le texte dans une session : validé si c'est une commande. */
  const ecrire = (key: string, text: string, part: boolean): boolean => {
    const ptyId = ptyIds[key] ?? null
    if (!(part ? submitTo(ptyId, text) : pasteTo(ptyId, text))) return false
    // Ce qu'on vient de lancer occupe la session jusqu'à ce qu'on y tape.
    if (part) occupees.current.add(key)
    setActive(key)
    // Après le rendu : une session inactive est `inert`, et `focus()` n'y
    // prend pas tant que React n'a pas commis le changement d'onglet.
    setTimeout(() => focusSession(key), 0)
    return true
  }

  const annoncer = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 2000)
  }

  /**
   * Un clic écrit dans le terminal affiché quand il y en a un, et copie sinon.
   *
   * Ce que fait le clic dépend de la commande, et `decideInjection` le dit
   * depuis toujours — la pastille de chaque ligne le montre. Une commande
   * (`!…`, `/…`) **part** ; le reste se colle sans être validé, pour laisser
   * ajouter le contexte qu'on voulait lui joindre. Le curseur suit dans les
   * deux cas, sinon il faudrait cliquer dans la grille pour compléter.
   *
   * Une commande qui part ne s'écrit pas par-dessus ce qui tourne : session
   * occupée, elle ouvre son propre terminal. Le choix vit dans
   * `cibleDeCommande` (`pty.ts`), à part et testé.
   *
   * Le repli n'est pas un pis-aller déguisé : le libellé du panneau change
   * aussi, pour que le bouton ne prétende jamais écrire dans une session
   * inexistante.
   */
  const activate = async (label: string, text: string) => {
    const part = decideInjection(text).mode === 'command'
    // Le texte brut, jamais celui de `decideInjection` : son `\n` de mode
    // `command` ferait un retour de trop derrière le `\r` de `submitTo`.
    const ou = cibleDeCommande({
      mode: part ? 'command' : 'context',
      actif: active,
      claudeKey,
      ptyIds,
      occupees: occupees.current,
    })

    if (ou && 'neuf' in ou) {
      const key = openShell()
      if (key) {
        // Le pty n'existe pas encore : l'effet plus bas écrira dès qu'il paraît.
        // La session n'est marquée occupée qu'à l'écriture, pas ici : son pty
        // n'existe pas encore, et l'effet d'élagage plus bas retirerait la
        // marque avant même que la commande soit partie.
        enAttente.current = { key, text, label }
        return
      }
    } else if (ou && ecrire(ou.cible, text, part)) {
      annoncer(part ? `« ${label} » lancé dans le terminal` : `« ${label} » écrit dans le terminal`)
      return
    }

    // Repli : pas de session (navigateur)
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`« ${label} » copié`)
      setTimeout(() => setNotice(null), 2000)
    } catch {
      setNotice(t('navigateur.copy_failed'))
      setTimeout(() => setNotice(null), 2000)
    }
  }

  /**
   * Écrit la commande qui attendait l'ouverture d'un shell.
   *
   * `ptyIds` est un state : la clé y apparaît au retour de `pty:open`, et c'est
   * le seul moment où l'écriture peut aboutir. Le `setTimeout` laisse au XTerm
   * le temps de s'attacher — écrire dans un pty dont la grille n'est pas encore
   * montée fait perdre l'écho de la ligne.
   */
  useEffect(() => {
    const attente = enAttente.current
    if (!attente || !ptyIds[attente.key]) return
    enAttente.current = null
    const timer = setTimeout(() => {
      if (submitTo(ptyIds[attente.key] ?? null, attente.text)) {
        occupees.current.add(attente.key)
        focusSession(attente.key)
        annoncer(`« ${attente.label} » lancé dans un nouveau terminal`)
      }
    }, 60)
    return () => clearTimeout(timer)
    // `focusSession` et `annoncer` sont stables pour ce qui nous intéresse ;
    // les lister relancerait l'effet à chaque rendu du panneau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptyIds])

  /** Un pty disparu ne réserve plus rien — session fermée, ou morte. */
  useEffect(() => {
    for (const key of occupees.current) if (!ptyIds[key]) occupees.current.delete(key)
  }, [ptyIds])

  // Construit les actions livrées et personnalisées quand les paramètres sont disponibles
  const allActions = settings ? buildActions(snapshot, settings) : []

  // Une seule liste, plus deux sections. Le tri en « Commandes » et « Contexte
  // pour Claude » était syntaxique — un `pnpm run dev` sans `!` tombait sous
  // « Contexte », ce qu'il n'est pas (issue #79). Ce qui distingue vraiment
  // deux actions, c'est ce qui se passe au clic : `decideInjection` le dit, et
  // une pastille par ligne le montre.
  const actionsListe = allActions.filter((a): a is { label: string; text: string } => !('error' in a))
  const actionErrors = allActions.filter((a): a is { label: string; error: string } => 'error' in a)
  const icones = iconeCommande()

  return (
    <>
      {layout !== 'full' && (
        <Divider
          axis={layout === 'side' ? 'x' : 'y'}
          resizable={sizing}
          locked={epingle !== undefined}
          lockedTitle={t('terminal.pinned')}
        />
      )}
      <div style={s(panelStyle(layout, sizing.size))}>
      <div
        style={s(
          'height: 36px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--color-border-chrome);',
        )}
      >
        {/* Une pastille par session. Le shell nu sert à lancer un serveur de
            dev ou à suivre des logs sans occuper la session Claude. */}
        <div style={s('display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden;')}>
          {sessions.map(session => {
            // Un travail en cours vaut aussi pour l'onglet qu'on regarde : voir
            // battre les points est le seul moyen de savoir que Claude n'a pas
            // fini. La coche et la question, elles, ont été vues dès qu'on est
            // sur l'onglet.
            //
            // Le `reset` est écarté au typage : il n'est jamais rangé dans
            // `attentions`, il en sort les entrées.
            const brut = attentions.current[session.key]
            const genre = brut && brut.kind !== 'reset' ? brut.kind : null
            const attente = genre && (genre === 'busy' || active !== session.key) ? genre : null
            const dit = attente ? t(DIT_ATTENTION[attente]) : undefined

            return (
            <div
              key={session.key}
              style={s(
                'display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px 0 10px; border-radius: 6px; ' +
                  (active === session.key ? 'background: var(--color-surface-active);' : 'background: transparent;'),
              )}
            >
              <Etat kind={attente ?? undefined} actif={active === session.key} dit={dit} />
              {renomme === session.key ? (
                <input
                  autoFocus
                  className="input"
                  defaultValue={session.label}
                  aria-label={t('terminal.rename_aria', { label: session.label })}
                  onBlur={() => setRenomme(null)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      renommer(session.key, event.currentTarget.value)
                      setRenomme(null)
                    }
                    if (event.key === 'Escape') setRenomme(null)
                  }}
                  style={s('width: 90px; height: 18px; font-family: var(--font-mono); font-size: 11.5px; padding: 0 4px;')}
                />
              ) : (
              <button
                type="button"
                title={t('terminal.rename')}
                onClick={() => {
                  // Un onglet qu'on ouvre a été vu : son signal a fini de
                  // servir, et le garder allumé ferait mentir la pastille.
                  //
                  // Sauf « au travail » : celui-là n'est pas une notification
                  // qu'on acquitte, c'est un état qui dure. L'effacer au clic
                  // rendait la pastille muette pendant que Claude réfléchissait,
                  // jusqu'au `Stop` suivant (issue #53).
                  const vu = attentions.current[session.key]
                  if (vu && vu.kind !== 'busy') {
                    const { [session.key]: _vu, ...reste } = attentions.current
                    attentions.current = reste
                    setSignaux(n => n + 1)
                  }
                  setActive(session.key)
                }}
                onDoubleClick={() => setRenomme(session.key)}
                style={s(
                  'cursor: pointer; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .02em; padding: 0; border: 0; background: transparent; color: ' +
                    (active === session.key ? 'var(--color-text);' : 'var(--color-text-tertiary);'),
                )}
              >
                {session.label}
              </button>
              )}
              {session.kind !== 'claude' && (
                <button
                  type="button"
                  title={t('terminal.close_session')}
                  aria-label={t('terminal.close_session_aria', { label: session.label })}
                  onClick={() => closeShell(session.key)}
                  style={s(
                    'cursor: pointer; border: 0; background: transparent; color: var(--color-text-quaternary); font-size: 12px; line-height: 1; padding: 0;',
                  )}
                >
                  ×
                </button>
              )}
            </div>
            )
          })}
          <button
            type="button"
            onClick={openShell}
            title={t('terminal.open_shell')}
            aria-label={t('terminal.open_shell')}
            disabled={!available}
            style={s(
              'cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border-radius: 6px; border: 0; background: transparent;',
            )}
          >
            <Plus size={13} weight="regular" aria-hidden="true" color="var(--color-text-discrete)" />
          </button>
        </div>

        <div style={s('flex: 1;')} />
        {/* Le libellé « Disposition » ne disparaît pas, il change de support :
            il nomme le groupe pour les lecteurs d'écran, et chaque carré garde
            son infobulle. La barre y gagne les 190 px que prenaient le kicker
            et les trois mots. */}
        <div className="seg" role="radiogroup" aria-label={t('terminal.layouts')}>
          {LAYOUT_IDS.map(id => {
            const Icone = LAYOUT_ICONS[id]
            return (
              <label key={id} className="seg-opt" style={s(SEG_ICONE)} title={layoutLabel(id)}>
                <input
                  type="radio"
                  name="terminal-layout"
                  aria-label={layoutLabel(id)}
                  checked={layout === id}
                  onChange={() => onLayout(id)}
                />
                <Icone size={13} weight="fill" aria-hidden="true" />
              </label>
            )
          })}
        </div>
        {/* Rien à épingler en « plein » : le panneau n'y a pas de taille propre. */}
        {layout !== 'full' && (
          <button
            type="button"
            className="btn-icon"
            onClick={basculerEpingle}
            aria-pressed={epingle !== undefined}
            title={t(epingle !== undefined ? 'terminal.unpin' : 'terminal.pin')}
            aria-label={t(epingle !== undefined ? 'terminal.unpin' : 'terminal.pin')}
            style={s(
              'cursor: pointer; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 6px; ' +
                (epingle !== undefined
                  ? 'background: var(--color-surface-active);'
                  : 'background: transparent;'),
            )}
          >
            <PushPin
              size={14}
              weight={epingle !== undefined ? 'fill' : 'regular'}
              aria-hidden="true"
              color={epingle !== undefined ? 'var(--color-accent)' : 'var(--color-text-quaternary)'}
            />
          </button>
        )}
        <button
          type="button"
          className="btn-icon"
          onClick={onToggle}
          title={t('terminal.reduce')}
          aria-label={t('terminal.reduce')}
          style={s(
            'cursor: pointer; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent;',
          )}
        >
          <Minus size={14} aria-hidden="true" color="var(--color-text-quaternary)" />
        </button>
      </div>

      <div
        style={s(
          layout === 'side'
            ? 'flex: 1; display: flex; flex-direction: column; min-height: 0;'
            : 'flex: 1; display: flex; min-height: 0;',
        )}
      >
        {available && (
          // Session réelle : xterm occupe la zone, `claude` tourne derrière.
          //
          // Les sessions sont empilées et toutes montées — celles du projet
          // affiché comme celles des autres projets déjà visités — l'inactive
          // rendue transparente. Pas `display: none` : un conteneur de largeur
          // nulle fait calculer à FitAddon une grille fausse, et `claude` se
          // réafficherait de travers au retour sur l'onglet ou sur le projet.
          <div style={s('flex: 1; min-width: 0; min-height: 0; position: relative;')}>
            {allSessions.map(session => (
              <div
                key={session.key}
                ref={attach(session)}
                // `inert` va avec la transparence : sans lui, la zone de saisie
                // d'une session cachée reste dans l'ordre de tabulation, et le
                // clavier traverse des terminaux qu'on ne voit pas. `inert` ne
                // touche pas à la mise en page, donc FitAddon continue de
                // mesurer juste — c'est pourquoi on ne peut pas juste passer en
                // `display: none`.
                inert={active !== session.key}
                style={s(
                  'position: absolute; inset: 8px 4px 8px 10px; ' +
                    (active === session.key
                      ? 'opacity: 1; z-index: 1;'
                      : 'opacity: 0; pointer-events: none; z-index: 0;'),
                )}
              />
            ))}
          </div>
        )}

        {/* Sans passerelle IPC — c'est-à-dire dans un navigateur — pas de
            terminal. On le dit, plutôt que d'afficher une invite qui ne
            répondrait jamais. */}
        <div
          hidden={available}
          style={s(
            'flex: 1; overflow: auto; padding: 12px 14px; font-family: var(--font-mono); font-size: 12px; line-height: 1.75; min-width: 0;',
          )}
        >
          {briefLines(snapshot).map((line, i) => (
            <div key={i} style={s(line.style)}>
              {line.text || ' '}
            </div>
          ))}
          <div style={s('display: flex; align-items: center; gap: 7px; color: var(--color-text-quaternary);')}>
            <span style={s('color: var(--color-text-faint);')}>›</span>
            <span>{t('terminal.no_terminal_browser')}</span>
          </div>
        </div>

        {/* Le panneau est toujours rendu, dans l'une de deux formes : déployé,
            ou réduit à une bande qui ne porte que son bouton. Le faire
            disparaître ne laissait rien à l'écran pour dire qu'il existe, et
            son bouton vivait dans la barre d'outils du terminal — loin de ce
            qu'il commande (T-0225). */}
        {!bandeOuverte ? (
          <div
            style={s(
              (layout === 'side'
                ? 'height: 28px; border-top: 1px solid var(--color-border-chrome);'
                : 'width: 28px; border-left: 1px solid var(--color-border-chrome);') +
                ' flex: none; display: flex; align-items: center; justify-content: center; padding: 4px;',
            )}
          >
            <BoutonBande ouverte={false} layout={layout} onToggle={() => setBandeOuverte(true)} />
          </div>
        ) : (
        <div
          style={s(
            layout === 'side'
              ? 'flex: none; border-top: 1px solid var(--color-border-chrome); padding: 12px 14px;'
              : 'width: 268px; flex: none; border-left: 1px solid var(--color-border-chrome); padding: 12px 14px; overflow: auto;',
          )}
        >
          {/* La session s'ouvre pour tout projet du registre — c'est ce qui
              permet de l'équiper depuis le terminal. Mais sans `ovrsee/`, rien
              de ce qui s'y passe n'est capté : le dire ici plutôt que de laisser
              croire que les plans sont enregistrés. */}
          {snapshot && !snapshot.equipped && (
            <div
              style={s(
                'font-size: 11px; color: var(--color-warn); background: var(--color-warn-bg); border: 1px solid var(--color-warn-border); border-radius: 6px; padding: 6px 8px; margin-bottom: 12px;',
              )}
            >
              <div style={s('font-weight: 500;')}>{t('terminal.not_equipped')}</div>
              <div>{t('terminal.not_equipped_desc')}</div>
            </div>
          )}

          <div style={s('display: flex; align-items: center; gap: 8px;')}>
            <div
              style={s(
                'flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-discrete);',
              )}
            >
              {t('terminal.actions_section')}
            </div>
            <BoutonBande ouverte layout={layout} onToggle={() => setBandeOuverte(false)} />
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
            {actionsListe.map(action => {
              const Icone = icones[action.label]
              // La pastille de mode dit ce qui arrive au clic : partir tout de
              // suite, ou s'écrire et attendre. Elle reste en gris pour ne pas
              // concurrencer l'icône d'accent des commandes livrées.
              const part = decideInjection(action.text).mode === 'command'
              const Mode = part ? Play : PencilSimple
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => activate(action.label, action.text)}
                  style={s(
                    'cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
                  )}
                  title={`${action.text} — ${t(part ? 'terminal.mode_run' : 'terminal.mode_paste')}`}
                >
                  <Mode
                    size={12}
                    weight={part ? 'fill' : 'regular'}
                    aria-hidden="true"
                    color="var(--color-text-quaternary)"
                    style={{ flex: 'none' }}
                  />
                  {Icone && <Icone size={14} weight="regular" aria-hidden="true" color="var(--color-accent)" />}
                  <span style={s('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
                    {action.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* La fonctionnalité était invisible : il fallait savoir aller dans
              les préférences pour deviner qu'on pouvait en ajouter (issue #79). */}
          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              style={s(
                'cursor: pointer; display: flex; align-items: center; gap: 7px; width: 100%; height: 28px; margin-top: 7px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px dashed var(--color-border-control); background: transparent; color: var(--color-text-quaternary);',
              )}
            >
              <Plus size={12} weight="bold" aria-hidden="true" style={{ flex: 'none' }} />
              {t('terminal.create_action')}
            </button>
          )}

          {/* Affiche les erreurs si présentes */}
          {actionErrors.length > 0 && (
            <div style={s('display: flex; flex-direction: column; gap: 6px; margin-top: 12px;')}>
              {actionErrors.map(err => (
                <div
                  key={err.label}
                  style={s(
                    'font-size: 11px; color: var(--color-err); background: var(--color-err-bg); border: 1px solid var(--color-err-border); border-radius: 6px; padding: 6px 8px;',
                  )}
                >
                  <div style={s('font-weight: 500;')}>{err.label}</div>
                  <div>{err.error}</div>
                </div>
              ))}
            </div>
          )}

          {/* Hors de la liste : ce bouton n'écrit rien dans le terminal, il
              fait relire `ovrsee/` à l'interface. Le ranger avec les commandes
              laissait croire qu'il lançait quelque chose. */}
          <div style={s('margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border-chrome);')}>
            <button
              type="button"
              onClick={onReload}
              style={s(
                'cursor: pointer; display: flex; align-items: center; width: 100%; height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
              )}
            >
              {t('terminal.refresh_ovrsee')}
            </button>
            <div style={s('font-size: 11px; color: var(--color-text-quaternary); margin-top: 6px; line-height: 1.5;')}>
              {t('terminal.reload_hint')}
            </div>
          </div>

          <div style={s('font-size: 11px; color: var(--color-text-quaternary); margin-top: 13px; line-height: 1.5;')}>
            {notice ??
              (error
                ? error
                : available
                  ? t('terminal.click_injects')
                  : t('terminal.click_copies'))}
          </div>
        </div>
        )}
      </div>
      </div>
    </>
  )
}
