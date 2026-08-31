/**
 * Les blocs qui bordent la vue de l'onglet Navigateur : carte de l'élément
 * sélectionné, boutons de navigation, écran « hors application ».
 *
 * Sortis de `Navigateur.tsx` (T-0206) : ils prennent tout en props.
 */

import { PaperPlaneRight, X } from '@phosphor-icons/react'

import { t } from '../i18n'
import { s } from '../style'
import { type Picked } from './navigateur-webview'

/**
 * Ce qu'on a voulu dire de l'élément cliqué — une carte qui flotte au-dessus
 * de l'aperçu, en haut à droite.
 *
 * Elle remplace la colonne de droite (T-0214) : 340 px redimensionnables qui
 * poussaient l'aperçu et occupaient la moitié de l'écran pour trois champs de
 * texte. Ce qu'on regarde, c'est le site — pas la fiche de l'élément.
 *
 * Elle ne montre que le **sélecteur**. Le texte et la route ont disparu avec
 * le panneau : la route est déjà dans la barre d'URL, à quelques pixels
 * au-dessus, et la répéter n'apprenait rien.
 */
export function CarteElement({
  picked,
  comment,
  onComment,
  onSend,
  onTicket,
  onClose,
}: {
  picked: Picked
  comment: string
  onComment: (next: string) => void
  onSend: () => void
  onTicket: () => void
  onClose: () => void
}) {
  return (
    <div
      style={s(
        // `z-index` n'est pas décoratif : sans lui la carte passe sous la
        // `<webview>`, qui est une vue à part entière.
        'position: absolute; top: 12px; right: 12px; z-index: 3; width: 286px; display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--color-border-card); border-radius: var(--radius-lg); background: var(--color-surface-card); box-shadow: var(--shadow-lg);',
      )}
    >
      <div style={s('display: flex; align-items: flex-start; gap: 8px;')}>
        <div
          title={picked.selector}
          style={s(
            'flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 11px; color: var(--color-plan); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.5;',
          )}
        >
          {picked.selector}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('navigateur.dismiss_selection')}
          style={s(
            'background: transparent; border: 0; cursor: pointer; color: var(--color-neutral-600); display: flex; padding: 0; flex: none;',
          )}
        >
          <X size={13} weight="regular" aria-hidden="true" />
        </button>
      </div>

      <textarea
        value={comment}
        autoFocus
        onChange={event => onComment(event.target.value)}
        onKeyDown={event => {
          // Entrée envoie, Maj+Entrée fait un retour à la ligne — la
          // convention de toutes les zones de saisie qui parlent à quelqu'un.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSend()
          }
        }}
        rows={3}
        placeholder={t('navigateur.comment_placeholder')}
        style={s(
          'width: 100%; box-sizing: border-box; resize: none; font-family: var(--font-body); font-size: 12px; line-height: 1.5; padding: 8px 9px; border-radius: var(--radius-md); border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text);',
        )}
      />

      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <button
          type="button"
          onClick={onTicket}
          className="btn btn-ghost"
          style={s('flex: 1; justify-content: center; font-size: 11.5px; padding: 5px 8px;')}
        >
          {t('navigateur.create_ticket')}
        </button>
        <button
          type="button"
          onClick={onSend}
          className="btn btn-primary"
          title={t('navigateur.send_hint')}
          aria-label={t('navigateur.send_to_claude')}
          style={s('justify-content: center; font-size: 11.5px; padding: 5px 11px; flex: none;')}
        >
          <PaperPlaneRight size={13} weight="fill" aria-hidden="true" />
        </button>
      </div>
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

