import { useEffect } from 'react'

import { frDate, humanAge, shotDate, shotUrl } from './data'
import { s } from './style'
import { t } from './i18n'

/** `2026-08-08-51461bf.png` → `51461bf`. Le sha relie la capture à un commit. */
const shotSha = (file: string): string => file.slice(11).replace(/\.png$/, '')

/**
 * Visionneuse plein écran des captures d'une page.
 *
 * Le rail de détail montre une vignette rognée et quatre miniatures de 44 px :
 * de quoi reconnaître une page, pas de quoi la lire ni comparer deux dates.
 * Les captures successives sont pourtant toutes sur le disque. Ici elles sont
 * montrées entières — `object-fit: contain`, jamais de rognage — et la frise
 * du bas donne accès à toutes, pas aux quatre dernières.
 *
 * `files` est ordonné du plus récent au plus ancien, comme le rend
 * `shotsByPage()`. La frise, elle, se lit de gauche à droite dans le sens du
 * temps : c'est le sens dans lequel on remonte un historique.
 */
export function Lightbox({
  root,
  slug,
  files,
  index,
  onIndex,
  onClose,
  label,
}: {
  root: string
  slug: string
  files: string[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  label: string
}) {
  // Bornes : `index` vient du composant appelant, qui peut avoir changé de page.
  const at = Math.min(Math.max(index, 0), files.length - 1)
  const file = files[at]

  // Plus récent à gauche dans le tableau, donc « précédent dans le temps »
  // avance dans le tableau. Les flèches suivent le temps, pas l'index.
  const step = (delta: number) => onIndex(Math.min(Math.max(at - delta, 0), files.length - 1))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!file) return null

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; flex-direction: column; padding: 16px 20px 14px;',
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 12px; flex: none;')}>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost"
          style={s('font-size: 12px; padding: 4px 10px;')}
        >
          ✕ {t('lightbox.close')}
        </button>
        <div style={s('font-size: 12.5px; color: var(--color-neutral-400);')}>{label}</div>
        <div style={s('flex: 1;')} />
        <div style={s('font-size: 11px; color: var(--color-neutral-600);')}>
          {/* Compté dans le sens du temps, comme la frise : la dernière
              capture est la n-ième, pas la première. */}
          {files.length - at} / {files.length} — {t('lightbox.navigation')}
        </div>
      </div>

      {/* Le clic sur l'image ne ferme pas : on zoome pour regarder, pas pour sortir. */}
      <div
        onClick={event => event.stopPropagation()}
        style={s('flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px 0;')}
      >
        <Arrow label="‹" title={t('a11y.older_shot')} disabled={at >= files.length - 1} onClick={() => step(-1)} />
        <img
          src={shotUrl(root, `shots/${slug}/${file}`)}
          alt={`${label} — ${frDate(shotDate(file))}`}
          style={s(
            'max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; border: 1px solid var(--color-neutral-800); box-shadow: 0 24px 60px rgba(0,0,0,.6); background: var(--theme-bg-lightbox);',
          )}
        />
        <Arrow label="›" title={t('a11y.newer_shot')} disabled={at <= 0} onClick={() => step(1)} />
      </div>

      <div
        onClick={event => event.stopPropagation()}
        style={s('flex: none; display: flex; flex-direction: column; align-items: center; gap: 9px;')}
      >
        <div style={s('display: flex; align-items: baseline; gap: 9px;')}>
          <span style={s('font-size: 13px; color: var(--color-text);')}>{frDate(shotDate(file))}</span>
          <span style={s('font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-accent);')}>
            {shotSha(file)}
          </span>
          <span style={s('font-size: 11px; color: var(--color-neutral-600);')}>
            {humanAge(shotDate(file))}
          </span>
        </div>

        {/* Frise : un point par capture, du plus ancien au plus récent. */}
        <div style={s('display: flex; align-items: center; gap: 0; max-width: 100%; overflow-x: auto; padding: 4px 2px;')}>
          {[...files].reverse().map((candidate, i) => {
            const position = files.length - 1 - i
            const current = position === at
            return (
              <button
                key={candidate}
                type="button"
                title={frDate(shotDate(candidate))}
                onClick={() => onIndex(position)}
                style={s(
                  'display: flex; align-items: center; gap: 0; background: transparent; border: 0; padding: 0 7px; cursor: pointer;',
                )}
              >
                <span
                  style={s(
                    current
                      ? 'width: 9px; height: 9px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 10px var(--color-accent); display: block;'
                      : 'width: 6px; height: 6px; border-radius: 50%; background: var(--color-neutral-700); display: block;',
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Arrow({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string
  title: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={s(
        'flex: none; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--color-neutral-800); background: rgba(19,20,31,.8); font-size: 19px; line-height: 1; ' +
          (disabled
            ? 'color: rgba(233,233,237,.4); cursor: default;'
            : 'color: rgba(233,233,237,.92); cursor: pointer;'),
      )}
    >
      {label}
    </button>
  )
}
