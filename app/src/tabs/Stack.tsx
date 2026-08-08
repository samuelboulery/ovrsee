import { stackFrom, type Snapshot } from '../data'
import { s } from '../style'

export function Stack({ snapshot }: { snapshot: Snapshot }) {
  const rows = stackFrom(snapshot.packageJson, snapshot.plans)

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <h1 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>Stack</h1>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>
        Ce qui est utilisé, et pourquoi — chaque ligne remonte à un commentaire{' '}
        <span style={s('font-family: ui-monospace, monospace;')}># WHY:</span>
        {' '}ou à un plan.
      </div>
      {rows.length === 0 ? (
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          Aucune dépendance déclarée dans package.json.
        </div>
      ) : (
        <div style={s('display: flex; flex-direction: column; gap: 10px; max-width: 780px;')}>
          {rows.map(row => {
            const hasNoReason = row.why.includes('Aucune raison tracée')
            const whyColor = hasNoReason ? 'var(--color-neutral-600)' : 'var(--color-neutral-400)'
            return (
              <div
                key={row.name}
                style={s('display: grid; grid-template-columns: 190px 1fr; gap: 18px; align-items: start; border: 1px solid var(--color-neutral-800); border-radius: 8px; padding: 13px 15px; background: var(--color-surface);')}
              >
                <div>
                  <div style={s('font-size: 13.5px; font-weight: 500;')}>{row.name}</div>
                  <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}>{row.version}</div>
                </div>
                <div style={s(`font-size: 12.5px; color: ${whyColor}; line-height: 1.55; text-wrap: pretty;`)}>
                  {row.why}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
