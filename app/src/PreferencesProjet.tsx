/**
 * La section « Projet » des préférences.
 *
 * Ce qui vaut pour le **projet ouvert**, et rien d'autre : sa couleur d'accent
 * (registre, `hooks/plans.js`), ses commandes (`projectActions`, indexées par
 * chemin), ce qu'il tient hors du suivi git, ses intégrations
 * (`~/.claude/ovrsee/integrations.json`).
 *
 * Le démarrage et les deux réglages avancés vivaient ici et n'en étaient pas :
 * ils valent pour tous les projets. Ils sont montés par `SectionGeneral`
 * (`PreferencesPanel.tsx`) et restent définis ici, à côté du seul bloc qui leur
 * ressemble. Une section qui porte le nom d'un projet ne doit contenir que ce
 * qu'on change en changeant de projet.
 *
 * « Porter sur le projet » ne veut pas dire « venir du projet » : les commandes
 * ne se lisent jamais dans `ovrsee.config.json`, versionné donc fourni par le
 * dépôt observé (issue #70, T-0216).
 *
 * Ils sont sortis de `PreferencesPanel.tsx` sans changer de logique : ce
 * fichier-là dépassait déjà les 800 lignes de `CLAUDE.md`.
 */

import { useEffect, useRef, useState } from 'react'

import { ACCENTS } from '../../hooks/accents'
import type { Action, Integration, IntegrationProvider, SettingsType } from './data'
import { t, type TranslationKey } from './i18n'
import { BlocIntegrations } from './PreferencesIntegrations'
import { ErrorBox, Field, GroupLabel, Row, SectionTitle, Switch } from './PreferencesControls'
import { s } from './style'

/** Le nom du dossier d'un chemin — le chemin entier tiendrait mal dans l'aide. */
const basename = (chemin: string) => chemin.split('/').filter(Boolean).pop() ?? chemin

type SectionProps = {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}

/**
 * Les lignes prêtes à poser dans le terminal.
 *
 * Monté deux fois par `SectionProjet` : une fois sur les actions globales
 * (`customActions`), une fois sur celles du projet ouvert
 * (`projectActions[root]`). D'où les actions passées en propriété plutôt que
 * lues dans `settings` — le formulaire est le même, la liste ne l'est pas.
 */
