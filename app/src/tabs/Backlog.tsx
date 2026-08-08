import { humanAge, planWhy, type Plan } from '../data'
import { s } from '../style'

export function Backlog({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <div style={s('flex: 1; padding: 20px 22px; overflow: auto; display: flex; align-items: center; justify-content: center;')}>
        <div style={s('font-size: 12px; color: var(--color-neutral-600); text-align: center;')}>
          Aucun plan ouvert. Tout ce qui a été approuvé a été exécuté.
        </div>
      </div>
    )
  }

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <h1 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>Plans ouverts</h1>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>Approuvés, jamais clos par un commit. Le backlog n'est pas saisi : il est calculé.</div>
      <div style={s('display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;')}>
        {plans.map(plan => (
          <div key={plan.file} style={s('border: 1px solid var(--color-neutral-800); border-radius: 8px; padding: 14px 15px; background: var(--color-surface);')}>
            <div style={s('display: flex; align-items: baseline; gap: 8px;')}>
              <div style={s('font-size: 14px; font-weight: 500;')}>{plan.title}</div>
              <div style={s('flex: 1;')}></div>
              <div style={s('font-size: 10.5px; color: var(--color-neutral-600);')}>ouvert {humanAge(plan.opened)}</div>
            </div>
            {/* Borné à cinq lignes : la carte doit rester scannable, et le plan
                complet reste lisible dans cockpit/plans/. */}
            <div
              style={s(
                'font-size: 12.5px; color: var(--color-neutral-400); margin-top: 7px; line-height: 1.55; text-wrap: pretty; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;',
              )}
              title={planWhy(plan)}
            >
              {planWhy(plan)}
            </div>
            <div style={s('display: flex; align-items: center; gap: 8px; margin-top: 12px;')}>
              <span className="tag tag-outline" style={s('font-size: 10.5px;')}>
                {plan.commits.length > 0 ? `${plan.commits.length} commit(s)` : 'jamais commencé'}
              </span>
              <div style={s('flex: 1;')}></div>
              <button type="button" className="btn btn-primary" style={s('font-size: 11.5px; padding: 5px 11px;')} disabled title="Le terminal intégré arrive en v1.1">Reprendre dans le terminal</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
