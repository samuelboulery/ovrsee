import { useCallback, useEffect, useRef, useState } from 'react'

import { extractAttention, type AttentionEvent } from './attention'
import { getTerminalTheme } from './theme'
// Les types de la passerelle et les fonctions de collage vivent dans `pty.ts`
// depuis T-0133 : ce module-ci charge xterm, et il est le seul à devoir le faire.
import { claude, terminalBridge, type SessionKind } from './pty'
// WHY: xterm est le terminal de VS Code, pas une imitation. Un rendu maison
// devrait réimplémenter les séquences ANSI, le défilement et la sélection —
// et `claude` s'afficherait de travers au premier cas non couvert.
import { Terminal as XTerm } from '@xterm/xterm'
// WHY: la grille d'un terminal se compte en cellules, pas en pixels. L'addon
// convertit la taille du panneau en lignes/colonnes, ce qui est la seule
// mesure que le pty comprend.
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'


/** Un onglet du panneau : ce que l'interface en montre. */
export interface Session {
  /** Identifiant local, stable tant que l'onglet vit. Pas l'identifiant du pty. */
  key: string
  kind: SessionKind
  label: string
  /**
   * Le nom d'origine, posé à la création et jamais modifié : c'est celui que
   * l'onglet retrouve quand la conversation repart de zéro.
   */
  defaut: string
}

/** Ce qui vit derrière un onglet, hors du rendu React. */
interface Pane {
  xterm: XTerm
  observer: ResizeObserver
  /** Identifiant du pty, connu seulement une fois la session ouverte. */
  id: string | null
  /** Posé dès le démontage : ce qui arrive après ne doit plus rien toucher. */
  gone: boolean
}

const claudeSlot = (project: string): Session => ({
  key: `${project}#claude`,
  kind: 'claude',
  label: 'claude',
  defaut: 'claude',
})

/**
 * Prévenu quand une session réclame l'attention — voir `attention.ts`.
 * Ce hook se contente de repérer le signal dans le flux ; s'il faut notifier,
 * et où le clic renvoie, se décide dans `Terminal.tsx`.
 */
export type OnAttention = (sessionKey: string, event: AttentionEvent, ptyId: string) => void

/**
 * Prévenu quand l'utilisateur tape dans une session.
 *
 * Le hook ne sait pas ce que la frappe veut dire — `Terminal.tsx` le sait : une
 * frappe dans une session qui attendait une réponse *est* la réponse.
 */
export type OnSaisie = (sessionKey: string) => void

/**
 * Ouvre les sessions du panneau et les relie chacune à un xterm.
 *
 * Une session `claude` par projet, ouverte d'office ; autant de shells nus que
 * demandé, pour un serveur de dev ou des logs. Changer de projet change
 * d'onglets dans le panneau — les sessions du projet quitté continuent de
 * tourner, montées hors écran (même motif qu'entre sessions d'un même projet,
 * voir `Terminal.tsx`), et réapparaissent telles quelles au retour.
 */
