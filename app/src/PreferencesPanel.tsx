import { useEffect, useMemo, useRef, useState } from 'react'

import { fetchSettings, updateSettings, type SettingsType } from './data'
import { setCurrentLanguage, t, type TranslationKey } from './i18n'
import {
  ErrorBox,
  Field,
  GroupLabel,
  IconDark,
  IconGrip,
  IconLight,
  IconSystem,
  Row,
  SectionTitle,
  Segmented,
  Switch,
} from './PreferencesControls'
import { PreferencesPreview } from './PreferencesPreview'
import { s } from './style'
import { applyTheme } from './theme'

/**
 * L'écran des préférences.
 *
 * Il s'enregistre tout seul. C'est le choix qui commande tout le reste : sans
 * bouton « Enregistrer », l'application derrière la modale devient l'aperçu du
 * thème, et il ne reste qu'une croix pour fermer. Un bouton « Annuler » y
 * mentirait — il n'y a rien à annuler une fois la ligne écrite.
 *
 * La navigation est à sections plutôt qu'en colonne unique parce que la liste
 * a grandi : sept groupes de réglages empilés faisaient un rouleau de 900 px
 * où le thème se trouvait par tâtonnement.
 *
 * Découpage : les commandes élémentaires sont dans `PreferencesControls.tsx`,
 * la maquette d'aperçu dans `PreferencesPreview.tsx`.
 */

const tabToKey: Record<string, TranslationKey> = {
  apercu: 'tabs.apercu',
  navigateur: 'tabs.navigateur',
  produit: 'tabs.produit',
  historique: 'tabs.historique',
  tableau: 'tabs.tableau',
  donnees: 'tabs.donnees',
  stack: 'tabs.stack',
}

type SectionId =
  | 'general'
  | 'onglets'
  | 'terminal'
  | 'activite'
  | 'actions'
  | 'demarrage'
  | 'avance'

/** Les sections, dans l'ordre de la barre latérale, et leur groupe. */
const SECTIONS: Array<{ id: SectionId; cle: TranslationKey; groupe: 'settings' | 'project' }> = [
  { id: 'general', cle: 'pref.general', groupe: 'settings' },
  { id: 'onglets', cle: 'pref.tabs', groupe: 'settings' },
  { id: 'terminal', cle: 'pref.terminal', groupe: 'settings' },
  { id: 'activite', cle: 'pref.activity', groupe: 'settings' },
  { id: 'actions', cle: 'pref.actions', groupe: 'project' },
  { id: 'demarrage', cle: 'pref.startup', groupe: 'project' },
  { id: 'avance', cle: 'pref.advanced', groupe: 'project' },
]

/* ————————————————————————————————————————————————————————————————
 * Les deux opérations sur les onglets, en fonctions pures.
 *
 * Elles sortent des composants parce que ce sont elles qui portent les
 * invariants — l'ordre complet, le dernier onglet visible — et qu'un test les
 * atteint sans DOM.
 * ———————————————————————————————————————————————————————————————— */

/**
 * Déplace un onglet dans l'ordre d'affichage.
 *
 * Rend le tableau d'origine si l'un des indices est hors bornes : `ordre` doit
 * toujours garder ses sept identifiants, sinon `validateSettings` le rejette
 * en silence (`hooks/settings.js`) et l'utilisateur voit ses onglets revenir
 * à l'ordre d'usine sans explication.
 *
 * @param ordre l'ordre courant
 * @param de l'indice de départ
 * @param vers l'indice d'arrivée
 */
export function deplacerOnglet(ordre: string[], de: number, vers: number): string[] {
  if (de === vers) return ordre
  if (de < 0 || vers < 0 || de >= ordre.length || vers >= ordre.length) return ordre
  const copie = [...ordre]
  const [item] = copie.splice(de, 1)
  copie.splice(vers, 0, item)
  return copie
}

/**
 * Montre ou masque un onglet.
 *
 * Deux règles : on ne masque pas le dernier visible — l'application n'aurait
 * plus rien à afficher — et `actifs` se range toujours selon `ordre`, sinon il
 * accumulerait dans l'ordre des clics et l'aperçu mentirait.
 *
 * @param settings les préférences courantes
 * @param id l'identifiant de l'onglet
 */
