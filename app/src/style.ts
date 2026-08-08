import { useState, type CSSProperties } from 'react'

/**
 * Convertit une chaîne de style CSS en objet React.
 *
 * La maquette (`Cockpit-A-Nocturne.dc.html`) porte tout son style en attributs
 * `style="…"` inline. On garde ces chaînes telles quelles, caractère pour
 * caractère, et on les traduit ici : c'est la seule façon de garantir que le
 * rendu du port est indiscernable de la maquette. Les réécrire en objets JSX
 * introduirait des écarts silencieux à chaque copie.
 */
const cache = new Map<string, CSSProperties>()

export function s(css: string): CSSProperties {
  const hit = cache.get(css)
  if (hit) return hit

  const style: Record<string, string> = {}
  for (const rule of css.split(';')) {
    const at = rule.indexOf(':')
    if (at === -1) continue

    const property = rule.slice(0, at).trim()
    const value = rule.slice(at + 1).trim()
    if (!property || !value) continue

    // `--color-accent` doit rester tel quel ; `font-size` devient `fontSize`.
    const key = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

    style[key] = value
  }

  const frozen = style as CSSProperties
  cache.set(css, frozen)
  return frozen
}

/**
 * Équivalent de l'attribut `style-hover` de la maquette.
 *
 * @example
 *   const hover = useHover()
 *   <div {...hover.props} style={hover.on ? s(base + survol) : s(base)} />
 */
export function useHover() {
  const [on, setOn] = useState(false)
  return {
    on,
    props: {
      onMouseEnter: () => setOn(true),
      onMouseLeave: () => setOn(false),
    },
  }
}
