import type { ComponentType } from 'react'
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  GitFork,
  NotePencil,
  PencilSimple,
  Play,
  Plus,
  type IconProps,
} from '@phosphor-icons/react'

import { decideInjection } from './brief'
import type { Snapshot } from './data'
import { t } from './i18n'
import { s } from './style'
import type { Layout } from './terminalLayout'

/**
 * Icône par commande livrée — maquette l. 555-558. `buildActions()` compose le
 * libellé traduit tel quel (T-0080 a retiré les glyphes Unicode qui y étaient
 * concaténés, remplacés ici par de vraies icônes) ; les actions
 * personnalisées, elles, n'ont pas d'icône dédiée.
 *
 * Calculée à chaque rendu, pas au chargement du module : les clés sont des
 * libellés traduits, et une bascule de langue à chaud les changerait sous les
 * pieds d'une table figée une fois pour toutes.
 */
const iconeCommande = (): Record<string, ComponentType<IconProps>> => ({
  [t('action.graph')]: GitFork,
  [t('action.graph_obsidian')]: NotePencil,
})

/**
 * La bande des commandes, à côté du terminal.
 *
 * Sortie de `Terminal.tsx` (T-0241) : c'est de l'affichage pur — elle ne
 * connaît ni pty, ni session, ni xterm. Ce qu'elle sait faire d'un clic lui est
 * donné (`onActiver`, `onRecharger`, `onOuvrirPreferences`), et c'est ce qui
 * rend le découpage sûr : le panneau reste dans le morceau chargé en `lazy()`,
 * puisque `Terminal.tsx` est son seul importateur.
 */

/**
 * Le bouton qui replie et déplie le panneau des commandes.
 *
 * Dans le panneau, jamais dans la barre d'outils du terminal : un bouton qui
 * commande un panneau se tient dedans, et replié il reste le seul contenu de
 * la bande — c'est ce qui dit que le panneau existe encore (T-0225).
 *
 * Le chevron pointe vers le geste : vers le bord quand il replie, vers le
 * centre quand il rouvre. En disposition « côté », la bande est en bas et les
 * chevrons deviennent verticaux.
 */
function BoutonBande({
  ouverte,
  layout,
  onToggle,
}: {
  ouverte: boolean
  layout: Layout
  onToggle: () => void
}) {
  const Icone =
    layout === 'side' ? (ouverte ? CaretDown : CaretUp) : ouverte ? CaretRight : CaretLeft
  const dit = t(ouverte ? 'terminal.actions_hide' : 'terminal.actions_show')

  return (
    <button
      type="button"
      className="btn-icon"
      onClick={onToggle}
      aria-expanded={ouverte}
      title={dit}
      aria-label={dit}
      style={s(
        'flex: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 0; border-radius: 6px; background: transparent;',
      )}
    >
      <Icone size={13} weight="bold" aria-hidden="true" color="var(--color-text-quaternary)" />
    </button>
  )
}