export function basculerOnglet(settings: SettingsType, id: string): SettingsType {
  const ordre = settings.onglets?.ordre ?? []
  const actifs = settings.onglets?.actifs ?? []

  if (actifs.includes(id)) {
    if (actifs.length <= 1) return settings
    return {
      ...settings,
      onglets: { ordre, actifs: actifs.filter(autre => autre !== id) },
    }
  }

  const ajoutes = new Set([...actifs, id])
  return { ...settings, onglets: { ordre, actifs: ordre.filter(autre => ajoutes.has(autre)) } }
}

/* ————————————————————————————————————————————————————————————————
 * Les sections
 * ———————————————————————————————————————————————————————————————— */

type SectionProps = {
  settings: SettingsType
  onSettings: (settings: SettingsType) => void
}

/** Thème et langue — ce qui est personnel et ne se surcharge pas par projet. */
export function SectionGeneral({ settings, onSettings }: SectionProps) {
  return (
    <>
      <SectionTitle>{t('pref.general')}</SectionTitle>
      <Row label={t('pref.theme')}>
        <Segmented
          name="pref-theme"
          ariaLabel={t('pref.theme')}
          value={settings.theme ?? 'auto'}
          onChange={theme => onSettings({ ...settings, theme })}
          options={[
            { value: 'auto', label: t('pref.theme_system'), icon: <IconSystem /> },
            { value: 'light', label: t('pref.theme_light'), icon: <IconLight /> },
            { value: 'dark', label: t('pref.theme_dark'), icon: <IconDark /> },
          ]}
        />
      </Row>
      <Row label={t('pref.language')} hint={t('pref.language_note')} last>
        <Segmented
          name="pref-langue"
          ariaLabel={t('pref.language')}
          value={settings.langue ?? 'fr'}
          onChange={langue => onSettings({ ...settings, langue })}
          options={[
            { value: 'fr', label: t('pref.language_fr') },
            { value: 'en', label: t('pref.language_en') },
          ]}
        />
      </Row>
    </>
  )
}