export function BlocActions({
  actions,
  onActions,
  aide,
}: {
  actions: Action[]
  onActions: (actions: Action[]) => void
  aide: string
}) {
  const [label, setLabel] = useState('')
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<TranslationKey | null>(null)
  const [edite, setEdite] = useState<number | null>(null)

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

    onActions(suivantes)
    setLabel('')
    setTexte('')
    setEdite(null)
  }

  return (
    <>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {aide}
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
            style={s('font-size: 13px; min-height: 32px; font-family: var(--font-mono);')}
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
              'display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; background: var(--color-surface-control);',
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
                  'font-size: 11px; color: var(--color-neutral-600); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
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
              onClick={() => onActions(actions.filter((_, i) => i !== index))}
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
              style={s('font-size: 12.5px; min-height: 32px; font-family: var(--font-mono);')}
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

/**
 * Gestionnaire de paquets et source de graphe.
 *
 * Deux défauts, valables pour tous les projets — d'où leur place dans
 * « Général » — mais qu'un `ovrsee.config.json` peut surcharger pour le sien
 * (`mergeSettings`, `hooks/settings.js`). L'aide le dit, sans quoi on croirait
 * la valeur affichée vraie partout.
 */
export function BlocAvance({ settings, onSettings }: SectionProps) {
  return (
    <>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.advanced_desc')}
      </p>
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

/** Ce qui doit rester hors du suivi git du projet. */
export function BlocGitignore({ settings, onSettings }: SectionProps) {
  return (
    <>
      <Row label={t('pref.gitignore_shots')} hint={t('pref.gitignore_shots_hint')}>
        <Switch
          checked={settings.gitignoreShots ?? true}
          onChange={gitignoreShots => onSettings({ ...settings, gitignoreShots })}
          label={t('pref.gitignore_shots')}
        />
      </Row>
      <Row label={t('pref.gitignore_plans')} hint={t('pref.gitignore_plans_hint')} last>
        <Switch
          checked={settings.gitignorePlans ?? false}
          onChange={gitignorePlans => onSettings({ ...settings, gitignorePlans })}
          label={t('pref.gitignore_plans')}
        />
      </Row>
    </>
  )
}

/**
 * La couleur d'accent du projet (T-0215, issue #48).
 *
 * Elle ne passe pas par `settings` : c'est une préférence de **poste**, tenue
 * par le registre (`hooks/plans.js`, `setProjectAccent`) et non par le fichier
 * de réglages — `ovrsee.config.json` est versionné, et deux personnes sur le
 * même dépôt n'ont aucune raison de partager la même couleur. D'où un couple
 * `accent`/`onAccent` à part plutôt que le `onSettings` des autres blocs.
 *
 * Les pastilles se peignent sans écrire une seule couleur ici : `data-accent`
 * redéfinit `--color-accent` sur la pastille elle-même, exactement comme il le
 * fait sur `<html>` pour l'application entière.
 */
function BlocApparence({
  accent,
  onAccent,
  disabled,
}: {
  accent?: string
  onAccent?: (accent: string) => void
  disabled: boolean
}) {
  return (
    <Row
      label={t('pref.accent_title')}
      hint={t('pref.accent_hint')}
      stacked
      last
    >
      <div
        role="radiogroup"
        aria-label={t('pref.accent_title')}
        style={s('display: flex; flex-wrap: wrap; gap: 8px;')}
      >
        {/* Le registre est un fichier qu'on ne contrôle pas : une teinte retirée
            de la palette y survivrait. Elle retombe sur le défaut plutôt que de
            laisser le groupe sans coche. */}
        {ACCENTS.map(nom => {
          const choisi = nom === (accent && ACCENTS.includes(accent) ? accent : 'violet')
          return (
            <button
              key={nom}
              type="button"
              role="radio"
              aria-checked={choisi}
              disabled={disabled || !onAccent}
              onClick={() => onAccent?.(nom)}
              style={s(
                'display: flex; align-items: center; gap: 7px; padding: 6px 10px 6px 7px; border-radius: 999px; background: transparent; font-family: var(--font-body); font-size: 11.5px;' +
                  (disabled || !onAccent ? ' opacity: .45; cursor: not-allowed;' : ' cursor: pointer;') +
                  (choisi
                    ? ' border: 1px solid var(--color-accent); color: var(--color-text);'
                    : ' border: 1px solid var(--color-divider); color: var(--color-neutral-500);'),
              )}
            >
              <span
                aria-hidden="true"
                data-accent={nom}
                style={s(
                  'display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--color-accent);',
                )}
              />
              {t(`pref.accent_${nom}` as TranslationKey)}
            </button>
          )
        })}
      </div>
    </Row>
  )
}

/** Les six blocs, sous un seul titre. */
export function SectionProjet({
  settings,
  onSettings,
  root,
  integrations = [],
  accent,
  onAccent,
  initialProvider,
}: SectionProps & {
  root?: string
  integrations?: Integration[]
  accent?: string
  onAccent?: (accent: string) => void
  initialProvider?: IntegrationProvider
}) {
  // Le bloc Intégrations est le dernier des cinq : arrivé ici depuis le CTA de
  // l'Aperçu (provider présélectionné), il faut le faire défiler jusqu'à la
  // vue plutôt que le laisser sous la ligne de flottaison.
  const integrationsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (initialProvider) integrationsRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <>
      <SectionTitle>{t('pref.project')}</SectionTitle>
      <GroupLabel>{t('pref.appearance_title')}</GroupLabel>
      <BlocApparence accent={accent} onAccent={onAccent} disabled={!root} />
      {/* Les commandes globales ne sont pas ici : elles se saisissent depuis
          « Général », avec le reste de ce qui vaut pour tous les projets. */}
      {root && (
        <>
          <GroupLabel>{t('pref.actions_title')}</GroupLabel>
          <BlocActions
            actions={settings.projectActions?.[root] ?? []}
            onActions={actions =>
              onSettings({
                ...settings,
                projectActions: { ...settings.projectActions, [root]: actions },
              })
            }
            aide={t('pref.actions_project_desc', { projet: basename(root) })}
          />
        </>
      )}
      <GroupLabel>{t('pref.gitignore_title')}</GroupLabel>
      <BlocGitignore settings={settings} onSettings={onSettings} />
      <div ref={integrationsRef}>
        <GroupLabel>{t('pref.integrations_title')}</GroupLabel>
        <BlocIntegrations root={root} integrations={integrations} initialProvider={initialProvider} />
      </div>
    </>
  )
}
