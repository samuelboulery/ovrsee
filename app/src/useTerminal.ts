import { useCallback, useEffect, useRef, useState } from 'react'

import { getTerminalTheme } from './theme'
// WHY: xterm est le terminal de VS Code, pas une imitation. Un rendu maison
// devrait réimplémenter les séquences ANSI, le défilement et la sélection —
// et `claude` s'afficherait de travers au premier cas non couvert.
import { Terminal as XTerm } from '@xterm/xterm'
// WHY: la grille d'un terminal se compte en cellules, pas en pixels. L'addon
// convertit la taille du panneau en lignes/colonnes, ce qui est la seule
// mesure que le pty comprend.
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/** Genre de session. Le rendu ne nomme jamais de programme — voir `electron/pty.js`. */
export type SessionKind = 'claude' | 'shell'

/**
 * Passerelle exposée par `electron/preload.cjs`.
 *
 * Absente dans un navigateur : c'est le test de capacité de l'interface, et il
 * est franc — pas de terminal simulé, pas de bouton qui ment.
 */
export interface TerminalBridge {
  open: (projectPath: string, kind?: SessionKind) => Promise<{ id: string } | { error: string }>
  write: (id: string, data: string) => Promise<void>
  resize: (id: string, cols: number, rows: number) => Promise<void>
  close: (id: string) => Promise<void>
  listen: (
    onData: (id: string, data: string) => void,
    onExit: (id: string, code: number) => void,
  ) => () => void
}

declare global {
  interface Window {
    cockpit?: {
      terminal: TerminalBridge
      projects: {
        /** Sélecteur de dossier du système. Rend null si l'utilisateur annule. */
        pick: () => Promise<string | null>
        /** Révèle le `cockpit/` du projet dans le Finder. */
        reveal: (projectPath: string) => Promise<boolean>
      }
      /** Commandes du menu natif — voir `electron/menu.js`. */
      menu: { on: (handler: (command: string) => void) => () => void }
      /** Onglet Navigateur — voir `electron/preload.cjs`. */
      preview: {
        devtools: (
          targetId: number,
          bounds: { x: number; y: number; width: number; height: number },
          theme: 'dark' | 'light',
        ) => Promise<boolean>
        devtoolsClose: () => Promise<boolean>
      }
    }
  }
}

export const terminalBridge = (): TerminalBridge | null => window.cockpit?.terminal ?? null

/**
 * Palette xterm thématisée, calculée au démarrage.
 * getTerminalTheme() retourne la palette selon le thème courant.
 */

/** Un onglet du panneau : ce que l'interface en montre. */
export interface Session {
  /** Identifiant local, stable tant que l'onglet vit. Pas l'identifiant du pty. */
  key: string
  kind: SessionKind
  label: string
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

/**
 * Session Claude courante, à portée de module.
 *
 * L'onglet Navigateur écrit dedans sans être un enfant du panneau terminal.
 * Faire descendre `inject` par les props obligerait à remonter le cycle de vie
 * de xterm jusqu'à `App.tsx`, et démonter `<Terminal>` (App.tsx:276) tuerait la
 * session — le panneau est repliable.
 */
let claudeSessionId: string | null = null

/**
 * Écrit dans la session Claude. Rend false s'il n'y en a pas — c'est le cas
 * dans un navigateur, et l'appelant se rabat alors sur le presse-papier.
 */
export function injectToClaude(text: string): boolean {
  const bridge = terminalBridge()
  if (!bridge || !claudeSessionId) return false
  bridge.write(claudeSessionId, text)
  return true
}

/**
 * Colle un bloc dans la session Claude sans le valider.
 *
 * Le mode « bracketed paste » du terminal est indispensable pour un texte
 * multiligne : sans lui, le premier retour à la ligne validerait la saisie et
 * le reste du bloc partirait comme autant de messages séparés. Rien n'est
 * envoyé — l'utilisateur relit et appuie sur Entrée.
 */
export function pasteToClaude(text: string): boolean {
  return injectToClaude(`\x1b[200~${text}\x1b[201~`)
}

const claudeSlot = (project: string): Session => ({
  key: `${project}#claude`,
  kind: 'claude',
  label: 'claude',
})

/**
 * Ouvre les sessions du panneau et les relie chacune à un xterm.
 *
 * Une session `claude` par projet, ouverte d'office ; autant de shells nus que
 * demandé, pour un serveur de dev ou des logs. Changer de projet ferme tout et
 * rouvre une session Claude dans le bon dossier.
 */
export function useTerminals(projectPath: string | null) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const panes = useRef(new Map<string, Pane>())
  const counter = useRef(0)
  // Une fonction de référence par session, gardée telle quelle d'un rendu à
  // l'autre : React appelle une référence changeante avec `null` puis avec
  // l'élément, ce qui détruirait et rouvrirait la session à chaque rendu.
  const refs = useRef(new Map<string, (host: HTMLDivElement | null) => void>())