export function useTerminals(
  projectPath: string | null,
  onAttention?: OnAttention,
  onSaisie?: OnSaisie,
) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Clé de session → identifiant de pty, pour ce qui vit hors du hook.
  //
  // L'identifiant existe déjà dans `panes`, mais c'est une référence : rien ne
  // re-rend quand il apparaît, et la barre de menu ne saurait jamais qu'une
  // session vient de s'ouvrir. Un état, donc, et la présence d'une clé ici
  // veut dire « ce pty tourne » — pas « cet onglet existe ».
  const [ptyIds, setPtyIds] = useState<Record<string, string>>({})

  const panes = useRef(new Map<string, Pane>())
  /** Onglets nommés au double-clic : le nom automatique ne les touche plus. */
  const nommesMain = useRef(new Set<string>())
  const counter = useRef(0)
  // Sessions et onglet actif de chaque projet déjà visité, pour les retrouver
  // sans les rouvrir. `panes` sert déjà de collection inter-projets : les clés
  // portent le chemin du projet, donc aucune collision entre deux projets.
  const sessionsByProject = useRef(new Map<string, Session[]>())
  const activeByProject = useRef(new Map<string, string | null>())
  // Lu par `attach()` pour ne pointer `claude.id` que si le projet de la
  // session qui vient de s'ouvrir est toujours celui affiché — sans ça, changer
  // de projet pendant l'ouverture ferait écrire `pasteToClaude` dans la
  // mauvaise session.
  const activeProjectRef = useRef(projectPath)
  // L'abonnement au flux ne se refait jamais ; sans cette référence il
  // capturerait la callback du premier rendu et notifierait avec un état périmé.
  const attentionRef = useRef(onAttention)
  attentionRef.current = onAttention
  const saisieRef = useRef(onSaisie)
  saisieRef.current = onSaisie
  // Une fonction de référence par session, gardée telle quelle d'un rendu à
  // l'autre : React appelle une référence changeante avec `null` puis avec
  // l'élément, ce qui détruirait et rouvrirait la session à chaque rendu.
  const refs = useRef(new Map<string, (host: HTMLDivElement | null) => void>())

  /** Le pty de cette session vient de mourir ou d'être fermé. */
  const oublieId = useCallback((key: string) => {
    setPtyIds(({ [key]: _parti, ...reste }) => reste)
  }, [])

  // Un seul abonnement pour toutes les sessions : `listen` porte déjà
  // l'identifiant, et deux abonnements écriraient deux fois le même octet.
  // L'effet n'a pas de dépendances — la callback passe donc par une référence,
  // même motif que `activeProjectRef` plus bas.
  useEffect(() => {
    const bridge = terminalBridge()
    if (!bridge) return

    // Fin de séquence en attente, par pty : le signal peut arriver coupé
    // entre deux lectures.
    const carries = new Map<string, string>()

    return bridge.listen(
      (id, data) => {
        const scan = extractAttention(carries.get(id) ?? '', data)
        carries.set(id, scan.carry)

        for (const [key, pane] of panes.current) {
          if (pane.id !== id) continue
          pane.xterm.write(scan.clean)
          for (const event of scan.events) attentionRef.current?.(key, event, id)
        }
      },
      (id, code) => {
        carries.delete(id)
        for (const [key, pane] of panes.current) {
          if (pane.id !== id) continue
          pane.xterm.writeln(`\r\n\x1b[38;5;140m— session terminée (code ${code}) —\x1b[0m`)
          pane.id = null
          oublieId(key)
          if (key.endsWith('#claude')) claude.id = null
        }
      },
    )
  }, [])

  // Changer de projet affiche ses sessions au lieu d'en ouvrir de nouvelles :
  // la première visite amorce une session Claude, les visites suivantes
  // retrouvent ce qui tournait déjà, `active` compris.
  useEffect(() => {
    activeProjectRef.current = projectPath

    if (!projectPath) {
      setSessions([])
      setActive(null)
      claude.id = null
      return
    }

    if (!sessionsByProject.current.has(projectPath)) {
      const first = claudeSlot(projectPath)
      sessionsByProject.current.set(projectPath, [first])
      activeByProject.current.set(projectPath, first.key)
    }

    const projectSessions = sessionsByProject.current.get(projectPath) ?? []
    setSessions(projectSessions)

    const wasActive = activeByProject.current.get(projectPath)
    setActive(
      wasActive && projectSessions.some(s => s.key === wasActive) ? wasActive : claudeSlot(projectPath).key,
    )

    claude.id = panes.current.get(claudeSlot(projectPath).key)?.id ?? null
    setErrors({})
  }, [projectPath])

  /**
   * Référence d'hôte pour une session : crée le xterm au montage, ferme la
   * session au démontage. Tout le cycle de vie tient là — React appelle avec
   * `null` dès que l'onglet disparaît.
   */
  const attach = useCallback((session: Session) => {
    const known = refs.current.get(session.key)
    if (known) return known

    const ref = (host: HTMLDivElement | null) => {
      const bridge = terminalBridge()
      if (!bridge) return

      if (!host) {
        refs.current.delete(session.key)
        const pane = panes.current.get(session.key)
        if (!pane) return
        panes.current.delete(session.key)
        pane.gone = true
        pane.observer.disconnect()
        oublieId(session.key)
        if (pane.id) {
          bridge.close(pane.id)
          if (pane.id === claude.id) claude.id = null
        }
        pane.xterm.dispose()
        return
      }

      if (panes.current.has(session.key) || !projectPath) return

      const xterm = new XTerm({
        // Menlo d'abord : SF Mono rend mal les caractères de cadre dont Claude
        // se sert pour ses encadrés.
        fontFamily: 'Menlo, ui-monospace, SFMono-Regular, monospace',
        fontSize: 12,
        // 1 exactement : au-dessus, les glyphes pleins (█ ▀ ▄) du logo Claude
        // se séparent en bandes.
        lineHeight: 1,
        cursorBlink: true,
        theme: getTerminalTheme(),
        allowProposedApi: true,
      })
      const fit = new FitAddon()
      xterm.loadAddon(fit)
      xterm.open(host)
      fit.fit()

      const pane: Pane = {
        xterm,
        // Le panneau change de taille avec les trois dispositions et avec la
        // fenêtre : sans cela, `claude` afficherait sur une grille fausse.
        observer: new ResizeObserver(() => {
          // Un onglet caché garde sa taille : il est empilé, pas replié.
          if (!host.clientWidth || !host.clientHeight) return
          fit.fit()
          if (pane.id) bridge.resize(pane.id, xterm.cols, xterm.rows)
        }),
        id: null,
        gone: false,
      }
      pane.observer.observe(host)
      panes.current.set(session.key, pane)

      xterm.onData(data => {
        if (!pane.id) return
        saisieRef.current?.(session.key)
        bridge.write(pane.id, data)
      })

      bridge.open(projectPath, session.kind).then(result => {
        if ('error' in result) {
          if (pane.gone) return
          setErrors(before => ({ ...before, [session.key]: result.error }))
          xterm.writeln(`\x1b[38;5;140m${result.error}\x1b[0m`)
          return
        }
        // Démonté pendant l'ouverture : la session existe déjà côté principal,
        // il faut la fermer, sinon elle survit sans personne pour la lire.
        if (pane.gone) {
          bridge.close(result.id)
          return
        }
        pane.id = result.id
        setPtyIds(before => ({ ...before, [session.key]: result.id }))
        // Ne pointer `claude.id` que si le projet de cette session est
        // toujours celui affiché : sinon un changement de projet pendant
        // l'ouverture ferait écrire `pasteToClaude` dans une session cachée.
        if (session.kind === 'claude' && activeProjectRef.current === projectPath) claude.id = result.id
        bridge.resize(result.id, xterm.cols, xterm.rows)
      })
    }

    refs.current.set(session.key, ref)
    return ref
  }, [projectPath, oublieId])

  /** Ouvre un shell nu de plus, et s'y place. */
  const openShell = useCallback((): string | null => {
    if (!projectPath) return null
    const n = ++counter.current
    const session: Session = {
      key: `${projectPath}#shell-${n}`,
      kind: 'shell',
      label: `shell ${n}`,
      defaut: `shell ${n}`,
    }
    const before = sessionsByProject.current.get(projectPath) ?? []
    const after = [...before, session]
    sessionsByProject.current.set(projectPath, after)
    setSessions(after)
    activeByProject.current.set(projectPath, session.key)
    setActive(session.key)
    // La clé est rendue pour qui veut écrire dans ce shell : son pty n'existe
    // pas encore — il apparaîtra dans `ptyIds` après l'aller-retour IPC — et
    // c'est la seule prise pour l'attendre. ⌘D et le bouton « + » l'ignorent.
    return session.key
  }, [projectPath])

  /**
   * Renomme un onglet. Un nom vide garde l'ancien — vider le champ est un
   * geste d'annulation, pas une demande d'onglet sans nom.
   *
   * `manuel` distingue le double-clic du nom déduit de la demande envoyée. Un
   * onglet nommé à la main ne se fait plus jamais renommer tout seul : on l'a
   * appelé « build » pour le retrouver, pas pour le voir changer au prochain
   * tour.
   *
   * Pas de persistance : les sessions ne survivent pas à l'application, et un
   * nom qui leur survivrait désignerait un terminal disparu.
   */
  const renommer = useCallback(
    (key: string, label: string, { manuel = true }: { manuel?: boolean } = {}) => {
      const nom = label.trim()
      if (!projectPath || !nom) return
      if (!manuel && nommesMain.current.has(key)) return
      if (manuel) nommesMain.current.add(key)
      const suite = (sessionsByProject.current.get(projectPath) ?? []).map(session =>
        session.key === key ? { ...session, label: nom } : session,
      )
      sessionsByProject.current.set(projectPath, suite)
      setSessions(suite)
    },
    [projectPath],
  )

  /**
   * Rend à un onglet son nom d'origine — une conversation repartie de zéro ne
   * doit plus annoncer la précédente.
   *
   * Un onglet nommé au double-clic n'est pas touché : on l'a appelé « build »
   * pour le retrouver, et un `/clear` ne défait pas ce choix-là.
   */
  const reinitialiser = useCallback(
    (key: string) => {
      if (!projectPath || nommesMain.current.has(key)) return
      const suite = (sessionsByProject.current.get(projectPath) ?? []).map(session =>
        session.key === key ? { ...session, label: session.defaut } : session,
      )
      sessionsByProject.current.set(projectPath, suite)
      setSessions(suite)
    },
    [projectPath],
  )

  /** Ferme un shell. La session Claude n'est pas fermable : c'est le panneau. */
  const closeShell = useCallback(
    (key: string) => {
      if (!projectPath || key === claudeSlot(projectPath).key) return
      const remaining = (sessionsByProject.current.get(projectPath) ?? []).filter(s => s.key !== key)
      sessionsByProject.current.set(projectPath, remaining)
      setSessions(remaining)
      // Retour sur la session Claude : elle existe toujours, elle ne se ferme
      // pas. Choisir « la dernière restante » demanderait de lire la liste
      // depuis un setter, ce qui la lirait périmée.
      const claudeKey = claudeSlot(projectPath).key
      if (activeByProject.current.get(projectPath) === key) activeByProject.current.set(projectPath, claudeKey)
      setActive(now => (now === key ? claudeKey : now))
      setErrors(({ [key]: _closed, ...rest }) => rest)
    },
    [projectPath],
  )

  /**
   * Place le curseur dans la session désignée.
   *
   * Un bouton qui écrit dans le terminal sans y donner le clavier obligerait à
   * cliquer dans la grille pour compléter la commande — le collage servirait à
   * moitié.
   */
  const focusSession = useCallback((key: string | null) => {
    if (!key) return
    panes.current.get(key)?.xterm.focus()
  }, [])

  /** Change l'onglet actif du projet courant, et s'en souvient pour le retour. */
  const handleSetActive = useCallback(
    (key: string | null) => {
      setActive(key)
      if (!projectPath || !key) return
      activeByProject.current.set(projectPath, key)
      if (key.endsWith('#claude')) claude.id = panes.current.get(key)?.id ?? null
    },
    [projectPath],
  )

  /**
   * Désigne l'onglet à afficher, y compris dans un projet qui n'est pas
   * l'affiché — c'est le cas au clic sur une notification venue d'ailleurs.
   *
   * Passer par `setActive` ne suffirait pas : il inscrit le choix sous le
   * projet **courant**, et l'appelant ne peut pas attendre que le changement
   * de projet ait eu lieu, un état React ne s'applique pas dans le même tour.
   * On écrit donc directement la mémoire du projet visé ; l'effet de
   * changement de projet la relit et se posera sur le bon onglet.
   */
  const cibler = useCallback(
    (key: string) => {
      const separateur = key.lastIndexOf('#')
      if (separateur < 1) return
      const project = key.slice(0, separateur)
      activeByProject.current.set(project, key)
      if (project === projectPath) setActive(key)
    },
    [projectPath],
  )

  // Toutes les sessions de tous les projets visités : `Terminal.tsx` les monte
  // toutes pour ne jamais démonter un onglet caché, seule `sessions`
  // (ci-dessus, celles du projet courant) alimente la barre de pastilles.
  const allSessions = Array.from(sessionsByProject.current.values()).flat()

  return {
    sessions,
    allSessions,
    /**
     * Clé de session → identifiant de pty, pour les sessions qui tournent
     * vraiment. Une clé d'`allSessions` absente d'ici est un onglet dont le
     * terminal n'a jamais été monté.
     */
    ptyIds,
    active,
    setActive: handleSetActive,
    attach,
    openShell,
    closeShell,
    renommer,
    reinitialiser,
    errors,
    focusSession,
    cibler,
    claudeKey: projectPath ? claudeSlot(projectPath).key : null,
    available: Boolean(terminalBridge()),
  }
}
