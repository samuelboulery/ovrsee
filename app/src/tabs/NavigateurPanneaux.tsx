/**
 * Les blocs qui bordent la vue de l'onglet Navigateur : panneau de l'élément
 * sélectionné, boutons de navigation, écran « hors application ».
 *
 * Sortis de `Navigateur.tsx` (T-0206) : ils prennent tout en props.
 */

import { X } from '@phosphor-icons/react'
import { type ReactNode } from 'react'

import { t } from '../i18n'
import { s } from '../style'
import { type Picked } from './navigateur-webview'

/**
 * Panneau de l'élément sélectionné — ouvert seulement le temps d'une
 * sélection (maquette 2c posait la colonne en permanence ; à l'usage, elle
 * gênait plus qu'elle n'aidait quand rien n'était sélectionné), et
 * redimensionnable comme les autres panneaux de l'onglet.
 */
export function ElementPanel({
  picked,
  width,
  routes,
  currentRoute,
  onSend,
  onTicket,
  onClose,
}: {
  picked: Picked
  width: number
  routes: string[]
  currentRoute: string | null
  onSend: () => void
  onTicket: () => void
  onClose: () => void
}) {
  return (
    <div
      style={s(
        `width: ${width}px; flex: none; border-left: 1px solid var(--color-divider); background: var(--color-surface-panel); display: flex; flex-direction: column; overflow-y: auto;`,
      )}
    >
      <div style={s('height: 38px; flex: none; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid var(--color-divider);')}>
        <div style={s('font-size: 12px; font-weight: 500; flex: 1;')}>{t('navigateur.selected_element')}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('navigateur.dismiss_selection')}
          style={s('background: transparent; border: 0; cursor: pointer; color: var(--color-neutral-600); display: flex; padding: 0;')}
        >
          <X size={14} weight="regular" aria-hidden="true" />
        </button>
      </div>

      <div style={s('padding: 14px; display: flex; flex-direction: column; gap: 14px;')}>
        <PanelField label={t('navigateur.selector_label')}>
          <div
            style={s(
              'font-family: var(--font-mono); font-size: 11px; color: var(--color-plan); background: var(--color-surface-control); border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 9px 10px; line-height: 1.6; word-break: break-all;',
            )}
          >
            {picked.selector}
          </div>
        </PanelField>
        <PanelField label={t('navigateur.text_label')}>
          <div style={s('font-size: 12.5px; color: var(--color-neutral-400); line-height: 1.6;')}>{picked.text || '—'}</div>
        </PanelField>
        <PanelField label={t('navigateur.route_label')}>
          <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-500);')}>{picked.route}</div>
        </PanelField>

        <div style={s('height: 1px; background: var(--color-divider);')} />

        <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
          <button type="button" onClick={onSend} className="btn btn-primary" style={s('justify-content: center; font-size: 12px;')}>
            {t('navigateur.paste_in_claude')}
          </button>
          <button type="button" onClick={onTicket} className="btn btn-secondary" style={s('justify-content: center; font-size: 12px;')}>
            {t('navigateur.open_ticket_from_element')}
          </button>
        </div>

        {routes.length > 0 && (
          <>
            <div style={s('height: 1px; background: var(--color-divider);')} />
            <PanelField label={t('navigateur.known_routes')}>
              <div style={s('display: flex; flex-wrap: wrap; gap: 5px;')}>
                {routes.map(route => (
                  <span
                    key={route}
                    className={route === currentRoute ? 'tag' : 'tag tag-outline'}
                    style={s(
                      route === currentRoute
                        ? 'font-size: 11px; color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border);'
                        : 'font-size: 11px;',
                    )}
                  >
                    {route}
                  </span>
                ))}
              </div>
            </PanelField>
          </>
        )}
      </div>
    </div>
  )
}

export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
      <div style={s('font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);')}>
        {label}
      </div>
      {children}
    </div>
  )
}

export function NavButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={s(
        'cursor: pointer; border: 1px solid var(--color-border-card); background: transparent; color: var(--color-neutral-500); border-radius: 6px; width: 26px; height: 26px; font-size: 12px; line-height: 1; flex: none;',
      )}
    >
      {label}
    </button>
  )
}

/**
 * Ce que l'onglet montre hors de l'application empaquetée.
 *
 * Même franchise que le panneau terminal : pas de barre d'URL inerte, pas de
 * bouton qui ne fait rien. On dit pourquoi, et où le trouver.
 */
export function HorsApplication() {
  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center;',
      )}
    >
      <div style={s('font-size: 13px; color: var(--color-text);')}>
        {t('navigateur.not_packaged_title')}
      </div>
      <div
        style={s(
          'font-size: 11.5px; color: var(--color-neutral-600); max-width: 56ch; line-height: 1.6;',
        )}
      >
        {t('navigateur.not_packaged_desc')}{' '}
        <span style={s('font-family: var(--font-mono); color: var(--color-accent);')}>
          pnpm electron
        </span>{' '}
        {t('navigateur.not_packaged_help')}
      </div>
    </div>
  )
}

