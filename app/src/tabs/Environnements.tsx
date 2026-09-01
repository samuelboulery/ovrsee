import type { GitStatus, OvrseeConfig } from '../data'
import { t } from '../i18n'
import { s } from '../style'
import { Titre } from '../ViewBar'

/**
 * Environnements déclarés dans `ovrsee.config.json`.
 *
 * Rien ne les détecte — un déploiement réel n'a pas de trace lisible depuis le
 * dépôt. Le badge « branche courante » n'est qu'une comparaison de noms entre
 * `branche` et `gitStatus.branch`, pas une preuve que cet environnement sert
 * effectivement ce code.
 */
export function Environnements({
  config,
  gitStatus,
}: {
  config: OvrseeConfig | null
  gitStatus: GitStatus
}) {
  const environments = config?.environments ?? []
  if (environments.length === 0) return null

  return (
    <div style={s('margin-top: 18px;')}>
      <Titre>{t('environnements.title')}</Titre>
      <div style={s('display: flex; flex-wrap: wrap; gap: 10px;')}>
        {environments.map(env => (
          <div
            key={env.nom}
            className="card"
            style={s('padding: 9px 12px; min-width: 160px;')}
          >
            <div style={s('display: flex; align-items: center; gap: 6px;')}>
              <div style={s('font-size: 12.5px; font-weight: 500;')}>{env.nom}</div>
              {env.branche && env.branche === gitStatus.branch && (
                <span
                  className="tag"
                  style={s('font-size: 10px; color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border);')}
                >
                  {t('environnements.current_branch')}
                </span>
              )}
            </div>
            {env.branche && (
              <div
                style={s(
                  'font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;',
                )}
              >
                {env.branche}
              </div>
            )}
            {env.url && (
              <a
                href={env.url}
                target="_blank"
                rel="noreferrer"
                style={s('font-size: 11px; color: var(--color-accent); margin-top: 3px; display: block;')}
              >
                {env.url}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

