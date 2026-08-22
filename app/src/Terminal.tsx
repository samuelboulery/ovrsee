import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Check, GitFork, NotePencil, Plus, Question, type IconProps } from '@phosphor-icons/react'

import { briefLines, buildActions, type Snapshot, type SettingsType } from './data'
import { etiquetteDe, type AttentionKind } from './attention'
import { composer, resumeProjet, type MenuBarAttention } from './menubar'
import { s } from './style'
import { t, type TranslationKey } from './i18n'
import { useTerminals, pasteTo } from './useTerminal'
import { Divider, useResizable } from './useResizable'

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
 * Ce que chaque genre de signal annonce, pour le titre et le lecteur d'écran.
 *
 * `reset` n'y est pas : il efface un état au lieu d'en poser un, et n'atteint
 * jamais le rendu.
 */
type EtatAffichable = Exclude<AttentionKind, 'reset'>

const DIT_ATTENTION: Record<EtatAffichable, TranslationKey> = {
  busy: 'terminal.attention_busy',
  stop: 'terminal.attention_stop',
  question: 'terminal.attention_question',
}

/**
 * L'état d'une session, dans une case de largeur fixe.
 *
 * Fixe pour que passer de trois points à une coche ne fasse pas danser la
 * rangée d'onglets. Trois points qui battent pendant le travail, une coche
 * quand Claude rend la main, un point d'interrogation quand il attend une
 * réponse — l'animation vit dans `_ds/ovrsee/styles.css` (`.battement`), seul
 * endroit où une @keyframes peut être déclarée.
 */
