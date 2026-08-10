/**
 * La section « Projet » des préférences.
 *
 * Trois blocs qui avaient chacun leur entrée de navigation et n'en méritaient
 * pas : les actions du terminal, les commandes jouées à l'initialisation, et
 * les deux réglages avancés. Ce qui les réunit est ce qui les distingue du
 * reste — ce sont les seuls réglages que `cockpit.config.json` peut surcharger
 * par projet (`hooks/settings.js`, `mergeSettings`), là où le thème et la
 * langue restent personnels.
 *
 * Ils sont sortis de `PreferencesPanel.tsx` sans changer de logique : ce
 * fichier-là dépassait déjà les 800 lignes de `CLAUDE.md`.
 */

import { useState } from 'react'

import type { SettingsType } from './data'
import { t, type TranslationKey } from './i18n'
import { ErrorBox, Field, GroupLabel, Row, SectionTitle } from './PreferencesControls'
import { s } from './style'

type SectionProps = {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}

/** Les lignes prêtes à poser dans le terminal. */
export function BlocActions({ settings, onSettings }: SectionProps) {
  const [label, setLabel] = useState('')
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<TranslationKey | null>(null)
  const [edite, setEdite] = useState<number | null>(null)

  const actions = settings.customActions ?? []

  const valider = (): TranslationKey | null => {
    if (!label.trim()) return 'pref.err_label_required'
    if (!texte.trim()) return 'pref.err_text_required'
    if (label.trim().length > 50) return 'pref.err_label_long'
    if (texte.trim().length > 2000) return 'pref.err_text_long'
    // Un saut de ligne dans une action, c'est plusieurs commandes envoyées au
    // shell d'un coup — le hook de tickets refuse déjà la même chose.
    if (texte.includes('\n')) return 'pref.err_newline'
    return null
  }

  const soumettre = () => {
    const faute = valider()
    setErreur(faute)
    if (faute) return

    const action = { label: label.trim(), text: texte.trim() }
    const suivantes =
      edite === null
        ? [...actions, action]
        : actions.map((existante, i) => (i === edite ? action : existante))

    onSettings({ ...settings, customActions: suivantes })
    setLabel('')
    setTexte('')
    setEdite(null)
  }

  return (
    <>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.actions_desc')}
      </p>

      <div
        style={s(
          'display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--color-divider); border-radius: 8px;',
        )}
      >
        <Field label={t('pref.actions_label')} hint={`${label.length}/50`}>
          <input
            className="input"
            type="text"
            value={label}
            onChange={event => setLabel(event.target.value)}
            placeholder={t('pref.actions_label_ph')}
            maxLength={50}
            style={s('font-size: 13px; min-height: 32px;')}
          />
        </Field>
        <Field label={t('pref.actions_text')} hint={`${texte.length}/2000`}>
          <input
            className="input"
            type="text"
            value={texte}
            onChange={event => setTexte(event.target.value)}
            placeholder={t('pref.actions_text_ph')}
            maxLength={2000}
            style={s('font-size: 13px; min-height: 32px; font-family: ui-monospace, monospace;')}
          />
        </Field>

        {erreur && <ErrorBox>{t(erreur)}</ErrorBox>}

        <div style={s('display: flex; gap: 8px;')}>
          <button type="button" className="btn btn-primary" onClick={soumettre}>
            {edite === null ? t('pref.actions_add') : t('pref.actions_update')}
          </button>
          {edite !== null && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLabel('')
                setTexte('')
                setEdite(null)
                setErreur(null)
              }}
            >
              {t('pref.actions_cancel')}
            </button>
          )}
        </div>
      </div>

      {actions.length === 0 && (
        <p style={s('margin: 14px 0 0; font-size: 12px; color: var(--color-neutral-600);')}>
          {t('pref.actions_empty')}
        </p>
      )}

      <div style={s('margin-top: 12px; display: flex; flex-direction: column; gap: 6px;')}>
        {actions.map((action, index) => (
          <div
            key={index}
            style={s(
              'display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; background: var(--theme-bg-tertiary);',
            )}
          >
            <div style={s('flex: 1; min-width: 0;')}>
              <div
                style={s(
                  'font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                )}
              >
                {action.label}
              </div>
              <div
                style={s(
                  'font-size: 11px; color: var(--color-neutral-600); font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                )}
              >
                {action.text}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`${t('pref.actions_edit')} — ${action.label}`}
              onClick={() => {
                setLabel(action.label)
                setTexte(action.text)
                setEdite(index)
                setErreur(null)
              }}
              style={s('font-size: 12px; padding: 2px 7px;')}
            >
              ✎
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`${t('pref.actions_delete')} — ${action.label}`}
              onClick={() =>
                onSettings({
                  ...settings,
                  customActions: actions.filter((_, i) => i !== index),
                })
              }
              style={s('font-size: 12px; padding: 2px 7px;')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

/** Les commandes proposées une seule fois, à l'initialisation d'un projet neuf. */
export function BlocDemarrage({ settings, onSettings }: SectionProps) {
  const bootstrap = settings.bootstrap ?? ['/project-setup']

  return (
    <>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.bootstrap_desc')}
      </p>

      <div style={s('display: flex; flex-direction: column; gap: 7px;')}>
        {bootstrap.map((commande, index) => (
          <div key={index} style={s('display: flex; gap: 7px; align-items: center;')}>
            <input
              className="input"
              type="text"
              value={commande}
              placeholder={t('pref.bootstrap_ph')}
              onChange={event =>
                onSettings({
                  ...settings,
                  bootstrap: bootstrap.map((autre, i) => (i === index ? event.target.value : autre)),
                })
              }
              style={s('font-size: 12.5px; min-height: 32px; font-family: ui-monospace, monospace;')}
            />
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={t('pref.bootstrap_remove')}
              onClick={() =>
                onSettings({ ...settings, bootstrap: bootstrap.filter((_, i) => i !== index) })
              }
              style={s('flex: none; font-size: 12px; padding: 2px 7px;')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => onSettings({ ...settings, bootstrap: [...bootstrap, ''] })}
        style={s('font-size: 12px;')}
      >
        {t('pref.bootstrap_add')}
      </button>
    </>
  )
}

/** Gestionnaire de paquets et source de graphe. */
export function BlocAvance({ settings, onSettings }: SectionProps) {
  return (
    <>
      {/* Une liste, pas un champ libre : `validateSettings` n'accepte que ces
          quatre-là, et toute autre saisie était écrite puis rejetée à la
          relecture — le réglage retombait au défaut sans rien dire. */}
      <Row label={t('pref.package_manager')}>
        <select
          className="input"
          value={settings.packageManager ?? 'pnpm'}
          onChange={event => onSettings({ ...settings, packageManager: event.target.value })}
          style={s('width: auto; min-height: 32px; font-size: 12.5px;')}
        >
          {['pnpm', 'npm', 'yarn', 'bun'].map(nom => (
            <option key={nom} value={nom}>
              {nom}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t('pref.graph_source')} last>
        <select
          className="input"
          value={settings.sourceGraphe ?? 'auto'}
          onChange={event => onSettings({ ...settings, sourceGraphe: event.target.value })}
          style={s('width: auto; min-height: 32px; font-size: 12.5px;')}
        >
          <option value="auto">{t('pref.graph_auto')}</option>
          <option value="graphify">{t('pref.graph_graphify')}</option>
          <option value="obsidian">{t('pref.graph_obsidian')}</option>
        </select>
      </Row>
    </>
  )
}

/** Les trois blocs, sous un seul titre. */
export function SectionProjet({ settings, onSettings }: SectionProps) {
  return (
    <>
      <SectionTitle>{t('pref.project')}</SectionTitle>
      <GroupLabel>{t('pref.actions_title')}</GroupLabel>
      <BlocActions settings={settings} onSettings={onSettings} />
      <GroupLabel>{t('pref.bootstrap_title')}</GroupLabel>
      <BlocDemarrage settings={settings} onSettings={onSettings} />
      <GroupLabel>{t('pref.advanced')}</GroupLabel>
      <BlocAvance settings={settings} onSettings={onSettings} />
    </>
  )
}
