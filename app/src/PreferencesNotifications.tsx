import type { SettingsType } from './data'
import { t } from './i18n'
import { Row, SectionTitle, Switch } from './PreferencesControls'
import { s } from './style'

/**
 * La section Notifications (T-0307) : le modèle CleanMyMac et ce qui notifie.
 *
 * Tout est relu par le principal et par le hook à chaque usage
 * (`readSettings()`) : rien à redémarrer, sauf la LaunchAgent, que le principal
 * réécrit dès l'enregistrement.
 */

/**
 * Les mêmes que `SONS` dans `hooks/settings.js` — recopiés parce que ce module
 * lit le disque et n'entre pas dans le rendu. Un nom absent de là-bas serait
 * rejeté à l'écriture, et le choix retomberait au défaut.
 */
const SONS = [
  'aucun', 'Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass', 'Hero',
  'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink',
]

/** Les crans du seuil, en minutes. 0 = toute fin de tour notifie. */
const SEUILS = [0, 1, 2, 5, 10, 15, 30]

const NOTIFICATIONS_DEFAUT: NonNullable<SettingsType['notifications']> = {
  barreDeMenus: true,
  lancerAuDemarrage: true,
  finDeTourApresMin: 2,
  sonFin: 'Glass',
  sonQuestion: 'Ping',
  badge: true,
}

const SELECT = 'width: auto; min-height: 32px; font-size: 12.5px;'

export function SectionNotifications({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  const n = settings.notifications ?? NOTIFICATIONS_DEFAUT
  const poser = (patch: Partial<typeof n>) =>
    onSettings({ ...settings, notifications: { ...n, ...patch } })
  const seuils = SEUILS.includes(n.finDeTourApresMin) ? SEUILS : [...SEUILS, n.finDeTourApresMin].sort((a, b) => a - b)

  const choixSon = (label: string, valeur: string, cle: 'sonFin' | 'sonQuestion', last = false) => (
    <Row label={label} last={last}>
      <select
        className="input"
        aria-label={label}
        value={valeur}
        onChange={event => poser({ [cle]: event.target.value })}
        style={s(SELECT)}
      >
        {SONS.map(son => (
          <option key={son} value={son}>
            {son === 'aucun' ? t('pref.notif_sound_none') : son}
          </option>
        ))}
      </select>
    </Row>
  )

  return (
    <>
      <SectionTitle>{t('pref.notifications')}</SectionTitle>
      <Row label={t('pref.notif_menubar')} hint={t('pref.notif_menubar_hint')}>
        <Switch
          label={t('pref.notif_menubar')}
          checked={n.barreDeMenus}
          onChange={barreDeMenus => poser({ barreDeMenus })}
        />
      </Row>
      {/* Sans barre de menus permanente, rien ne tourne après la fenêtre : un
          lancement au login n'aurait rien à montrer. */}
      <Row label={t('pref.notif_login')} hint={t('pref.notif_login_hint')}>
        <Switch
          label={t('pref.notif_login')}
          checked={n.barreDeMenus && n.lancerAuDemarrage}
          disabled={!n.barreDeMenus}
          onChange={lancerAuDemarrage => poser({ lancerAuDemarrage })}
        />
      </Row>
      <Row label={t('pref.notif_threshold')} hint={t('pref.notif_threshold_hint')}>
        <select
          className="input"
          aria-label={t('pref.notif_threshold')}
          value={n.finDeTourApresMin}
          onChange={event => poser({ finDeTourApresMin: Number(event.target.value) })}
          style={s(SELECT)}
        >
          {seuils.map(min => (
            <option key={min} value={min}>
              {min === 0 ? t('pref.notif_always') : t('pref.notif_minutes', { n: min })}
            </option>
          ))}
        </select>
      </Row>
      {choixSon(t('pref.notif_sound_stop'), n.sonFin, 'sonFin')}
      {choixSon(t('pref.notif_sound_question'), n.sonQuestion, 'sonQuestion')}
      <Row label={t('pref.notif_badge')} hint={t('pref.notif_badge_hint')} last>
        <Switch label={t('pref.notif_badge')} checked={n.badge} onChange={badge => poser({ badge })} />
      </Row>
    </>
  )
}
