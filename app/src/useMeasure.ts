import { useEffect, useRef, useState } from 'react'

/**
 * Largeur courante d'un élément, suivie en direct.
 *
 * Nécessaire parce que la disposition du graphe dépend de la place réelle : le
 * nombre de cartes par rangée ne peut pas être une constante quand la fenêtre
 * se redimensionne, que la barre latérale se resserre ou que le terminal passe
 * sur le côté.
 */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
