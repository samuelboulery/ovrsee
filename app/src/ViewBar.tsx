import type { ReactNode } from 'react'

import { s } from './style'

/**
 * Barre de vue — maquette `Ovrsee App.dc.html#2a`, 46px, présente sur chaque
 * onglet à la place du `<h2>` de page que chacun réinventait. Fil d'Ariane
 * (projet / vue) à gauche, méta optionnelle en mono, contrôles propres à la
 * vue à droite via `children` — segmenté de sous-vue, chips, action
 * primaire : le contenu détaillé de cette zone se pose écran par écran, pas
 * ici (voir T-0088).
 */
export function ViewBar({
  projet,
  vue,
  meta,
  children,
}: {
  projet: string
  vue: string
  /** Texte mono à droite du fil d'Ariane — ex. « 7 pages · 42 liens ». Omis si non pertinent pour la vue. */
  meta?: string
  /** Contrôles contextuels de la vue, alignés à droite. */
  children?: ReactNode
}) {
  return (
    <div
      style={s(
        'height: 46px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid #22242b;',
      )}
    >
      <span style={s('font-size: 12.5px; color: #7f858f; white-space: nowrap;')}>{projet}</span>
      <span style={s('font-size: 12.5px; color: #45474f;')}>/</span>
      <span style={s('font-size: 12.5px; font-weight: 500; color: #f2f3f5; white-space: nowrap;')}>{vue}</span>
      {meta && (
        <span style={s('font-family: var(--font-mono); font-size: 11px; color: #6b7078; white-space: nowrap;')}>
          {meta}
        </span>
      )}
      <div style={s('flex: 1;')} />
      {children}
    </div>
  )
}