  // Un seul abonnement pour toutes les sessions : `listen` porte déjà
  // l'identifiant, et deux abonnements écriraient deux fois le même octet.
  useEffect(() => {
    const bridge = terminalBridge()
    if (!bridge) return

    return bridge.listen(
      (id, data) => {
        for (const pane of panes.current.values()) {
          if (pane.id === id) pane.xterm.write(data)
        }
      },
      (id, code) => {
        for (const [key, pane] of panes.current) {
          if (pane.id !== id) continue
          pane.xterm.writeln(`\r\n\x1b[38;5;140m— session terminée (code ${code}) —\x1b[0m`)
          pane.id = null
          if (key.endsWith('#claude')) claudeSessionId = null
        }
      },
    )
  }, [])

  // Changer de projet repart d'une seule session Claude. Les clés portent le
  // chemin : les anciens hôtes se démontent, donc se ferment, tout seuls.
  useEffect(() => {
    if (!projectPath) {
      setSessions([])
      setActive(null)
      return
    }
    const first = claudeSlot(projectPath)
    counter.current = 0
    setSessions([first])
    setActive(first.key)
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
        if (pane.id) {
          bridge.close(pane.id)
          if (pane.id === claudeSessionId) claudeSessionId = null
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

      xterm.onData(data => pane.id && bridge.write(pane.id, data))

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
        if (session.kind === 'claude') claudeSessionId = result.id
        bridge.resize(result.id, xterm.cols, xterm.rows)
      })
    }

    refs.current.set(session.key, ref)
    return ref
  }, [projectPath])

  /** Ouvre un shell nu de plus, et s'y place. */
  const openShell = useCallback(() => {
    if (!projectPath) return
    const n = ++counter.current
    const session: Session = {
      key: `${projectPath}#shell-${n}`,
      kind: 'shell',
      label: `shell ${n}`,
    }
    setSessions(before => [...before, session])
    setActive(session.key)
  }, [projectPath])

  /** Ferme un shell. La session Claude n'est pas fermable : c'est le panneau. */
  const closeShell = useCallback(
    (key: string) => {
      if (!projectPath || key === claudeSlot(projectPath).key) return
      setSessions(before => before.filter(s => s.key !== key))
      // Retour sur la session Claude : elle existe toujours, elle ne se ferme
      // pas. Choisir « la dernière restante » demanderait de lire la liste
      // depuis un setter, ce qui la lirait périmée.
      setActive(now => (now === key ? claudeSlot(projectPath).key : now))
      setErrors(({ [key]: _closed, ...rest }) => rest)
    },
    [projectPath],
  )

  /**
   * Place le curseur dans la session Claude.
   *
   * Un bouton qui écrit dans le terminal sans y donner le clavier obligerait à
   * cliquer dans la grille pour compléter la commande — le collage servirait à
   * moitié.
   */
  const focusClaude = useCallback(() => {
    if (!projectPath) return
    const pane = panes.current.get(claudeSlot(projectPath).key)
    pane?.xterm.focus()
  }, [projectPath])

  return {
    sessions,
    active,
    setActive,
    attach,
    openShell,
    closeShell,
    errors,
    focusClaude,
    claudeKey: projectPath ? claudeSlot(projectPath).key : null,
    available: Boolean(terminalBridge()),
  }
}
