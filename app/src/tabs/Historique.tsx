import { frDate, history, planFiles, planRejected, planWhy, type Plan } from '../data'
import { s } from '../style'

export function Historique({ plans }: { plans: Plan[] }) {
  const historyPlans = history(plans)

  if (historyPlans.length === 0) {
    return (
      <div style={s('flex: 1; padding: 20px 22px; overflow: auto; display: flex; align-items: center; justify-content: center;')}>
        <div style={s('font-size: 12px; color: var(--color-neutral-600); text-align: center;')}>
          Aucun plan clos. L'historique se remplira au premier commit qui exécute un plan.
        </div>
      </div>
    )
  }

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <h1 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
        Chronologie des plans exécutés
      </h1>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>
        Quand, quoi, pourquoi, quels fichiers. Un plan est clos par le commit qui l'exécute.
      </div>
      <div style={s('display: flex; flex-direction: column;')}>
        {historyPlans.map((plan) => (
          <div key={plan.file} style={s('display: grid; grid-template-columns: 116px 1fr; gap: 20px; padding: 16px 0; border-top: 1px solid var(--color-divider);')}>
            <div>
              <div style={s('font-size: 12px; color: var(--color-neutral-400);')}>
                {frDate(plan.closed)}
              </div>
              <div style={s('font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--color-neutral-600); margin-top: 4px;')}>
                {plan.commits.at(-1)?.sha ?? '—'}
              </div>
            </div>
            <div>
              <div style={s('font-size: 14.5px; font-weight: 500;')}>
                {plan.title}
              </div>
              <div style={s('font-size: 12.5px; color: var(--color-neutral-400); margin-top: 6px; line-height: 1.55; max-width: 62ch; text-wrap: pretty;')}>
                {planWhy(plan)}
              </div>
              {planRejected(plan) !== null && (
                <div style={s('display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 9px 11px; border-radius: 6px; background: var(--color-accent-900); border: 1px solid var(--color-accent-800);')}>
                  <span style={s('font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent-300); flex: none; padding-top: 1px;')}>
                    Écarté
                  </span>
                  <span style={s('font-size: 12px; color: var(--color-accent-200); line-height: 1.5;')}>
                    {planRejected(plan)}
                  </span>
                </div>
              )}
              <div style={s('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;')}>
                {planFiles(plan).map((file) => (
                  <span key={file} style={s('font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--color-neutral-500); border: 1px solid var(--color-neutral-800); border-radius: 4px; padding: 3px 7px;')}>
                    {file}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
