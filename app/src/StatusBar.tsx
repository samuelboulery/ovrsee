import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

import { raccourci } from './raccourcis'
import { s } from './style'

const COULEUR_DOT: Record<'ok' | 'warn' | 'err', string> = {
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
  err: 'var(--color-err)',
}

/**
 * Emplacement réel de la barre — un pied de page unique, sous le terminal.
 * Chaque onglet continue de rendre `<StatusBar>` chez lui (maquette : présente
 * partout) ; le contenu part en portail vers ce nœud pour ne pas dépendre de
 * l'ordre DOM entre l'onglet et le panneau de terminal. Sans Provider (tests
 * SSR de `render.test.tsx`), la barre reste inline.
 */
export const StatusBarSlotContext = createContext<HTMLDivElement | null>(null)

/**
 * Barre d'état — maquette `Ovrsee App.dc.html#2a`, 26px, présente sur chaque
 * onglet. Faits propres à la vue à gauche ; à droite des segments
 * contextuels séparés par « | », le raccourci de la palette toujours en
 * dernier (police système, jamais mono — audit §5.4), écrit pour la
 * plateforme par `raccourci()`.
 */
export function StatusBar({
  dot,
  left = [],
  right = [],
}: {
  /** Puce de statut avant le premier fait — omise si aucune couleur sémantique ne vaut pour la vue. */
  dot?: 'ok' | 'warn' | 'err'
  /** Faits propres à la vue, à gauche, séparés par « · ». */
  left?: string[]
  /** Segments à droite, avant le raccourci de la palette qui s'ajoute toujours en dernier. */
  right?: string[]
}) {
  const droite = [...right, raccourci('K')]
  const slot = useContext(StatusBarSlotContext)

  const contenu = (
    <div
      style={s(
        'height: 26px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px; border-top: 1px solid var(--color-border-chrome); background: var(--color-surface); font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-discrete);',
      )}
    >
      {left.length > 0 && (
        <div style={s('display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden;')}>
          {dot && <span style={s(`width: 5px; height: 5px; border-radius: 50%; background: ${COULEUR_DOT[dot]}; flex: none;`)} />}
          <span style={s('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{left.join(' · ')}</span>
        </div>
      )}
      <div style={s('flex: 1;')} />
      <div style={s('display: flex; align-items: center; gap: 8px; flex: none;')}>
        {droite.map((segment, index) => {
          // Seul le dernier segment (le raccourci de la palette, toujours
          // ajouté ici) est une pure combinaison de touches : police système.
          // Les autres mélangent texte et raccourci dans une même chaîne —
          // mono, comme le reste.
          const derniere = index === droite.length - 1
          return (
            <span key={index} style={s('display: flex; align-items: center; gap: 8px;')}>
              {index > 0 && <span style={s('color: var(--color-text-ghost);')}>|</span>}
              <span
                style={s(
                  derniere
                    ? "font-family: -apple-system, 'SF Pro Text', ui-sans-serif, system-ui, sans-serif; font-size: 10.5px; color: var(--color-text-tertiary);"
                    : 'font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-discrete);',
                )}
              >
                {segment}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )

  return slot ? createPortal(contenu, slot) : contenu
}
