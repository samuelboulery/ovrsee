/**
 * Les templates d'interface — la section « Profils » des préférences.
 *
 * Un template n'est pas un état : c'est une constante qu'on applique. Cliquer
 * « Appliquer » écrit les onglets et le terminal dans les réglages, et il ne
 * reste rien qui se souvienne du template choisi. C'est le choix qui évite un
 * champ `profil` à persister, à valider, à migrer, et un calcul permanent de
 * « ce réglage s'écarte-t-il encore du profil ? ».
 *
 * Un template ne touche que ce qui compose l'interface : quels onglets, dans
 * quel ordre, et où se pose le terminal. Le thème, la langue, la densité, les
 * actions, les commandes de démarrage restent ceux de l'utilisateur — ce sont
 * ses préférences, pas une conséquence de son usage du jour.
 */

import type { SettingsType } from './data'
import { t, type TranslationKey } from './i18n'
import { ORDRE_USINE, PreferencesPreview } from './PreferencesPreview'
import { SectionTitle } from './PreferencesControls'
import { s } from './style'

type Profil = {
  id: string
  cle: TranslationKey
  cleDesc: TranslationKey
  actifs: string[]
  terminal: { visible: boolean; disposition: string }
}

/**
 * Les quatre bases livrées.
 *
 * `actifs` donne aussi l'ordre : un template range les onglets, il ne se
 * contente pas de les allumer. « Complet » reprend l'ordre d'usine, ce qui en
 * fait au passage le « revenir à zéro » de l'écran.
 */
export const PROFILS: Profil[] = [
  {
    id: 'complet',
    cle: 'pref.profile_complet',
    cleDesc: 'pref.profile_complet_desc',
    actifs: [...ORDRE_USINE],
    terminal: { visible: true, disposition: 'bottom' },
  },
  {
    id: 'sobre',
    cle: 'pref.profile_sobre',
    cleDesc: 'pref.profile_sobre_desc',
    actifs: ['apercu', 'tableau', 'donnees'],
    terminal: { visible: false, disposition: 'bottom' },
  },
  {
    id: 'revue',
    cle: 'pref.profile_revue',
    cleDesc: 'pref.profile_revue_desc',
    actifs: ['apercu', 'navigateur', 'produit', 'historique'],
    terminal: { visible: false, disposition: 'bottom' },
  },
  {
    id: 'dev',
    cle: 'pref.profile_dev',
    cleDesc: 'pref.profile_dev_desc',
    actifs: ['apercu', 'tableau', 'stack', 'historique'],
    terminal: { visible: true, disposition: 'side' },
  },
]

/**
 * Applique un template aux préférences.
 *
 * L'invariant est ici : `onglets.ordre` doit toujours porter les sept
 * identifiants, sinon `validateSettings` (`hooks/settings.js`) rejette le
 * tableau sans rien dire et le rangement de l'utilisateur retombe à l'usine.
 * D'où l'union de trois sources — les onglets du template d'abord, l'ordre
 * existant ensuite, l'ordre d'usine en dernier recours pour le cas d'un
 * fichier abîmé.
 *
 * Les tailles du terminal ne bougent pas : un template choisit une
 * disposition, il ne redimensionne pas la fenêtre de quelqu'un.
 *
 * @param settings les préférences courantes
 * @param profil le template à appliquer
 */
export function appliquerProfil(settings: SettingsType, profil: Profil): SettingsType {
  const ordre = [
    ...new Set([...profil.actifs, ...(settings.onglets?.ordre ?? []), ...ORDRE_USINE]),
  ]
  return {
    ...settings,
    onglets: { ordre, actifs: [...profil.actifs] },
    terminal: { ...settings.terminal, ...profil.terminal },
  }
}

/**
 * Le template dont les réglages correspondent exactement, ou `null`.
 *
 * Seuls les quatre champs qu'un template écrit sont comparés — l'ordre des
 * onglets masqués, lui, n'a aucun effet visible et deux réglages qui ne
 * diffèrent que par là sont le même écran.
 *
 * @param settings les préférences courantes
 */
export function profilCourant(settings: SettingsType): string | null {
  const actifs = settings.onglets?.actifs ?? []
  const terminal = settings.terminal
  const trouve = PROFILS.find(
    profil =>
      profil.actifs.length === actifs.length &&
      profil.actifs.every((id, index) => actifs[index] === id) &&
      terminal?.visible === profil.terminal.visible &&
      // La disposition ne compte que si le terminal est visible : masqué, elle
      // ne se voit nulle part et n'a pas à disqualifier un template.
      (!profil.terminal.visible || terminal?.disposition === profil.terminal.disposition),
  )
  return trouve?.id ?? null
}

/** Une carte : la maquette de ce que le template donne, puis son bouton. */
function CarteProfil({
  profil,
  settings,
  courant,
  onSettings,
}: {
  profil: Profil
  settings: SettingsType
  courant: boolean
  onSettings: (settings: SettingsType) => void
}) {
  return (
    <div
      style={s(
        'display: flex; flex-direction: column; gap: 9px; padding: 11px; border-radius: 9px;' +
          (courant
            ? ' border: 1px solid var(--color-accent);'
            : ' border: 1px solid var(--color-divider);'),
      )}
    >
      {/* La maquette est la description : elle montre les onglets retenus et
          la place du terminal mieux qu'une phrase ne le dirait. */}
      <PreferencesPreview settings={appliquerProfil(settings, profil)} />

      <div>
        <div style={s('font-size: 13px; color: var(--color-text);')}>{t(profil.cle)}</div>
        <div
          style={s(
            'margin-top: 3px; font-size: 11.5px; line-height: 1.45; color: var(--color-neutral-500);',
          )}
        >
          {t(profil.cleDesc)}
        </div>
      </div>

      <button
        type="button"
        className={courant ? 'btn btn-ghost btn-block' : 'btn btn-primary btn-block'}
        disabled={courant}
        onClick={() => onSettings(appliquerProfil(settings, profil))}
        style={s('font-size: 12px;')}
      >
        {courant ? t('pref.profile_current') : t('pref.profile_apply')}
      </button>
    </div>
  )
}

/** La galerie des templates. */
export function SectionProfils({
  settings,
  onSettings,
  courant: force,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
  /**
   * Le template à marquer courant, quand l'appelant le sait mieux que les
   * réglages. La présentation s'en sert : elle suggère un template puis pose
   * le terminal d'après l'usage déclaré, si bien qu'aucun template ne
   * correspond plus exactement et que la galerie n'en montrerait aucun.
   */
  courant?: string | null
}) {
  const courant = force ?? profilCourant(settings)

  return (
    <>
      <SectionTitle>{t('pref.profiles')}</SectionTitle>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.profiles_desc')}
      </p>

      <div style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;')}>
        {PROFILS.map(profil => (
          <CarteProfil
            key={profil.id}
            profil={profil}
            settings={settings}
            courant={courant === profil.id}
            onSettings={onSettings}
          />
        ))}
      </div>
    </>
  )
}
