import type { ComponentType } from 'react'
import { Square, SquareHalf, SquareHalfBottom, type IconProps } from '@phosphor-icons/react'

import { t, type TranslationKey } from './i18n'

/**
 * La disposition du panneau terminal : où il va, comment il se mesure, comment
 * on la nomme et comment on la dessine.
 *
 * Sorti de `Terminal.tsx` (T-0241), qui repassait au-dessus du plafond de 800
 * lignes. Rien ici ne connaît une session ni un pty — ce sont des fonctions du
 * seul mot `bottom` / `side` / `full`, et c'est ce qui en fait un module.
 *
 * `Layout` vit ici plutôt que dans `Terminal.tsx` : `terminalPins.ts` et
 * `tabs/Produit.tsx` n'en veulent que le type, et le prendre à la porte du
 * panneau terminal — un module chargé en `lazy()` — donnait un import qui ne
 * disait pas ce qu'il cherchait.
 */

export type Layout = 'bottom' | 'side' | 'full'

export const LAYOUT_IDS: Layout[] = ['bottom', 'side', 'full']

export const layoutLabel = (layout: Layout): string => {
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
export const LAYOUT_ICONS: Record<Layout, ComponentType<IconProps>> = {
  'bottom': SquareHalfBottom,
  'side': SquareHalf,
  'full': Square,
}

/** `.seg-opt` est calibré pour du texte ; une icône seule n'a pas besoin de ses 10 px. */
export const SEG_ICONE = 'padding: 5px 8px;'

/**
 * Le panneau se dimensionne selon sa disposition.
 *
 * « Plein » n'a pas de taille propre : il prend tout. Les deux autres ont leur
 * séparateur, avec une clé de conservation distincte — une hauteur de 244 px
 * et une largeur de 468 px ne se mélangent pas.
 */
export const panelStyle = (layout: Layout, size: number): string => {
  if (layout === 'full') {
    return 'flex: 1; background: var(--color-surface); display: flex; flex-direction: column; min-height: 0; min-width: 0;'
  }
  if (layout === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid var(--color-border-chrome); background: var(--color-surface); display: flex; flex-direction: column; min-height: 0;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid var(--color-border-chrome); background: var(--color-surface); display: flex; flex-direction: column; min-height: 0;`
}
