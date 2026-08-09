import { useEffect, useState } from 'react'

import { fetchSettings, updateSettings, type SettingsType } from './data'
import { s } from './style'

/**
 * Paramètres d'historique : granularité et fenêtre.
 *
 * Débloque : B1 (densité d'historique).
 */
function PreferencesDensity({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  // Placeholder pour B1 : UI de densité d'activité
  return <div style={s('padding: 0;')} />
}

/**
 * Affichage : onglets, terminal, thème.
 *
 * Débloque : B2 (onglets + thème + terminal).
 */
function PreferencesDisplay({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  // Placeholder pour B2 : UI onglets, terminal, thème
  return <div style={s('padding: 0;')} />
}

/**
 * Actions personnalisées.
 *
 * Débloque : B3 (actions perso).
 */
function PreferencesActions({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  // Placeholder pour B3 : UI actions personnalisées
  return <div style={s('padding: 0;')} />
}

/**
 * Commandes proposées une seule fois à l'initialisation.
 *
 * Débloque : C1 (chantier neuf projet).
 * À noter : C1 ne fait pas partie de A1 — ce composant reste ici pour la
 * structure, mais ne s'affichera que quand C1 sera implémentée.
 */
function PreferencesBootstrap({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  // Placeholder pour C1 : UI bootstrap
  return <div style={s('padding: 0;')} />
}

/**
 * Paramètres avancés : gestionnaire de paquets, source de graphe.
 *
 * Pas de débloquage — c'est le socle de A1 qui les porte juste.
 */
function PreferencesAdvanced({
  settings,
  onSettings,
}: {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}) {
  return (
    <div style={s('display: flex; flex-direction: column; gap: 12px;')}>
      <div>
        <label style={s('display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;')}>
          Gestionnaire de paquets
        </label>
        <input
          type="text"
          value={settings.packageManager}
          onChange={e =>
            onSettings({ ...settings, packageManager: e.target.value })
          }
          style={s(
            'width: 100%; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 12px;',
          )}
        />
      </div>

      <div>
        <label style={s('display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;')}>
          Source de graphe
        </label>
        <select
          value={settings.sourceGraphe}
          onChange={e =>
            onSettings({ ...settings, sourceGraphe: e.target.value })
          }
          style={s(
            'width: 100%; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 12px;',
          )}
        >
          <option value="auto">Automatique (Graphify ou Obsidian)</option>
          <option value="graphify">Graphify uniquement</option>
          <option value="obsidian">Obsidian uniquement</option>
        </select>
      </div>
    </div>
  )
}

/**
 * Modale de préférences, calquée sur SkillsPanel.
 *
 * Sections : Densité (B1), Affichage (B2), Actions (B3), Bootstrap (C1), Avancé.
 * Chaque section est responsable de sa validation et de son affichage.
 */
export function PreferencesModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    setBusy(true)
    fetchSettings()
      .then(s => setSettings(s))
      .catch(err => setErreur(String(err.message ?? err)))
      .finally(() => setBusy(false))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = () => {
    if (!settings) return
    setBusy(true)
    setErreur(null)
    updateSettings(settings)
      .then(() => {
        onClose()
      })
      .catch(err => setErreur(String(err.message ?? err)))
      .finally(() => setBusy(false))
  }

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px;',
      )}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={s(
          'width: min(560px, 100%); max-height: 100%; overflow: auto; background: #13141f; border: 1px solid var(--color-divider); border-radius: 8px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;',
        )}
      >
        <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
          <h2
            style={s(
              'font-family: var(--font-heading); font-weight: 500; font-size: 16px; margin: 0;',
            )}
          >
            Préférences
          </h2>
          <div style={s('flex: 1;')} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>

        {busy && <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>Chargement…</div>}

        {!busy && !settings && erreur && (
          <div
            style={s(
              'font-size: 12px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
            )}
          >
            {erreur}
          </div>
        )}

        {settings && (
          <>
            <PreferencesDensity settings={settings} onSettings={setSettings} />
            <PreferencesDisplay settings={settings} onSettings={setSettings} />
            <PreferencesActions settings={settings} onSettings={setSettings} />
            <PreferencesBootstrap settings={settings} onSettings={setSettings} />

            <div style={s('border-top: 1px solid var(--color-divider); padding-top: 12px;')}>
              <details style={s('cursor: pointer;')}>
                <summary style={s('font-size: 12px; font-weight: 500; user-select: none;')}>
                  Avancé
                </summary>
                <div style={s('margin-top: 12px;')}>
                  <PreferencesAdvanced settings={settings} onSettings={setSettings} />
                </div>
              </details>
            </div>

            {erreur && (
              <div
                style={s(
                  'font-size: 12px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
                )}
              >
                {erreur}
              </div>
            )}
          </>
        )}

        {settings && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleSave}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  )
}