/** Quels onglets, dans quel ordre. */
export function SectionOnglets({ settings, onSettings }: SectionProps) {
  const [glisse, setGlisse] = useState<number | null>(null)
  const ordre = settings.onglets?.ordre ?? []
  const actifs = settings.onglets?.actifs ?? []
  const dernier = actifs.length <= 1

  const deplacer = (de: number, vers: number) => {
    const suivant = deplacerOnglet(ordre, de, vers)
    if (suivant === ordre) return
    onSettings({ ...settings, onglets: { ordre: suivant, actifs } })
  }

  return (
    <>
      <SectionTitle>{t('pref.tabs')}</SectionTitle>
      <p style={s('margin: 0 0 12px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.tabs_desc')}
      </p>

      <PreferencesPreview settings={settings} highlight="tabs" />

      <div
        style={s(
          'margin: 14px 0 6px; display: flex; align-items: baseline; gap: 8px; font-size: 11px; color: var(--color-neutral-600);',
        )}
      >
        {t(actifs.length > 1 ? 'pref.tabs_visible_plural' : 'pref.tabs_visible', {
          n: actifs.length,
          total: ordre.length,
        })}
        {dernier && <span style={s('color: var(--color-neutral-500);')}>· {t('pref.tabs_last_active')}</span>}
      </div>

      <ul style={s('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;')}>
        {ordre.map((id, index) => {
          const actif = actifs.includes(id)
          const label = t(tabToKey[id] ?? 'tabs.apercu')
          return (
            <li
              key={id}
              draggable
              onDragStart={event => {
                setGlisse(index)
                event.dataTransfer.effectAllowed = 'move'
                // Firefox n'amorce pas le glisser sans charge utile.
                event.dataTransfer.setData('text/plain', id)
              }}
              onDragOver={event => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={event => {
                event.preventDefault()
                if (glisse !== null) deplacer(glisse, index)
                setGlisse(null)
              }}
              onDragEnd={() => setGlisse(null)}
              style={s(
                'display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; cursor: grab;' +
                  (glisse === index
                    ? ' background: color-mix(in srgb, var(--color-accent) 12%, transparent);'
                    : ''),
              )}
            >
              <span
                aria-hidden="true"
                style={s('flex: none; display: flex; color: var(--color-neutral-600);')}
                title={t('pref.reorder')}
              >
                <IconGrip />
              </span>
              <span
                style={s(
                  'flex: 1; min-width: 0; font-size: 13px;' +
                    (actif ? '' : ' color: var(--color-neutral-600);'),
                )}
              >
                {label}
              </span>
              {/* Les flèches doublent le glisser-déposer : celui-ci n'existe
                  pas au clavier, et un réglage qu'on ne peut pas atteindre
                  sans souris n'est pas un réglage. */}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={index === 0}
                aria-label={`${t('pref.move_up')} — ${label}`}
                onClick={() => deplacer(index, index - 1)}
                style={s('flex: none; font-size: 12px; padding: 2px 6px;')}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={index === ordre.length - 1}
                aria-label={`${t('pref.move_down')} — ${label}`}
                onClick={() => deplacer(index, index + 1)}
                style={s('flex: none; font-size: 12px; padding: 2px 6px;')}
              >
                ↓
              </button>
              <Switch
                label={label}
                checked={actif}
                disabled={actif && dernier}
                title={actif && dernier ? t('pref.tabs_last_active') : undefined}
                onChange={() => onSettings(basculerOnglet(settings, id))}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Les trois dispositions, dessinées plutôt que listées dans un menu. */
function CarteDisposition({
  valeur,
  label,
  choisi,
  disabled,
  onChoose,
}: {
  valeur: string
  label: string
  choisi: boolean
  disabled: boolean
  onChoose: (valeur: string) => void
}) {
  // Le schéma : un cadre, et la part que prend le terminal dedans.
  const part =
    valeur === 'side'
      ? 'position: absolute; inset: 0 0 0 62%;'
      : valeur === 'full'
        ? 'position: absolute; inset: 0;'
        : 'position: absolute; inset: 62% 0 0 0;'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={choisi}
      disabled={disabled}
      onClick={() => onChoose(valeur)}
      style={s(
        'display: flex; flex-direction: column; align-items: stretch; gap: 7px; padding: 9px; border-radius: 8px; background: transparent; font-family: var(--font-body);' +
          (disabled ? ' opacity: .45; cursor: not-allowed;' : ' cursor: pointer;') +
          (choisi
            ? ' border: 1px solid var(--color-accent); color: var(--color-accent);'
            : ' border: 1px solid var(--color-divider); color: var(--color-neutral-500);'),
      )}
    >
      <span
        aria-hidden="true"
        style={s(
          'position: relative; display: block; width: 62px; height: 40px; border-radius: 4px; overflow: hidden; background: var(--theme-bg-quaternary);',
        )}
      >
        <span
          style={s(
            part +
              (choisi
                ? ' background: color-mix(in srgb, var(--color-accent) 45%, transparent);'
                : ' background: var(--color-neutral-700);'),
          )}
        />
      </span>
      <span style={s('font-size: 11.5px;')}>{label}</span>
    </button>
  )
}

/** Le terminal : présence et disposition. */
export function SectionTerminal({ settings, onSettings }: SectionProps) {
  const terminal = settings.terminal ?? {
    visible: true,
    disposition: 'bottom',
    hauteur: 244,
    largeur: 468,
  }
  const visible = terminal.visible === true

  return (
    <>
      <SectionTitle>{t('pref.terminal')}</SectionTitle>
      <PreferencesPreview settings={settings} highlight="terminal" />

      <div style={s('margin-top: 6px;')}>
        <Row label={t('pref.terminal_visible')}>
          <Switch
            label={t('pref.terminal_visible')}
            checked={visible}
            onChange={checked =>
              onSettings({ ...settings, terminal: { ...terminal, visible: checked } })
            }
          />
        </Row>
        <Row
          label={t('pref.terminal_layout')}
          hint={visible ? undefined : t('pref.terminal_hidden_note')}
          stacked
          last
        >
          <div
            role="radiogroup"
            aria-label={t('pref.terminal_layout')}
            style={s('display: flex; gap: 8px;')}
          >
            {(
              [
                ['bottom', 'pref.terminal_bottom'],
                ['side', 'pref.terminal_side'],
                ['full', 'pref.terminal_full'],
              ] as const
            ).map(([valeur, cle]) => (
              <CarteDisposition
                key={valeur}
                valeur={valeur}
                label={t(cle)}
                choisi={terminal.disposition === valeur}
                disabled={!visible}
                onChoose={disposition =>
                  onSettings({ ...settings, terminal: { ...terminal, disposition } })
                }
              />
            ))}
          </div>
        </Row>
      </div>
    </>
  )
}

/** La densité de la frise d'activité — cinq crans, un seul contrôle. */
export function SectionActivite({ settings, onSettings }: SectionProps) {
  // Chaque cran fixe à la fois la granularité et la fenêtre : les deux ne se
  // combinent pas librement, et deux menus laisseraient composer des paires
  // qui n'ont pas de sens (un an au jour près).
  const crans = [
    { value: 'jour', label: t('pref.density_day'), granularite: 'jour', fenetre: 'jour' },
    { value: 'semaine', label: t('pref.density_week'), granularite: 'semaine', fenetre: 'semaine' },
    { value: 'mois', label: t('pref.density_month'), granularite: 'mois', fenetre: 'mois' },
    { value: '3mois', label: t('pref.density_month3'), granularite: 'semaine', fenetre: '3mois' },
    { value: 'an', label: t('pref.density_year'), granularite: 'mois', fenetre: 'an' },
  ]

  const densite = settings.densiteActivite ?? { granularite: 'semaine', fenetre: '3mois' }
  const courant =
    crans.find(c => c.granularite === densite.granularite && c.fenetre === densite.fenetre)?.value ??
    ''

  return (
    <>
      <SectionTitle>{t('pref.activity')}</SectionTitle>
      <Row label={t('pref.density')} stacked last>
        <Segmented
          name="pref-densite"
          ariaLabel={t('pref.density')}
          value={courant}
          onChange={value => {
            const cran = crans.find(c => c.value === value)
            if (!cran) return
            onSettings({
              ...settings,
              densiteActivite: { granularite: cran.granularite, fenetre: cran.fenetre },
            })
          }}
          options={crans.map(({ value, label }) => ({ value, label }))}
        />
      </Row>
    </>
  )
}

/** Les lignes prêtes à poser dans le terminal. */
export function SectionActions({ settings, onSettings }: SectionProps) {
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
      <SectionTitle>{t('pref.actions_title')}</SectionTitle>
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
              <div style={s('font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
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
export function SectionDemarrage({ settings, onSettings }: SectionProps) {
  const bootstrap = settings.bootstrap ?? ['/project-setup']

  return (
    <>
      <SectionTitle>{t('pref.bootstrap_title')}</SectionTitle>
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
export function SectionAvance({ settings, onSettings }: SectionProps) {
  return (
    <>
      <SectionTitle>{t('pref.advanced')}</SectionTitle>
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

/* ————————————————————————————————————————————————————————————————
 * La coquille
 * ———————————————————————————————————————————————————————————————— */

export function PreferencesModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  /** Remonte les préférences réellement écrites : sans ça l'app garde son état
      d'avant l'enregistrement et les changements ne se voient qu'au rechargement. */
  onSaved?: (settings: SettingsType) => void
}) {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [section, setSection] = useState<SectionId>('general')
  const [etat, setEtat] = useState<'vide' | 'chargement' | 'ecriture' | 'ecrit'>('chargement')
  const [erreur, setErreur] = useState<string | null>(null)

  /**
   * Le dernier état confirmé par le serveur, sérialisé.
   *
   * C'est lui qui empêche la boucle : sans point de comparaison, l'effet
   * d'écriture se redéclencherait sur sa propre réponse.
   */
  const ecrit = useRef<string>('')

  useEffect(() => {
    let vivant = true
    fetchSettings()
      .then(chargees => {
        if (!vivant) return
        ecrit.current = JSON.stringify(chargees)
        setSettings(chargees)
        setEtat('vide')
      })
      .catch(err => {
        if (!vivant) return
        setErreur(String(err.message ?? err))
        setEtat('vide')
      })
    return () => {
      vivant = false
    }
  }, [])

  // L'écriture, différée de 300 ms — le même motif que la taille du terminal
  // dans `App.tsx`. Sans ce délai, glisser un onglet écrirait le fichier à
  // chaque image de l'animation.
  useEffect(() => {
    if (!settings) return
    if (JSON.stringify(settings) === ecrit.current) return

    const minuteur = setTimeout(() => {
      setEtat('ecriture')
      updateSettings(settings)
        .then(sauvees => {
          ecrit.current = JSON.stringify(sauvees)
          setErreur(null)
          setEtat('ecrit')
          onSaved?.(sauvees)
        })
        .catch(err => {
          setErreur(String(err.message ?? err))
          setEtat('vide')
        })
    }, 300)

    return () => clearTimeout(minuteur)
  }, [settings])

  // Le témoin « Enregistré » s'efface tout seul : laissé en place il finirait
  // par ne plus rien vouloir dire.
  useEffect(() => {
    if (etat !== 'ecrit') return
    const minuteur = setTimeout(() => setEtat('vide'), 2000)
    return () => clearTimeout(minuteur)
  }, [etat])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /**
   * Thème et langue s'appliquent avant l'écriture.
   *
   * Les autres réglages peuvent attendre les 300 ms du différé, mais ces deux-là
   * sont l'aperçu de leur propre effet : un thème qui bascule un tiers de
   * seconde après le clic se lit comme une latence, pas comme une réponse.
   */
  const applique = (suivant: SettingsType) => {
    if (suivant.theme !== settings?.theme) applyTheme(suivant.theme)
    if (suivant.langue !== settings?.langue) setCurrentLanguage(suivant.langue)
    setSettings(suivant)
  }

  const groupes = useMemo(
    () =>
      [
        ['pref.group_settings', SECTIONS.filter(item => item.groupe === 'settings')],
        ['pref.group_project', SECTIONS.filter(item => item.groupe === 'project')],
      ] as const,
    [],
  )

  const corps = (courantes: SettingsType) => {
    const props = { settings: courantes, onSettings: applique }
    if (section === 'general') return <SectionGeneral {...props} />
    if (section === 'onglets') return <SectionOnglets {...props} />
    if (section === 'terminal') return <SectionTerminal {...props} />
    if (section === 'activite') return <SectionActivite {...props} />
    if (section === 'actions') return <SectionActions {...props} />
    if (section === 'demarrage') return <SectionDemarrage {...props} />
    return <SectionAvance {...props} />
  }

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px;',
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pref.title')}
        onClick={event => event.stopPropagation()}
        style={s(
          'width: min(860px, 100%); height: min(600px, 100%); display: flex; overflow: hidden; background: var(--theme-bg-secondary); border: 1px solid var(--color-divider); border-radius: 10px; box-shadow: var(--shadow-lg);',
        )}
      >
        {/* La barre de navigation. Deux groupes, comme les réglages du
            système : ce qui est à soi, puis ce qui est au projet. */}
        <nav
          aria-label={t('pref.title')}
          style={s(
            'flex: none; width: 200px; display: flex; flex-direction: column; gap: 2px; padding: 16px 10px; overflow-y: auto; background: var(--theme-bg-tertiary); border-right: 1px solid var(--color-divider);',
          )}
        >
          {groupes.map(([cleGroupe, items]) => (
            <div key={cleGroupe}>
              <GroupLabel>{t(cleGroupe)}</GroupLabel>
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  style={s(
                    'display: block; width: 100%; text-align: left; padding: 7px 10px; margin-top: 2px; border: 0; border-radius: 6px; cursor: pointer; font-family: var(--font-body); font-size: 13px;' +
                      (section === item.id
                        ? ' background: var(--color-neutral-900); color: var(--color-text);'
                        : ' background: transparent; color: var(--color-neutral-500);'),
                  )}
                >
                  {t(item.cle)}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0;')}>
          <div
            style={s(
              'flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px 0;',
            )}
          >
            <div style={s('flex: 1;')} />
            <span
              aria-live="polite"
              style={s('font-size: 11px; color: var(--color-neutral-600);')}
            >
              {etat === 'ecriture' && t('pref.saving')}
              {etat === 'ecrit' && t('pref.saved')}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={t('pref.close')}
              onClick={onClose}
              style={s('font-size: 15px; line-height: 1; padding: 2px 8px;')}
            >
              ✕
            </button>
          </div>

          <div style={s('flex: 1; overflow-y: auto; padding: 4px 24px 24px;')}>
            {etat === 'chargement' && (
              <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
                {t('pref.loading')}
              </div>
            )}
            {erreur && (
              <div style={s('margin-bottom: 14px;')}>
                <ErrorBox>{erreur}</ErrorBox>
              </div>
            )}
            {settings && corps(settings)}
          </div>
        </div>
      </div>
    </div>
  )
}
