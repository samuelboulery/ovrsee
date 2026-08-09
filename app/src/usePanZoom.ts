import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Un canevas qu'on déplace et qu'on zoome, sans dépendance.
 *
 * Le graphe se pliait à la place disponible : une profondeur trop large passait
 * sur deux rangées, et deux pages au même niveau finissaient à deux hauteurs
 * différentes. Le canevas renverse le rapport — la disposition est fixe, c'est
 * le regard qui s'ajuste. Deux `transform` CSS et un `ResizeObserver` suffisent :
 * le contenu reste du DOM, donc les cartes gardent leur survol et leur clic.
 *
 * Gestes, calqués sur Figma et Miro parce que c'est ce que les doigts savent
 * déjà faire : deux doigts déplacent, le pincement zoome, glisser le fond
 * déplace aussi.
 */

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

/** Au-delà de ce déplacement, le geste est un glisser et non un clic. */
const DRAG_THRESHOLD = 4

/** Marge laissée autour du contenu par `fit()`. */
const PADDING = 28

/**
 * Cran de molette maximal pris en compte pour un zoom.
 *
 * Un pincement de trackpad envoie des `deltaY` de quelques unités, une molette
 * de souris en envoie 120 d'un coup : sans borne, `exp(120/100)` triplerait le
 * zoom en un cran. Borner rend les deux gestes utilisables avec la même
 * formule, au lieu d'en écrire deux.
 */
const WHEEL_STEP = 24

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export interface Pan {
  x: number
  y: number
}

/**
 * Zoom et décalage vivent dans le même état.
 *
 * Un zoom ancré déplace aussi le décalage : les tenir séparés obligerait à
 * appeler `setPan` depuis l'updater de `setZoom`, c'est-à-dire à poser un effet
 * de bord dans une fonction que React s'autorise à rejouer — et il la rejoue,
 * en mode strict. Le décalage était alors appliqué deux fois et le canevas
 * partait au loin au premier pincement.
 */
interface View {
  zoom: number
  x: number
  y: number
}

export function usePanZoom() {
  const ref = useRef<HTMLDivElement | null>(null)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [panning, setPanning] = useState(false)

  /**
   * L'utilisateur a-t-il pris la main ?
   *
   * Tant que non, le canevas se recadre à chaque changement de taille. Une fois
   * qu'il a zoomé ou déplacé, on ne touche plus à rien : recadrer sous les
   * doigts serait le défaut qu'on corrige, en pire.
   */
  const touched = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)

    const box = element.getBoundingClientRect()
    setSize({ width: box.width, height: box.height })

    return () => observer.disconnect()
  }, [])

  /** Zoom ancré sur un point du viewport : ce qui est sous le curseur y reste. */
  const zoomAt = useCallback((factor: number, point: Pan) => {
    touched.current = true
    setView(v => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const applied = zoom / v.zoom
      return {
        zoom,
        x: point.x - (point.x - v.x) * applied,
        y: point.y - (point.y - v.y) * applied,
      }
    })
  }, [])

  /** Depuis les boutons : le point d'ancrage est le centre du viewport. */
  const zoomBy = useCallback(
    (factor: number) => zoomAt(factor, { x: size.width / 2, y: size.height / 2 }),
    [zoomAt, size.width, size.height],
  )

  const fit = useCallback(
    (contentWidth: number, contentHeight: number, manual = true) => {
      if (size.width === 0 || contentWidth === 0 || contentHeight === 0) return
      if (manual) touched.current = true

      // Plafonné à 1 : les vignettes des cartes sont des PNG, les grossir
      // au-delà de leur taille naturelle ne montrerait que leurs pixels.
      const zoom = clamp(
        Math.min(
          (size.width - PADDING * 2) / contentWidth,
          (size.height - PADDING * 2) / contentHeight,
        ),
        MIN_ZOOM,
        1,
      )

      setView({
        zoom,
        x: (size.width - contentWidth * zoom) / 2,
        y: Math.max(PADDING, (size.height - contentHeight * zoom) / 2),
      })
    },
    [size.width, size.height],
  )

  const reset = useCallback(() => {
    touched.current = true
    setView({ zoom: 1, x: PADDING, y: PADDING })
  }, [])

  /** Rend la main à l'ajustement automatique — au changement de projet. */
  const release = useCallback(() => {
    touched.current = false
  }, [])

  /**
   * La molette est écoutée à la main, pas par `onWheel`.
   *
   * React pose ses écouteurs de `wheel` en passif : `preventDefault()` y est
   * ignoré, et la page défilerait derrière le canevas au lieu de le déplacer.
   */
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      touched.current = true

      // Chrome rapporte le pincement du trackpad comme une molette avec
      // `ctrlKey` : le même chemin sert au pincement et à ⌘/Ctrl + molette.
      if (event.ctrlKey || event.metaKey) {
        const box = element.getBoundingClientRect()
        const step = clamp(event.deltaY, -WHEEL_STEP, WHEEL_STEP)
        zoomAt(Math.exp(-step / 100), {
          x: event.clientX - box.left,
          y: event.clientY - box.top,
        })
        return
      }

      setView(v => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }))
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  /**
   * Glisser pour déplacer, sans voler le clic des cartes.
   *
   * Le déplacement ne commence qu'au-delà de quelques pixels ; en deçà, le
   * geste reste un clic et la carte le reçoit normalement. Passé le seuil, le
   * `click` qui suit le relâchement est arrêté en phase de capture — sinon
   * lâcher la souris au-dessus d'une carte la sélectionnerait à la fin d'un
   * simple déplacement.
   */
  useEffect(() => {
    const element = ref.current
    if (!element) return

    let origin: { x: number; y: number } | null = null
    let dragged = false

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      origin = { x: event.clientX, y: event.clientY }
      dragged = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!origin) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y

      if (!dragged && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return

      if (!dragged) {
        dragged = true
        touched.current = true
        setPanning(true)
      }

      origin = { x: event.clientX, y: event.clientY }
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }

    const onPointerUp = () => {
      origin = null
      setPanning(false)
    }

    const onClick = (event: MouseEvent) => {
      if (!dragged) return
      dragged = false
      event.stopPropagation()
    }

    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    element.addEventListener('click', onClick, true)

    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('click', onClick, true)
    }
  }, [])

  return {
    ref,
    width: size.width,
    height: size.height,
    zoom: view.zoom,
    pan: { x: view.x, y: view.y },
    panning,
    /** Vrai tant que l'utilisateur n'a ni zoomé ni déplacé lui-même. */
    untouched: () => !touched.current,
    fit,
    zoomBy,
    reset,
    release,
  }
}
