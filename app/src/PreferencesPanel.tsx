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
  // Crans : chaque cran fixe à la fois granularite et fenetre
  const crans = [
    { label: 'Jour', granularite: 'jour', fenetre: 'jour' },
    { label: 'Semaine', granularite: 'semaine', fenetre: 'semaine' },
    { label: 'Mois', granularite: 'mois', fenetre: 'mois' },
    { label: '3 mois', granularite: 'semaine', fenetre: '3mois' },
    { label: 'An', granularite: 'mois', fenetre: 'an' },
  ] as const

  // Trouve le cran actuel selon la granularité et fenêtre actuelles
  const current = crans.findIndex(
    c =>
      c.granularite === settings.densiteActivite.granularite &&
      c.fenetre === settings.densiteActivite.fenetre,
  )

  const handleCranClick = (index: number) => {
    const cran = crans[index]
    onSettings({
      ...settings,
      densiteActivite: {
        granularite: cran.granularite,
        fenetre: cran.fenetre,
      },
    })
  }

  return (
    <div style={s('display: flex; flex-direction: column; gap: 12px;')}>
      <label style={s('display: block; font-size: 12px; font-weight: 500;')}>
        Densité d'activité
      </label>
      <div style={s('display: flex; gap: 6px; flex-wrap: wrap;')}>
        {crans.map((cran, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleCranClick(i)}
            className={current === i ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={s('font-size: 12px; padding: 4px 12px;')}
          >
            {cran.label}
          </button>
        ))}
      </div>
    </div>
  )
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
  return (
    <div style={s('display: flex; flex-direction: column; gap: 12px;')}>
      {/* Onglets */}
      <div>
        <label style={s('display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;')}>
          Onglets
        </label>
        <div style={s('display: flex; flex-direction: column; gap: 4px;')}>
          {settings.onglets.ordre.map(tabId => {
            const isActive = settings.onglets.actifs.includes(tabId)
            const label = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'].includes(tabId)
              ? {
                  apercu: 'Aperçu',
                  navigateur: 'Navigateur',
                  produit: 'Produit',
                  historique: 'Historique',
                  tableau: 'Tableau',
                  donnees: 'Données',
                  stack: 'Stack',
                }[tabId]
              : tabId
            return (
              <label
                key={tabId}
                style={s(
                  'display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;',
                )}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => {
                    if (e.target.checked) {
                      onSettings({
                        ...settings,
                        onglets: {
                          ...settings.onglets,
                          actifs: [...settings.onglets.actifs, tabId],
                        },
                      })
                    } else {
                      // Au moins un onglet doit rester actif
                      if (settings.onglets.actifs.length > 1) {
                        onSettings({
                          ...settings,
                          onglets: {
                            ...settings.onglets,
                            actifs: settings.onglets.actifs.filter(id => id !== tabId),
                          },
                        })
                      }
                    }
                  }}
                  style={s('cursor: pointer;')}
                />
                <span>{label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Terminal */}
      <div>
        <label style={s('display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;')}>
          Terminal
        </label>
        <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
          <label style={s('display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;')}>
            <input
              type="checkbox"
              checked={settings.terminal.visible}
              onChange={e =>
                onSettings({
                  ...settings,
                  terminal: { ...settings.terminal, visible: e.target.checked },
                })
              }
              style={s('cursor: pointer;')}
            />
            <span>Afficher le terminal</span>
          </label>

          <div>
            <label style={s('display: block; font-size: 11px; color: var(--color-neutral-600); margin-bottom: 4px;')}>
              Disposition
            </label>
            <select
              value={settings.terminal.disposition}
              onChange={e =>
                onSettings({
                  ...settings,
                  terminal: { ...settings.terminal, disposition: e.target.value },
                })
              }
              style={s(
                'width: 100%; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 12px;',
              )}
            >
              <option value="bottom">En bas</option>
              <option value="side">À droite</option>
              <option value="full">Plein écran</option>
            </select>
          </div>
        </div>
      </div>

      {/* Thème */}
      <div>
        <label style={s('display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;')}>
          Thème
        </label>
        <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
          {(['auto', 'light', 'dark'] as const).map(theme => {
            const themeLabel = theme === 'auto' ? 'Système' : theme === 'light' ? 'Clair' : 'Sombre'
            return (
              <label
                key={theme}
                style={s(
                  'display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={settings.theme === theme}
                  onChange={() => {
                    onSettings({ ...settings, theme })
                  }}
                  style={s('cursor: pointer;')}
                />
                <span>{themeLabel}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
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
  const [newLabel, setNewLabel] = useState('')
  const [newText, setNewText] = useState('')
  const [newError, setNewError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const customActions = settings.customActions ?? []

  const handleAddAction = () => {
    setNewError(null)

    // Validation
    if (!newLabel.trim()) {
      setNewError('Saisissez un libellé')
      return
    }
    if (!newText.trim()) {
      setNewError('Saisissez un texte')
      return
    }
    if (newLabel.trim().length > 50) {
      setNewError('Libellé trop long (max 50 caractères)')
      return
    }
    if (newText.trim().length > 2000) {
      setNewError('Texte trop long (max 2000 caractères)')
      return
    }
    if (newText.includes('\n')) {
      setNewError('Aucun saut de ligne autorisé')
      return
    }

    const action = { label: newLabel.trim(), text: newText.trim() }

    if (editingId !== null) {
      // Édition
      const updated = [...customActions]
      updated[editingId] = action
      onSettings({ ...settings, customActions: updated })
      setEditingId(null)
    } else {
      // Ajout
      onSettings({ ...settings, customActions: [...customActions, action] })
    }

    setNewLabel('')
    setNewText('')
    setNewError(null)
  }

  const handleDeleteAction = (index: number) => {
    onSettings({
      ...settings,
      customActions: customActions.filter((_, i) => i !== index),
    })
  }

  const handleStartEdit = (index: number) => {
    const action = customActions[index]
    setNewLabel(action.label)
    setNewText(action.text)
    setEditingId(index)
    setNewError(null)
  }

  const handleCancel = () => {
    setNewLabel('')
    setNewText('')
    setEditingId(null)
    setNewError(null)
  }

  return (
    <div style={s('display: flex; flex-direction: column; gap: 12px;')}>
      <label style={s('display: block; font-size: 12px; font-weight: 500;')}>
        Mes actions
      </label>

      {/* Formulaire d'ajout/édition */}
      <div style={s('display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--color-neutral-900); border-radius: 4px;')}>
        <div>
          <label style={s('display: block; font-size: 11px; color: var(--color-neutral-600); margin-bottom: 4px;')}>
            Libellé
          </label>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Ex. : Mon test"
            maxLength={50}
            style={s(
              'width: 100%; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 12px; background: var(--theme-bg-primary); color: var(--color-text);',
            )}
          />
          <div style={s('font-size: 10px; color: var(--color-neutral-600); margin-top: 2px;')}>
            {newLabel.length}/50
          </div>
        </div>

        <div>
          <label style={s('display: block; font-size: 11px; color: var(--color-neutral-600); margin-bottom: 4px;')}>
            Texte (pas de sauts de ligne)
          </label>
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Ex. : pnpm test"
            maxLength={2000}
            style={s(
              'width: 100%; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 12px; background: var(--theme-bg-primary); color: var(--color-text);',
            )}
          />
          <div style={s('font-size: 10px; color: var(--color-neutral-600); margin-top: 2px;')}>
            {newText.length}/2000
          </div>
        </div>

        {newError && (
          <div
            style={s(
              'font-size: 11px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 4px; padding: 6px 8px;',
            )}
          >
            {newError}
          </div>
        )}

        <div style={s('display: flex; gap: 8px;')}>
          <button
            type="button"
            onClick={handleAddAction}
            className="btn btn-primary btn-sm"
            style={s('font-size: 11px; padding: 4px 10px;')}
          >
            {editingId !== null ? 'Mettre à jour' : 'Ajouter'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-ghost btn-sm"
              style={s('font-size: 11px; padding: 4px 10px;')}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Liste des actions personnalisées */}
      {customActions.length > 0 && (
        <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
          {customActions.map((action, index) => (
            <div
              key={index}
              style={s(
                'display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--color-neutral-900); border-radius: 4px; font-size: 11px;',
              )}
            >
              <div style={s('flex: 1; min-width: 0;')}>
                <div style={s('font-weight: 500; truncate;')}>{action.label}</div>
                <div style={s('color: var(--color-neutral-600); truncate; font-family: ui-monospace;')}>
                  {action.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleStartEdit(index)}
                className="btn btn-ghost btn-xs"
                style={s('font-size: 10px; padding: 2px 6px;')}
                title="Éditer"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAction(index)}
                className="btn btn-ghost btn-xs"
                style={s('font-size: 10px; padding: 2px 6px;')}
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
          'width: min(560px, 100%); max-height: 100%; overflow: auto; background: var(--theme-bg-secondary); border: 1px solid var(--color-divider); border-radius: 8px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;',
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
