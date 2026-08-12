import { useState } from 'react'

import { briefLines, buildActions, type Snapshot, type SettingsType } from './data'
import { s } from './style'
import { t, type TranslationKey } from './i18n'
import { useTerminals, pasteToClaude } from './useTerminal'
import { Divider, useResizable } from './useResizable'

export type Layout = 'bottom' | 'side' | 'full'

const LAYOUT_IDS: Layout[] = ['bottom', 'side', 'full']

const layoutLabel = (layout: Layout): string => {
  const map: Record<Layout, TranslationKey> = {
    'bottom': 'terminal.layout_bottom',
    'side': 'terminal.layout_side',
    'full': 'terminal.layout_full',
  }
  return t(map[layout])
}

/**
 * Le panneau se dimensionne selon sa disposition.
 *
 * « Plein » n'a pas de taille propre : il prend tout. Les deux autres ont leur
 * séparateur, avec une clé de conservation distincte — une hauteur de 244 px
 * et une largeur de 468 px ne se mélangent pas.
 */
const panelStyle = (layout: Layout, size: number): string => {
  if (layout === 'full') {
    return 'flex: 1; background: #0b0c0e; display: flex; flex-direction: column; min-height: 0; min-width: 0;'
  }
  if (layout === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid #17181d; background: #0b0c0e; display: flex; flex-direction: column; min-height: 0;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid #17181d; background: #0b0c0e; display: flex; flex-direction: column; min-height: 0;`
}

/**
 * Panneau terminal — maquette l. 374-418.
 *
 * Un vrai shell tourne derrière, par IPC, dans le dossier du projet
 * sélectionné, avec `claude` lancé d'office ; les boutons d'injection y
 * écrivent. Quitter Claude laisse le shell — le panneau reste utilisable.
 *
 * Dans un navigateur il n'y a pas d'IPC, donc pas de session : le panneau le
 * dit et les boutons se rabattent sur le presse-papier. Un bouton qui
 * prétendrait écrire dans une session inexistante serait un mensonge
 * d'interface ; un bouton qui copie fait ce qu'il annonce.
 */
export function Terminal({
  layout,
  onLayout,
  onToggle,
  onReload,
  snapshot,
  settings,
  terminalHeight,
  terminalWidth,
  onTerminalHeightChange,
  onTerminalWidthChange,
}: {
  layout: Layout
  onLayout: (layout: Layout) => void
  onToggle: () => void
  /** Relit `ovrsee/` — après un scan, l'interface ne se met pas à jour seule. */
  onReload: () => void
  snapshot: Snapshot | null
  /** Vient d'`App` et pas d'un `fetchSettings()` local : une copie chargée au
      montage ne verrait jamais l'enregistrement des préférences. */
  settings: SettingsType | null
  terminalHeight: number
  terminalWidth: number
  onTerminalHeightChange: (height: number) => void
  onTerminalWidthChange: (width: number) => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const {
    sessions,
    active,
    setActive,
    attach,
    openShell,
    closeShell,
    errors,
    focusClaude,
    claudeKey,
    available,
  } = useTerminals(snapshot?.root ?? null)

  const error = active ? (errors[active] ?? null) : null

  // Tirer vers le haut agrandit le panneau du bas ; tirer vers la gauche
  // agrandit celui du côté. D'où `invert` dans les deux cas.
  //
  // Les tailles initiales viennent des préférences, et la callback met à jour
  // le state parent au lieu du localStorage.
  const height = useResizable({
    key: 'terminal.bottom',
    initial: terminalHeight,
    min: 120,
    max: () => window.innerHeight * 0.7,
    axis: 'y',
    invert: true,
    onResize: onTerminalHeightChange,
  })
  const widthSide = useResizable({
    key: 'terminal.side',
    initial: terminalWidth,
    min: 320,
    max: () => window.innerWidth * 0.7,
    axis: 'x',
    invert: true,
    onResize: onTerminalWidthChange,
  })

  const sizing = layout === 'side' ? widthSide : height

  /**
   * Un clic écrit dans la session quand elle existe, et copie sinon.
   *
   * Tout passe par le collage encadré, commandes comprises : le texte se dépose
   * dans la saisie de `claude` sans être validé. C'est délibéré — une commande
   * qui partait au clic ne laissait aucune place au contexte qu'on voulait lui
   * ajouter. Le curseur suit, sinon il faudrait cliquer dans la grille pour
   * compléter.
   *
   * Le repli n'est pas un pis-aller déguisé : le libellé du panneau change
   * aussi, pour que le bouton ne prétende jamais écrire dans une session
   * inexistante.
   */
  const activate = async (label: string, text: string) => {
    if (pasteToClaude(text)) {
      if (claudeKey) setActive(claudeKey)
      // Après le rendu : une session inactive est `inert`, et `focus()` n'y
      // prend pas tant que React n'a pas commis le changement d'onglet.
      setTimeout(focusClaude, 0)
      setNotice(`« ${label} » écrit dans le terminal`)
      setTimeout(() => setNotice(null), 2000)
      return
    }

    // Repli : pas de session (navigateur)
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`« ${label} » copié`)
      setTimeout(() => setNotice(null), 2000)
    } catch {
      setNotice(t('navigateur.copy_failed'))
      setTimeout(() => setNotice(null), 2000)
    }
  }

  // Construit les actions livrées et personnalisées quand les paramètres sont disponibles
  const allActions = settings ? buildActions(snapshot, settings) : []

  // Sépare les actions en deux catégories : commandes (! ou /) et contexte (texte brut)
  const commands = allActions.filter((a): a is { label: string; text: string } => {
    if ('error' in a) return false // Ignore les erreurs pour le classement
    return a.text.startsWith('!') || a.text.startsWith('/')
  })
  const context = allActions.filter((a): a is { label: string; text: string } => {
    if ('error' in a) return false
    return !a.text.startsWith('!') && !a.text.startsWith('/')
  })
  const actionErrors = allActions.filter((a): a is { label: string; error: string } => 'error' in a)

  return (
    <>
      {layout !== 'full' && <Divider axis={layout === 'side' ? 'x' : 'y'} resizable={sizing} />}
      <div style={s(panelStyle(layout, sizing.size))}>
      <div
        style={s(
          'height: 34px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid #17181d;',
        )}
      >
        <span
          title={available ? t('a11y.session_active') : t('a11y.terminal_available')}
          style={s(
            available && !error
              ? 'width: 6px; height: 6px; border-radius: 50%; background: #7d76f0; display: block; flex: none;'
              : 'width: 6px; height: 6px; border-radius: 50%; border: 1px solid #55585f; display: block; flex: none;',
          )}
        />

        {/* Une pastille par session. Le shell nu sert à lancer un serveur de
            dev ou à suivre des logs sans occuper la session Claude. */}
        <div style={s('display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden;')}>
          {sessions.map(session => (
            <div
              key={session.key}
              style={s(
                'display: flex; align-items: center; border-radius: 5px; border: 1px solid ' +
                  (active === session.key ? '#2a2660; background: #14132a;' : 'transparent; background: transparent;'),
              )}
            >
              <button
                type="button"
                onClick={() => setActive(session.key)}
                style={s(
                  'cursor: pointer; font-family: var(--font-body); font-size: 11px; letter-spacing: .04em; padding: 3px 8px; border: 0; background: transparent; color: ' +
                    (active === session.key ? '#a49dfa;' : '#9096a0;'),
                )}
              >
                {session.label}
              </button>
              {session.kind !== 'claude' && (
                <button
                  type="button"
                  title={t('terminal.close_session')}
                  aria-label={t('terminal.close_session_aria', { label: session.label })}
                  onClick={() => closeShell(session.key)}
                  style={s(
                    'cursor: pointer; border: 0; background: transparent; color: #62666e; font-size: 12px; line-height: 1; padding: 3px 6px 3px 0;',
                  )}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={openShell}
            title={t('terminal.open_shell')}
            aria-label={t('terminal.open_shell')}
            disabled={!available}
            style={s(
              'cursor: pointer; font-family: var(--font-body); font-size: 13px; line-height: 1; padding: 3px 8px; border-radius: 5px; border: 1px solid transparent; background: transparent; color: #62666e;',
            )}
          >
            +
          </button>
        </div>

        <div style={s('flex: 1;')} />
        <span
          style={s(
            'font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #55585f;',
          )}
        >
          {t('terminal.layouts')}
        </span>
        <div style={s('display: flex; gap: 2px;')}>
          {LAYOUT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onLayout(id)}
              style={s(
                'cursor: pointer; font-family: var(--font-body); font-size: 10.5px; letter-spacing: .06em; padding: 3px 9px; border-radius: 5px; border: 1px solid ' +
                  (layout === id
                    ? '#24252c; background: #24252c; color: #f2f3f5;'
                    : '#22232a; background: transparent; color: #9096a0;'),
              )}
            >
              {layoutLabel(id)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="btn btn-ghost"
          style={s('font-size: 11px; padding: 4px 9px;')}
        >
          {t('terminal.reduce')}
        </button>
      </div>

      <div
        style={s(
          layout === 'side'
            ? 'flex: 1; display: flex; flex-direction: column; min-height: 0;'
            : 'flex: 1; display: flex; min-height: 0;',
        )}
      >
        {available && (
          // Session réelle : xterm occupe la zone, `claude` tourne derrière.
          //
          // Les sessions sont empilées et toutes montées, l'inactive rendue
          // transparente. Pas `display: none` : un conteneur de largeur nulle
          // fait calculer à FitAddon une grille fausse, et `claude` se
          // réafficherait de travers au retour sur l'onglet.
          <div style={s('flex: 1; min-width: 0; min-height: 0; position: relative;')}>
            {sessions.map(session => (
              <div
                key={session.key}
                ref={attach(session)}
                // `inert` va avec la transparence : sans lui, la zone de saisie
                // d'une session cachée reste dans l'ordre de tabulation, et le
                // clavier traverse des terminaux qu'on ne voit pas. `inert` ne
                // touche pas à la mise en page, donc FitAddon continue de
                // mesurer juste — c'est pourquoi on ne peut pas juste passer en
                // `display: none`.
                inert={active !== session.key}
                style={s(
                  'position: absolute; inset: 8px 4px 8px 10px; ' +
                    (active === session.key
                      ? 'opacity: 1; z-index: 1;'
                      : 'opacity: 0; pointer-events: none; z-index: 0;'),
                )}
              />
            ))}
          </div>
        )}

        {/* Sans passerelle IPC — c'est-à-dire dans un navigateur — pas de
            terminal. On le dit, plutôt que d'afficher une invite qui ne
            répondrait jamais. */}
        <div
          hidden={available}
          style={s(
            'flex: 1; overflow: auto; padding: 12px 14px; font-family: var(--font-mono); font-size: 12px; line-height: 1.75; min-width: 0;',
          )}
        >
          {briefLines(snapshot).map((line, i) => (
            <div key={i} style={s(line.style)}>
              {line.text || ' '}
            </div>
          ))}
          <div style={s('display: flex; align-items: center; gap: 7px; color: #62666e;')}>
            <span style={s('color: #4e5158;')}>›</span>
            <span>{t('terminal.no_terminal_browser')}</span>
          </div>
        </div>

        <div
          style={s(
            layout === 'side'
              ? 'flex: none; border-top: 1px solid #17181d; padding: 12px 14px;'
              : 'width: 268px; flex: none; border-left: 1px solid #17181d; padding: 12px 14px;',
          )}
        >
          {/* La session s'ouvre pour tout projet du registre — c'est ce qui
              permet de l'équiper depuis le terminal. Mais sans `ovrsee/`, rien
              de ce qui s'y passe n'est capté : le dire ici plutôt que de laisser
              croire que les plans sont enregistrés. */}
          {snapshot && !snapshot.equipped && (
            <div
              style={s(
                'font-size: 11px; color: #e3b341; background: #1a1608; border: 1px solid #3a3117; border-radius: 6px; padding: 6px 8px; margin-bottom: 12px;',
              )}
            >
              <div style={s('font-weight: 500;')}>{t('terminal.not_equipped')}</div>
              <div>{t('terminal.not_equipped_desc')}</div>
            </div>
          )}

          {/* Section : Commandes pour Claude */}
          <div
            style={s(
              'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #55585f;',
            )}
          >
            {t('terminal.commands_section')}
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
            {commands.map(action => (
              <button
                key={action.label}
                type="button"
                onClick={() => activate(action.label, action.text)}
                style={s(
                  'cursor: pointer; text-align: left; font-size: 11.5px; padding: 5px 10px; border-radius: 6px; border: 1px solid #22232a; background: #101114; color: #d5d8dd;',
                )}
                title={action.text}
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Affiche les erreurs si présentes */}
          {actionErrors.length > 0 && (
            <div style={s('display: flex; flex-direction: column; gap: 6px; margin-top: 12px;')}>
              {actionErrors.map(err => (
                <div
                  key={err.label}
                  style={s(
                    'font-size: 11px; color: #e5677a; background: #1c0d10; border: 1px solid #3a1c22; border-radius: 6px; padding: 6px 8px;',
                  )}
                >
                  <div style={s('font-weight: 500;')}>{err.label}</div>
                  <div>{err.error}</div>
                </div>
              ))}
            </div>
          )}

          {/* Section : Contexte pour Claude */}
          {context.length > 0 && (
            <>
              <div
                style={s(
                  'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #55585f; margin-top: 18px;',
                )}
              >
                {t('terminal.context_section')}
              </div>
              <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
                {context.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => activate(action.label, action.text)}
                    style={s(
                      'cursor: pointer; text-align: left; font-size: 11.5px; padding: 5px 10px; border-radius: 6px; border: 1px solid #22232a; background: #101114; color: #d5d8dd;',
                    )}
                    title={action.text}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Hors des deux sections : ce bouton n'écrit rien dans le terminal,
              il fait relire `ovrsee/` à l'interface. Le ranger avec les
              commandes laissait croire qu'il lançait quelque chose. */}
          <div style={s('margin-top: 18px; padding-top: 14px; border-top: 1px solid #17181d;')}>
            <button
              type="button"
              onClick={onReload}
              style={s(
                'cursor: pointer; width: 100%; text-align: left; font-size: 11.5px; padding: 5px 10px; border-radius: 6px; border: 1px solid #22232a; background: #101114; color: #d5d8dd;',
              )}
            >
              {t('terminal.refresh_ovrsee')}
            </button>
            <div style={s('font-size: 11px; color: #62666e; margin-top: 6px; line-height: 1.5;')}>
              {t('terminal.reload_hint')}
            </div>
          </div>

          <div style={s('font-size: 11px; color: #62666e; margin-top: 13px; line-height: 1.5;')}>
            {notice ??
              (error
                ? error
                : available
                  ? t('terminal.click_injects')
                  : t('terminal.click_copies'))}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
