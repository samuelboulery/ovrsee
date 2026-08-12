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
  terminal: { visible: boolean; disposition: string; disabled: boolean }
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
    terminal: { visible: true, disposition: 'bottom', disabled: false },
  },
  {
    id: 'sobre',
    cle: 'pref.profile_sobre',
    cleDesc: 'pref.profile_sobre_desc',
    actifs: ['apercu', 'tableau', 'historique'],
    terminal: { visible: false, disposition: 'bottom', disabled: true },
  },
  {
    id: 'revue',
    cle: 'pref.profile_revue',
    cleDesc: 'pref.profile_revue_desc',
    actifs: ['apercu', 'navigateur', 'produit', 'historique'],
    terminal: { visible: false, disposition: 'bottom', disabled: true },
  },
  {
    id: 'dev',
    cle: 'pref.profile_dev',
    cleDesc: 'pref.profile_dev_desc',
    actifs: ['apercu', 'tableau', 'stack', 'historique'],
    terminal: { visible: true, disposition: 'side', disabled: false },
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
      (!profil.terminal.visible || terminal?.disposition === profil.terminal.disposition) &&
      (terminal?.disabled ?? false) === profil.terminal.disabled,
  )
  return trouve?.id ?? null
}

/**
 * Une carte compacte : la maquette de ce que le template donne, un point de
 * sélection façon radio, puis son nom et sa description. Toute la carte est
 * cliquable — le clic applique le template, il n'y a pas de bouton séparé
 * (maquette 2j).
 */
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
    <button
      type="button"
      aria-pressed={courant}
      onClick={() => onSettings(appliquerProfil(settings, profil))}
      style={s(
        'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9px; padding: 10px;' +
          ' border-radius: 10px; text-align: left; cursor: pointer; font: inherit; color: inherit;' +
          (courant
            ? ' border: 1px solid var(--color-accent-600); background: var(--color-surface-active);'
            : ' border: 1px solid var(--color-divider); background: var(--color-surface-card);'),
      )}
    >
      {/* La maquette est la description : elle montre les onglets retenus et
          la place du terminal mieux qu'une phrase ne le dirait. */}
      <PreferencesPreview settings={appliquerProfil(settings, profil)} />

      <div style={s('display: flex; align-items: center; gap: 7px;')}>
        <div
          style={s(
            'box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%; flex: none;' +
              ' display: flex; align-items: center; justify-content: center;' +
              (courant
                ? ' border: 1.5px solid var(--color-accent);'
                : ' border: 1.5px solid var(--color-neutral-700);'),
          )}
        >
          {courant && (
            <div style={s('width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent);')} />
          )}
        </div>
        <div style={s('font-size: 12px; font-weight: 500; color: var(--color-text);')}>{t(profil.cle)}</div>
      </div>

      <div style={s('font-size: 11px; line-height: 1.55; color: var(--color-neutral-500);')}>
        {t(profil.cleDesc)}
      </div>
    </button>
  )
}

/** La galerie des templates. */
export function SectionProfils({
  settings,
  onSettings,
  courant: force,
  titreCle,
  descCle,
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
  /** Titre/description de remplacement — l'accueil pose sa propre question. */
  titreCle?: TranslationKey
  descCle?: TranslationKey
}) {
  const courant = force ?? profilCourant(settings)

  return (
    <>
      <SectionTitle>{t(titreCle ?? 'pref.profiles')}</SectionTitle>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t(descCle ?? 'pref.profiles_desc')}
      </p>

      <div style={s('display: flex; gap: 10px;')}>
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
