import { useCallback, useEffect, useRef, useState } from 'react'

import { s } from './style'

/**
 * Un séparateur qu'on tire à la souris.
 *
 * Les tailles de la maquette — barre latérale 236 px, terminal 244 px, rail de
 * détail 330 px — étaient calibrées pour une fenêtre de 1320×860. Sur un grand
 * écran l'espace est perdu ; quand le terminal travaille, on veut l'agrandir
 * sans perdre le graphe.
 *
 * La taille est retenue d'une session à l'autre. Un double-clic revient à la
 * valeur d'origine : sans cela, une poignée tirée trop loin est irrattrapable.
 */
export interface Resizable {
  size: number
  /** À poser sur le séparateur. */
  handleProps: {
    onPointerDown: (event: React.PointerEvent) => void
    onPointerMove: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
    onDoubleClick: () => void
  }
  dragging: boolean
}

export type Axis = 'x' | 'y'

interface Options {
  /** Clé de conservation. Une par séparateur. */
  key: string
  initial: number
  min: number
  max: number | (() => number)
  axis: Axis
  /** true quand tirer vers la gauche/le haut AGRANDIT le panneau. */
  invert?: boolean
  /** Callback appelée au lieu du localStorage si fourni. */
  onResize?: (newSize: number) => void
}

const STORAGE_PREFIX = 'ovrsee.size.'

function restore(key: string, fallback: number): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_PREFIX + key))
    return Number.isFinite(saved) && saved > 0 ? saved : fallback
  } catch {
    return fallback
  }
}

export function useResizable({ key, initial, min, max, axis, invert, onResize }: Options): Resizable {
  const [size, setSize] = useState(() => (onResize ? initial : restore(key, initial)))
  const [dragging, setDragging] = useState(false)
  const origin = useRef({ pointer: 0, size: 0 })

  const clamp = useCallback(
    (value: number) => {
      const ceiling = typeof max === 'function' ? max() : max
      return Math.min(Math.max(value, min), Math.max(min, ceiling))
    },
    [min, max],
  )

  /**
   * Le suivi passe par la capture de pointeur, pas par des écouteurs posés sur
   * `window` depuis un effet.
   *
   * Un effet déclenché par l'état s'attache après le rendu suivant : un geste
   * rapide voit ses événements de déplacement partir avant, et le séparateur
   * ne bouge pas. `setPointerCapture` dirige au contraire tous les événements
   * vers la poignée dès la pression, y compris quand le pointeur sort de sa
   * zone étroite de neuf pixels.
   */
  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointeur non capturable : le glissement fonctionne quand même tant
      // que le curseur reste sur la poignée. Mieux vaut ça qu'un séparateur
      // entièrement inerte.
    }
    origin.current = { pointer: axis === 'x' ? event.clientX : event.clientY, size }
    setDragging(true)
    document.body.style.userSelect = 'none'
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return
    const now = axis === 'x' ? event.clientX : event.clientY
    const delta = (now - origin.current.pointer) * (invert ? -1 : 1)
    setSize(clamp(origin.current.size + delta))
  }

  const onPointerUp = (event: React.PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
    document.body.style.userSelect = ''
  }

  useEffect(() => {
    if (onResize) {
      // Callback fourni : utilisée pour les préférences
      onResize(size)
    } else {
      // Pas de callback : utiliser localStorage pour la rétrocompatibilité
      try {
        localStorage.setItem(STORAGE_PREFIX + key, String(size))
      } catch {
        // Stockage indisponible : la taille vaut pour la session, c'est tout.
      }
    }
  }, [key, size, onResize])

  // Une fenêtre rétrécie ne doit pas laisser un panneau plus large qu'elle.
  useEffect(() => {
    const onResize = () => setSize(current => clamp(current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  return {
    size,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onDoubleClick: () => setSize(initial),
    },
  }
}

/**
 * La poignée elle-même : un trait de 1 px, une zone de saisie de 9 px.
 *
 * Le trait reste discret comme les séparateurs de la maquette ; c'est la zone
 * sensible, invisible, qui rend le geste facile à attraper.
 */
export function Divider({ axis, resizable }: { axis: Axis; resizable: Resizable }) {
  const vertical = axis === 'x'

  return (
    <div
      {...resizable.handleProps}
      title="Glisser pour redimensionner · double-clic pour réinitialiser"
      style={s(
        vertical
          ? 'flex: none; width: 9px; margin: 0 -4px; cursor: col-resize; z-index: 10; display: flex; justify-content: center;'
          : 'flex: none; height: 9px; margin: -4px 0; cursor: row-resize; z-index: 10; display: flex; align-items: center;',
      )}
    >
      <div
        style={s(
          (vertical ? 'width: 1px; height: 100%;' : 'height: 1px; width: 100%;') +
            (resizable.dragging ? ' background: var(--color-accent);' : ' background: transparent;'),
        )}
      />
    </div>
  )
}