function Etat({
  kind,
  actif,
  dit,
}: {
  kind?: EtatAffichable
  actif: boolean
  /** Ce que le signal annonce, ou undefined quand il n'y a rien à annoncer. */
  dit?: string
}) {
  const commun = { role: dit ? 'status' : undefined, 'aria-label': dit, title: dit }
  const boite = 'width: 12px; flex: none; display: flex; align-items: center; justify-content: center; gap: 2px;'

  if (kind === 'busy') {
    return (
      <span {...commun} style={s(boite)}>
        {[0, 160, 320].map(retard => (
          <span
            key={retard}
            className="battement"
            style={s(
              `width: 2px; height: 2px; border-radius: 50%; background: var(--color-accent); animation-delay: ${retard}ms;`,
            )}
          />
        ))}
      </span>
    )
  }

  if (kind === 'stop' || kind === 'question') {
    const Icone = kind === 'stop' ? Check : Question
    return (
      <span {...commun} style={s(boite)}>
        <Icone
          size={11}
          weight="bold"
          aria-hidden="true"
          color={kind === 'stop' ? 'var(--color-ok)' : 'var(--color-accent)'}
        />
      </span>
    )
  }

  return (
    <span style={s(boite)}>
      <span
        style={s(
          `width: 5px; height: 5px; border-radius: 50%; background: ${actif ? 'var(--color-accent)' : 'var(--color-text-ghost)'};`,
        )}
      />
    </span>
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
  actions,
}: {
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
  } = useTerminals(snapshot?.root ?? null, (sessionKey, event) => {
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
    void window.ovrsee?.menubar?.report({
      sessions: composer(ouvertes, attentions.current),
      projet,
    })
    // `ouvertes` et `projet` sont dans `publie` ; les lister aussi rendrait
    // l'effet dépendant de références neuves à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publie])

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
   * Un clic écrit dans le terminal affiché quand il y en a un, et copie sinon.
   *
   * L'onglet actif, et pas la session `claude` : un raccourci cliqué depuis un
   * shell nu partait chez `claude` et volait l'onglet au passage, alors que le
   * geste désigne le terminal qu'on a sous les yeux (issue #49). La session
   * `claude` reste le repli quand aucun onglet n'a de pty — c'est le cas au tout
   * premier rendu, avant que `pty:open` ait répondu.
   *
   * Tout passe par le collage encadré, commandes comprises : le texte se dépose
   * dans la saisie sans être validé. C'est délibéré — une commande qui partait
   * au clic ne laissait aucune place au contexte qu'on voulait lui ajouter. Le
   * curseur suit, sinon il faudrait cliquer dans la grille pour compléter.
   *
   * Le repli n'est pas un pis-aller déguisé : le libellé du panneau change
   * aussi, pour que le bouton ne prétende jamais écrire dans une session
   * inexistante.
   */
  const activate = async (label: string, text: string) => {
    const cible = active && ptyIds[active] ? active : claudeKey
    if (cible && pasteTo(ptyIds[cible] ?? null, text)) {
      setActive(cible)
      // Après le rendu : une session inactive est `inert`, et `focus()` n'y
      // prend pas tant que React n'a pas commis le changement d'onglet.
      setTimeout(() => focusSession(cible), 0)
      setNotice(`« ${label} » écrit dans le terminal`)
      setTimeout(() => setNotice(null), 2000)
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

  // Construit les actions livrées et personnalisées quand les paramètres sont disponibles
  const allActions = settings ? buildActions(snapshot, settings) : []

  // Sépare les actions en deux catégories : commandes (! ou /) et contexte (texte brut)
  const commands = allActions.filter((a): a is { label: string; text: string } => {
    if ('error' in a) return false // Ignore les erreurs pour le classement
    return a.text.startsWith('!') || a.text.startsWith('/')
  })
  const context = allActions.filter((a): a is { label: string; text: string } => {
    if ('error' in a) return false
    return !a.text.startsWith('!') && !a.text.startsWith('/')
  })
  const actionErrors = allActions.filter((a): a is { label: string; error: string } => 'error' in a)
  const icones = iconeCommande()

  return (
    <>
      {layout !== 'full' && <Divider axis={layout === 'side' ? 'x' : 'y'} resizable={sizing} />}
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
        <span className="kicker">{t('terminal.layouts')}</span>
        <div className="seg">
          {LAYOUT_IDS.map(id => (
            <label key={id} className="seg-opt">
              <input
                type="radio"
                name="terminal-layout"
                checked={layout === id}
                onChange={() => onLayout(id)}
              />
              {layoutLabel(id)}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggle}
          style={s('cursor: pointer; border: 0; background: transparent; font-size: 11.5px; color: var(--color-text-quaternary);')}
        >
          {t('terminal.reduce')}
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

        <div
          style={s(
            layout === 'side'
              ? 'flex: none; border-top: 1px solid var(--color-border-chrome); padding: 12px 14px;'
              : 'width: 268px; flex: none; border-left: 1px solid var(--color-border-chrome); padding: 12px 14px;',
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

          {/* Section : Commandes pour Claude */}
          <div
            style={s(
              'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-discrete);',
            )}
          >
            {t('terminal.commands_section')}
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
            {commands.map(action => {
              const Icone = icones[action.label]
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => activate(action.label, action.text)}
                  style={s(
                    'cursor: pointer; display: flex; align-items: center; gap: 8px; height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
                  )}
                  title={action.text}
                >
                  {Icone && <Icone size={14} weight="regular" aria-hidden="true" color="var(--color-accent)" />}
                  {action.label}
                </button>
              )
            })}
          </div>

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

          {/* Section : Contexte pour Claude */}
          {context.length > 0 && (
            <>
              <div
                style={s(
                  'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-discrete); margin-top: 18px;',
                )}
              >
                {t('terminal.context_section')}
              </div>
              <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
                {context.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => activate(action.label, action.text)}
                    style={s(
                      'cursor: pointer; display: flex; align-items: center; height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
                    )}
                    title={action.text}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Hors des deux sections : ce bouton n'écrit rien dans le terminal,
              il fait relire `ovrsee/` à l'interface. Le ranger avec les
              commandes laissait croire qu'il lançait quelque chose. */}
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
      </div>
      </div>
    </>
  )
}
