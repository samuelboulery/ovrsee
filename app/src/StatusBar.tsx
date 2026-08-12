import { s } from './style'

const COULEUR_DOT: Record<'ok' | 'warn' | 'err', string> = {
  ok: '#4cc38a',
  warn: '#e3b341',
  err: '#e5677a',
}

/**
 * Barre d'état — maquette `Ovrsee App.dc.html#2a`, 26px, présente sur chaque
 * onglet. Faits propres à la vue à gauche ; à droite des segments
 * contextuels séparés par « | », `⌘K` toujours en dernier (police système,
 * jamais mono — audit §5.4).
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
  /** Segments à droite, avant le raccourci ⌘K qui s'ajoute toujours en dernier. */
  right?: string[]
}) {
  const droite = [...right, '⌘K']

  return (
    <div
      style={s(
        'height: 26px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px; border-top: 1px solid #17181d; background: #0b0c0e; font-family: var(--font-mono); font-size: 10.5px; color: #55585f;',
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
          // Seul le dernier segment (⌘K, toujours ajouté ici) est une pure
          // combinaison de touches : police système. Les autres mélangent
          // texte et raccourci dans une même chaîne — mono, comme le reste.
          const derniere = index === droite.length - 1
          return (
            <span key={index} style={s('display: flex; align-items: center; gap: 8px;')}>
              {index > 0 && <span style={s('color: #3f424a;')}>|</span>}
              <span
                style={s(
                  derniere
                    ? "font-family: -apple-system, 'SF Pro Text', ui-sans-serif, system-ui, sans-serif; font-size: 10.5px; color: #9096a0;"
                    : 'font-family: var(--font-mono); font-size: 10.5px; color: #55585f;',
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
}
