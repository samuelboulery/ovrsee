/**
 * La maquette miniature de la fenêtre, dans l'écran des préférences.
 *
 * Elle répond à une question que l'ancien écran laissait sans réponse :
 * « qu'est-ce que ça donne ? ». Cocher un onglet ou changer la disposition du
 * terminal ne montrait rien tant qu'on n'avait pas enregistré et fermé.
 *
 * Ce n'est pas un rendu de l'application — c'est un schéma. Il ne montre que
 * ce que les préférences décident : quels onglets, dans quel ordre, et où se
 * pose le terminal. Le thème, lui, n'a pas besoin d'aperçu : l'enregistrement
 * est immédiat, donc c'est l'application entière derrière la modale qui bascule.
 */

import type { SettingsType } from './data'
import { t, type TranslationKey } from './i18n'
import { s } from './style'

/**
 * Les mêmes sept onglets que `TABS` dans `App.tsx`, et leurs clés.
 *
 * La table est ici — et pas dans `PreferencesPanel.tsx`, qui en gardait une
 * copie — parce que ce fichier n'importe aucune section : les sections peuvent
 * donc toutes s'y référer sans cycle d'import.
 */
export const TAB_KEYS: Record<string, TranslationKey> = {
  apercu: 'tabs.apercu',
  navigateur: 'tabs.navigateur',
  produit: 'tabs.produit',
  historique: 'tabs.historique',
  tableau: 'tabs.tableau',
  donnees: 'tabs.donnees',
  stack: 'tabs.stack',
}

/**
 * L'ordre d'usine des onglets.
 *
 * C'est le dernier recours quand un fichier de préférences abîmé rend un
 * `onglets.ordre` incomplet : `validateSettings` (`hooks/settings.js`) exige
 * les sept identifiants, faute de quoi il rejette le tableau en silence.
 */
export const ORDRE_USINE = Object.keys(TAB_KEYS)

/**
 * Les onglets visibles, dans l'ordre — même règle qu'`activeTabsInOrder()`
 * dans `App.tsx`, mais sur les seuls identifiants : la maquette n'a pas
 * besoin des routes.
 */
export function ongletsVisibles(settings: SettingsType): string[] {
  const ordre = settings.onglets?.ordre ?? []
  const actifs = new Set(settings.onglets?.actifs ?? [])
  return ordre.filter(id => actifs.has(id))
}

/** Une bande grise, à la place d'un texte qu'on ne lirait pas à cette taille. */
function Ligne({ width, dim = false }: { width: number; dim?: boolean }) {
  return (
    <div
      style={s(
        `width: ${width}px; height: 4px; border-radius: 2px; background: var(--color-neutral-${dim ? '800' : '700'});`,
      )}
    />
  )
}

/**
 * La maquette n'a plus de zone à souligner : onglets et terminal se règlent
 * maintenant dans la même section, et les templates la montrent entière.
 *
 * @param settings les préférences en cours d'édition
 */
export function PreferencesPreview({ settings }: { settings: SettingsType }) {
  const onglets = ongletsVisibles(settings)
  const terminal = settings.terminal ?? { visible: false, disposition: 'bottom' }
  const visible = terminal.visible === true
  const disposition = visible ? terminal.disposition : null
  const plein = disposition === 'full'

  // La forme du terminal suit sa disposition : une bande en bas, une colonne
  // à droite, ou tout le cadre. Les trois cas de `layout` dans `App.tsx`.
  const formeTerminal =
    disposition === 'side'
      ? 'flex: none; width: 52px; flex-direction: column; align-items: flex-start; border-left: 1px solid var(--color-divider);'
      : plein
        ? 'flex: 1; align-items: flex-start; border-top: 1px solid var(--color-divider);'
        : 'flex: none; align-items: center; border-top: 1px solid var(--color-divider);'

  const barreTerminal = (
    <div
      style={s(
        'display: flex; gap: 5px; padding: 6px 7px; background: var(--color-surface); font-size: 8px; color: var(--color-neutral-500);' +
          formeTerminal,
      )}
    >
      <span style={s('color: var(--color-accent); line-height: 1;')}>❯</span>
      <Ligne width={disposition === 'side' ? 28 : 44} />
    </div>
  )

  return (
    <div
      aria-hidden="true"
      style={s(
        'height: 132px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-divider); border-radius: 8px; background: var(--color-bg); user-select: none;',
      )}
    >
      {/* Bande de titre — les trois pastilles du système, en 5 px. */}
      <div
        style={s(
          'flex: none; height: 16px; display: flex; align-items: center; gap: 4px; padding: 0 7px; background: var(--color-surface); border-bottom: 1px solid var(--color-divider);',
        )}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={s(
              'width: 5px; height: 5px; border-radius: 50%; background: var(--color-neutral-700);',
            )}
          />
        ))}
      </div>

      <div style={s('flex: 1; display: flex; min-height: 0;')}>
        {/* Barre latérale — projets puis vues, une seule colonne, comme le
            rail (T-0047). Le premier onglet visible porte une surface
            élevée, jamais un liseré de couleur — même règle que le vrai
            rail (`App.tsx`, maquette 2a). */}
        <div
          style={s(
            'flex: none; width: 42px; display: flex; flex-direction: column; gap: 5px; padding: 7px 5px; background: var(--color-surface-panel); border-right: 1px solid var(--color-divider); overflow: hidden;',
          )}
        >
          <Ligne width={26} />
          <Ligne width={18} dim />

          <div style={s('height: 1px; margin: 1px 0; background: var(--color-divider);')} />

          {onglets.map((id, index) => (
            <div
              key={id}
              style={s(
                'display: flex; align-items: center; height: 10px; padding: 0 3px; border-radius: 2px; font-size: 7px; white-space: nowrap; overflow: hidden;' +
                  (index === 0
                    ? ' background: var(--color-surface-active); color: var(--color-text);'
                    : ' color: var(--color-neutral-600);'),
              )}
            >
              {t(TAB_KEYS[id] ?? 'tabs.apercu')}
            </div>
          ))}
        </div>

        <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0;')}>
          <div
            style={s(
              disposition === 'side'
                ? 'flex: 1; display: flex; min-height: 0;'
                : 'flex: 1; display: flex; flex-direction: column; min-height: 0;',
            )}
          >
            {/* Le contenu disparaît sous un terminal plein écran — c'est ce
                que fait `contentVisible` dans `App.tsx`. */}
            {!plein && (
              <div
                style={s(
                  'flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 10px; min-width: 0; min-height: 0;',
                )}
              >
                <Ligne width={56} />
                <Ligne width={38} dim />
                <Ligne width={46} dim />
              </div>
            )}
            {visible && barreTerminal}
          </div>
        </div>
      </div>
    </div>
  )
}