export function BandeCommandes({
  layout,
  ouverte,
  onOuverte,
  snapshot,
  actions,
  erreurs,
  onActiver,
  onOuvrirPreferences,
  onRecharger,
  notice,
  error,
  available,
}: {
  layout: Layout
  ouverte: boolean
  onOuverte: (ouverte: boolean) => void
  snapshot: Snapshot | null
  actions: { label: string; text: string }[]
  erreurs: { label: string; error: string }[]
  onActiver: (label: string, text: string) => void
  onOuvrirPreferences?: () => void
  onRecharger: () => void
  /** Message d'un geste qui vient d'avoir lieu — prime sur tout le reste. */
  notice: string | null
  error: string | null
  /** Une passerelle IPC répond : le clic écrit dans la session, sinon il copie. */
  available: boolean
}) {
  const icones = iconeCommande()

  return (
    <>
    {/* Le panneau est toujours rendu, dans l'une de deux formes : déployé,
        ou réduit à une bande qui ne porte que son bouton. Le faire
        disparaître ne laissait rien à l'écran pour dire qu'il existe, et
        son bouton vivait dans la barre d'outils du terminal — loin de ce
        qu'il commande (T-0225). */}
    {!ouverte ? (
      <div
        style={s(
          (layout === 'side'
            ? 'height: 28px; border-top: 1px solid var(--color-border-chrome);'
            : 'width: 28px; border-left: 1px solid var(--color-border-chrome);') +
            ' flex: none; display: flex; align-items: center; justify-content: center; padding: 4px;',
        )}
      >
        <BoutonBande ouverte={false} layout={layout} onToggle={() => onOuverte(true)} />
      </div>
    ) : (
    <div
      style={s(
        layout === 'side'
          ? 'flex: none; border-top: 1px solid var(--color-border-chrome); padding: 12px 14px;'
          : 'width: 268px; flex: none; border-left: 1px solid var(--color-border-chrome); padding: 12px 14px; overflow: auto;',
      )}
    >
      {/* La session s'ouvre pour tout projet du registre — c'est ce qui
          permet de l'équiper depuis le terminal. Mais sans `ovrsee/`, rien
          de ce qui s'y passe n'est capté : le dire ici plutôt que de laisser
          croire que les plans sont enregistrés. */}
      {snapshot && !snapshot.equipped && (
        <div
          style={s(
            'font-size: 11px; color: var(--color-warn); background: var(--color-warn-bg); border: 1px solid var(--color-warn-border); border-radius: 6px; padding: 6px 8px; margin-bottom: 12px;',
          )}
        >
          <div style={s('font-weight: 500;')}>{t('terminal.not_equipped')}</div>
          <div>{t('terminal.not_equipped_desc')}</div>
        </div>
      )}

      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <div
          style={s(
            'flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-discrete);',
          )}
        >
          {t('terminal.actions_section')}
        </div>
        <BoutonBande ouverte layout={layout} onToggle={() => onOuverte(false)} />
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
        {actions.map(action => {
          const Icone = icones[action.label]
          // La pastille de mode dit ce qui arrive au clic : partir tout de
          // suite, ou s'écrire et attendre. Elle reste en gris pour ne pas
          // concurrencer l'icône d'accent des commandes livrées.
          const part = decideInjection(action.text).mode === 'command'
          const Mode = part ? Play : PencilSimple
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => onActiver(action.label, action.text)}
              style={s(
                'cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
              )}
              title={`${action.text} — ${t(part ? 'terminal.mode_run' : 'terminal.mode_paste')}`}
            >
              <Mode
                size={12}
                weight={part ? 'fill' : 'regular'}
                aria-hidden="true"
                color="var(--color-text-quaternary)"
                style={{ flex: 'none' }}
              />
              {Icone && <Icone size={14} weight="regular" aria-hidden="true" color="var(--color-accent)" />}
              <span style={s('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
                {action.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* La fonctionnalité était invisible : il fallait savoir aller dans
          les préférences pour deviner qu'on pouvait en ajouter (issue #79). */}
      {onOuvrirPreferences && (
        <button
          type="button"
          onClick={onOuvrirPreferences}
          style={s(
            'cursor: pointer; display: flex; align-items: center; gap: 7px; width: 100%; height: 28px; margin-top: 7px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px dashed var(--color-border-control); background: transparent; color: var(--color-text-quaternary);',
          )}
        >
          <Plus size={12} weight="bold" aria-hidden="true" style={{ flex: 'none' }} />
          {t('terminal.create_action')}
        </button>
      )}

      {/* Affiche les erreurs si présentes */}
      {erreurs.length > 0 && (
        <div style={s('display: flex; flex-direction: column; gap: 6px; margin-top: 12px;')}>
          {erreurs.map(err => (
            <div
              key={err.label}
              style={s(
                'font-size: 11px; color: var(--color-err); background: var(--color-err-bg); border: 1px solid var(--color-err-border); border-radius: 6px; padding: 6px 8px;',
              )}
            >
              <div style={s('font-weight: 500;')}>{err.label}</div>
              <div>{err.error}</div>
            </div>
          ))}
        </div>
      )}

      {/* Hors de la liste : ce bouton n'écrit rien dans le terminal, il
          fait relire `ovrsee/` à l'interface. Le ranger avec les commandes
          laissait croire qu'il lançait quelque chose. */}
      <div style={s('margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border-chrome);')}>
        <button
          type="button"
          onClick={onRecharger}
          style={s(
            'cursor: pointer; display: flex; align-items: center; width: 100%; height: 28px; text-align: left; font-size: 11.5px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
          )}
        >
          {t('terminal.refresh_ovrsee')}
        </button>
        <div style={s('font-size: 11px; color: var(--color-text-quaternary); margin-top: 6px; line-height: 1.5;')}>
          {t('terminal.reload_hint')}
        </div>
      </div>

      <div style={s('font-size: 11px; color: var(--color-text-quaternary); margin-top: 13px; line-height: 1.5;')}>
        {notice ??
          (error
            ? error
            : available
              ? t('terminal.click_injects')
              : t('terminal.click_copies'))}
      </div>
    </div>
    )}
    </>
  )
}
