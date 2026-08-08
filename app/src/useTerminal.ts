import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/**
 * Passerelle exposée par `electron/preload.cjs`.
 *
 * Absente dans un navigateur : c'est le test de capacité de l'interface, et il
 * est franc — pas de terminal simulé, pas de bouton qui ment.
 */
export interface TerminalBridge {
  open: (projectPath: string) => Promise<{ id: string } | { error: string }>
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
    cockpit?: { terminal: TerminalBridge }
  }
}

export const terminalBridge = (): TerminalBridge | null => window.cockpit?.terminal ?? null

/** Palette Nocturne, pour que le terminal appartienne à la même interface. */
const THEME = {
  background: '#101120',
  foreground: '#c9cad3',
  cursor: '#9184d9',
  selectionBackground: '#353b80',
  black: '#161826',
  brightBlack: '#595d6c',
  white: '#e9e9ed',
  brightWhite: '#ffffff',
  magenta: '#9184d9',
  brightMagenta: '#b3a9e6',
}

/**
 * Ouvre une session dans le projet courant et la relie à un xterm.
 *
 * Une session par projet : changer de projet dans la barre latérale ferme la
 * précédente et en ouvre une autre, dans le bon dossier.
 */
export function useTerminal(projectPath: string | null) {
  const host = useRef<HTMLDivElement | null>(null)
  const term = useRef<XTerm | null>(null)
  const session = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const bridge = terminalBridge()
    if (!bridge || !host.current || !projectPath) return

    const xterm = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      theme: THEME,
      allowProposedApi: true,
    })
    const fit = new FitAddon()
    xterm.loadAddon(fit)
    xterm.open(host.current)
    fit.fit()
    term.current = xterm

    let alive = true
    let unlisten = () => {}

    bridge.open(projectPath).then(result => {
      if (!alive) return
      if ('error' in result) {
        setError(result.error)
        xterm.writeln(`\x1b[38;5;140m${result.error}\x1b[0m`)
        return
      }

      session.current = result.id
      setError(null)

      unlisten = bridge.listen(
        (id, data) => id === session.current && xterm.write(data),
        (id, code) => {
          if (id !== session.current) return
          xterm.writeln(`\r\n\x1b[38;5;140m— session terminée (code ${code}) —\x1b[0m`)
          session.current = null
        },
      )

      xterm.onData(data => session.current && bridge.write(session.current, data))
      bridge.resize(result.id, xterm.cols, xterm.rows)
    })

    // Le panneau change de taille avec les trois dispositions et avec la
    // fenêtre : sans cela, `claude` afficherait sur une grille fausse.
    const observer = new ResizeObserver(() => {
      fit.fit()
      if (session.current) bridge.resize(session.current, xterm.cols, xterm.rows)
    })
    observer.observe(host.current)

    return () => {
      alive = false
      observer.disconnect()
      unlisten()
      if (session.current) bridge.close(session.current)
      session.current = null
      xterm.dispose()
      term.current = null
    }
  }, [projectPath])

  /** Écrit dans la session — c'est ce que font les boutons d'injection. */
  const inject = (text: string) => {
    const bridge = terminalBridge()
    if (!bridge || !session.current) return false
    bridge.write(session.current, text)
    return true
  }

  return { host, error, inject, available: Boolean(terminalBridge()) }
}
