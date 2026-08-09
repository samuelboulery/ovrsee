import { t } from './i18n'
import { s } from './style'

export function Welcome() {
  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 48px; text-align: center; overflow-y: auto;',
      )}
    >
      <div>
        <h1 style={s('margin: 0; font-size: 28px; font-weight: 400; margin-bottom: 12px;')}>
          {t('welcome.title')}
        </h1>
        <p style={s('margin: 0; font-size: 14px; color: var(--color-neutral-400); max-width: 52ch;')}>
          {t('welcome.description')}
        </p>
      </div>

      <div style={s('max-width: 52ch;')}>
        <p style={s('margin: 0 0 8px; font-size: 13px; color: var(--color-neutral-500); line-height: 1.5;')}>
          {t('welcome.what_is_cockpit_part1')}
          <code style={s('font-family: monospace; color: var(--color-accent-500);')}>
            {t('welcome.what_is_cockpit_folder')}
          </code>
          {t('welcome.what_is_cockpit_part2')}
        </p>
        <p style={s('margin: 8px 0 0; font-size: 13px; color: var(--color-neutral-500); line-height: 1.5;')}>
          {t('welcome.no_execution')}
        </p>
      </div>

      <div style={s('max-width: 52ch;')}>
        <h2 style={s('margin: 0 0 12px; font-size: 12px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);')}>
          {t('welcome.prerequisites_title')}
        </h2>
        <ul
          style={s(
            'margin: 0; padding: 0 0 0 18px; list-style: none; font-size: 12px; color: var(--color-neutral-500); text-align: left;',
          )}
        >
          <li>{t('welcome.prerequisites_claude')}</li>
          <li>{t('welcome.prerequisites_git')}</li>
          <li>{t('welcome.prerequisites_node')}</li>
        </ul>
      </div>

      <div style={s('max-width: 52ch;')}>
        <p style={s('margin: 0 0 8px; font-size: 12px; color: var(--color-neutral-600);')}>
          {t('welcome.install_description')}
        </p>
        <code
          style={s(
            'display: block; padding: 12px; background: var(--theme-bg-secondary); border-radius: 4px; font-family: monospace; font-size: 11px; color: var(--color-accent-500); word-break: break-all;',
          )}
        >
          {t('welcome.install_command')}
        </code>
      </div>
    </div>
  )
}
