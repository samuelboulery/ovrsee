import { useEffect, useState } from 'react'
import {
  projectAction,
  getFolderState,
  fetchSettings,
  decideInjection,
  type FolderState,
  type SettingsType,
} from './data'
import { t } from './i18n'
import { pasteToClaude } from './useTerminal'
import { s } from './style'
import { SkillsList, useSkills } from './SkillsPanel'

/**
 * Écrit des commandes dans la session, une par une.
 *
 * Une par une, et non collées d'un bloc : dans une session Claude, un bloc
 * multiligne ne vaut qu'une seule saisie — seule la première commande partirait.
 * Chacune passe par `decideInjection`, qui reconnaît le préfixe `/` et ajoute
 * la validation.
 *
 * Sans session — dans un navigateur, où il n'y a pas d'IPC — on copie. Un
 * bouton qui prétendrait écrire dans une session inexistante mentirait, et
 * c'est déjà la règle des boutons du terminal.
 */
async function envoyerAuTerminal(
  commandes: string[],
  dire: (message: string | null) => void,
): Promise<void> {
  const envoyees = commandes.filter(Boolean).map(commande => decideInjection(commande))
  const toutesPassees = envoyees.every(({ text }) => pasteToClaude(text))

  if (toutesPassees && envoyees.length > 0) {
    dire(`${envoyees.length} commande(s) écrite(s) dans la session Claude`)
    return
  }

  try {
    await navigator.clipboard.writeText(commandes.join('\n'))
    dire('Pas de session ouverte — commandes copiées dans le presse-papier')
  } catch {
    dire('Pas de session ouverte, et la copie a été refusée par le navigateur')
  }
}

const CARTE =
  'width: 100%; padding: 14px; background: var(--theme-bg-secondary); border-radius: 6px; text-align: left;'
const TITRE_CARTE =
  'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;'

/**
 * Une option de l'installation : une case, un intitulé, une explication.
 *
 * Même gabarit que les lignes de `SkillsList` — les deux se lisent dans la même
 * colonne, et deux gabarits pour la même chose se verraient.
 */
function Option({
  id,
  coche,
  onCoche,
  titre,
  detail,
  children,
}: {
  id: string
  coche: boolean
  onCoche: (valeur: boolean) => void
  titre: string
  detail?: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={s(
        'display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;',
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={coche}
        onChange={event => onCoche(event.target.checked)}
        style={s('margin-top: 3px;')}
      />
      <div style={s('flex: 1; min-width: 0;')}>
        <label htmlFor={id} style={s('display: block; font-size: 12.5px;')}>
          {titre}
        </label>
        {detail && (
          <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;')}>
            {detail}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Un champ texte du formulaire de configuration. */
function Champ({
  id,
  label,
  valeur,
  onValeur,
}: {
  id: string
  label: string
  valeur: string
  onValeur: (valeur: string) => void
}) {
  return (
    <label htmlFor={id} style={s('display: block; margin-top: 8px;')}>
      <span style={s('display: block; font-size: 11px; color: var(--color-neutral-500);')}>
        {label}
      </span>
      <input
        id={id}
        type="text"
        className="input"
        value={valeur}
        onChange={event => onValeur(event.target.value)}
        spellCheck={false}
        style={s('margin-top: 4px; font-family: monospace; font-size: 12px;')}
      />
    </label>
  )
}

interface Formulaire {
  gitInit: boolean
  commit: boolean
  obsidian: boolean
  ecrireConfig: boolean
  dev: string
  baseUrl: string
}

const VIDE: Formulaire = {
  gitInit: false,
  commit: false,
  obsidian: false,
  ecrireConfig: false,
  dev: '',
  baseUrl: '',
}

export function EquipmentPanel({
  root,
  onDone,
  onError,
}: {
  root: string
  onDone: () => void
  onError: (message: string) => void
}) {
  const [state, setState] = useState<FolderState | null>(null)
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<Formulaire>(VIDE)
  const { skills, choisis, setChoisis } = useSkills()

  useEffect(() => {
    setState(null)
    setDone(null)
    getFolderState(root)
      .then(etat => {
        setState(etat)
        // Les cases cochées par défaut sont celles qu'on regretterait d'oublier :
        // sans dépôt git l'installation échoue, sans configuration le crawl ne
        // démarre jamais. L'export Obsidian et le premier commit ne manquent à
        // personne tant qu'on ne les demande pas.
        setForm({
          gitInit: !etat.isGit,
          commit: false,
          obsidian: false,
          ecrireConfig: !etat.hasConfig,
          dev: etat.defaults.dev,
          baseUrl: etat.defaults.baseUrl,
        })
      })
      .catch(err => onError(String(err.message ?? err)))
    fetchSettings().then(setSettings).catch(() => {})
  }, [root, onError])

  const avertissements = state
    ? ([
        !state.isGit && !form.gitInit && t('equipment.not_git'),
        !state.hasLockfile && state.hasPackageJson && t('equipment.missing_lockfile'),
        !state.hasConfig && !form.ecrireConfig && t('equipment.missing_config'),
      ].filter(Boolean) as string[])
    : []

  const bootstrap = settings?.bootstrap?.filter(Boolean) ?? []

  const change = (champ: Partial<Formulaire>) => setForm(avant => ({ ...avant, ...champ }))

  const initialiser = () => {
    setBusy(true)
    projectAction('init', root, {
      skills: choisis,
      gitInit: form.gitInit,
      commit: form.commit,
      obsidian: form.obsidian,
      config: form.ecrireConfig ? { dev: form.dev, baseUrl: form.baseUrl } : null,
    })
      // `onDone` n'est pas appelé ici : il recharge, le projet devient équipé et
      // ce panneau disparaît — emportant la liste de ce qui vient d'être écrit,
      // que personne n'aurait eu le temps de lire. C'est le bouton suivant qui
      // la déclenche, quand l'utilisateur a fini de lire.
      .then(result => setDone(result.done ?? []))
      .catch(err => onError(String(err.message ?? err)))
      .finally(() => setBusy(false))
  }

  if (done) {
    return (
      <div
        style={s(
          'flex: 1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 24px; overflow-y: auto;',
        )}
      >
        <div style={s(`width: min(560px, 100%); ${CARTE}`)}>
          <div style={s(TITRE_CARTE)}>{t('equipment.writes_title')}</div>
          <div style={s('font-size: 11.5px; color: var(--color-neutral-500); line-height: 1.7;')}>
            {done.map(line => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onDone}
          style={s('width: min(560px, 100%);')}
        >
          {t('equipment.done_continue')}
        </button>
      </div>
    )
  }

  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 24px; overflow-y: auto;',
      )}
    >
      <div style={s('width: min(560px, 100%); text-align: left;')}>
        <div style={s('font-size: 14px; color: var(--color-neutral-400);')}>
          {t('equipment.not_equipped')} — {t('equipment.no_plans')}
        </div>
        <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-top: 8px;')}>
          {t('equipment.description')}
        </div>
      </div>

      <div style={s(`width: min(560px, 100%); ${CARTE}`)}>
        <div style={s(TITRE_CARTE)}>{t('equipment.options_title')}</div>
        <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
          {state && !state.isGit && (
            <Option
              id="opt-git-init"
              coche={form.gitInit}
              onCoche={gitInit => change({ gitInit })}
              titre={t('equipment.opt_git_init')}
              detail={t('equipment.opt_git_init_desc')}
            />
          )}

          {state?.hasConfig ? (
            <div style={s('font-size: 11px; color: var(--color-neutral-600); padding: 0 2px;')}>
              {t('equipment.config_exists')}
            </div>
          ) : (
            <Option
              id="opt-config"
              coche={form.ecrireConfig}
              onCoche={ecrireConfig => change({ ecrireConfig })}
              titre={t('equipment.opt_config')}
              detail={t('equipment.config_crawl_note')}
            >
              {form.ecrireConfig && (
                <>
                  <Champ
                    id="champ-dev"
                    label={t('equipment.field_dev')}
                    valeur={form.dev}
                    onValeur={dev => change({ dev })}
                  />
                  <Champ
                    id="champ-base-url"
                    label={t('equipment.field_base_url')}
                    valeur={form.baseUrl}
                    onValeur={baseUrl => change({ baseUrl })}
                  />
                </>
              )}
            </Option>
          )}

          <Option
            id="opt-commit"
            coche={form.commit}
            onCoche={commit => change({ commit })}
            titre={t('equipment.opt_commit')}
            detail={t('equipment.opt_commit_desc')}
          />

          <Option
            id="opt-obsidian"
            coche={form.obsidian}
            onCoche={obsidian => change({ obsidian })}
            titre={t('equipment.opt_obsidian')}
            detail={t('equipment.opt_obsidian_desc')}
          />
        </div>

        {skills.length > 0 && (
          <div style={s('border-top: 1px solid var(--color-divider); padding-top: 12px; margin-top: 12px;')}>
            <div style={s(TITRE_CARTE)}>{t('equipment.skills_title')}</div>
            <SkillsList skills={skills} choisis={choisis} onChoisis={setChoisis} />
          </div>
        )}
      </div>

      {avertissements.length > 0 && (
        <div style={s(`width: min(560px, 100%); ${CARTE}`)}>
          <div style={s(TITRE_CARTE)}>{t('equipment.warnings_title')}</div>
          <ul style={s('margin: 0; padding: 0 0 0 18px; font-size: 11px; color: var(--color-neutral-500);')}>
            {avertissements.map(message => (
              <li key={message} style={s('margin: 3px 0;')}>
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !state}
        onClick={initialiser}
        style={s('width: min(560px, 100%);')}
      >
        {busy ? t('equipment.initializing') : t('equipment.initialize_btn')}
      </button>

      {/* Ce que le cockpit ne fait pas à ta place. Les deux boutons écrivent
          dans le terminal sans envoyer, comme tous les boutons du panneau —
          lancer l'installateur de quelqu'un d'autre n'est pas son rôle. */}
      <div style={s(`width: min(560px, 100%); ${CARTE}`)}>
        <div style={s('font-size: 11.5px; color: var(--color-neutral-500); margin-bottom: 4px;')}>
          {t('equipment.graphify_note')}
        </div>
        <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => envoyerAuTerminal(['/graphify'], setNotice)}
            style={s('font-size: 11px;')}
          >
            {t('equipment.graphify_send')}
          </button>
          {bootstrap.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => envoyerAuTerminal(bootstrap, setNotice)}
              style={s('font-size: 11px;')}
            >
              {t('equipment.send_to_terminal')} — <code>{bootstrap.join(' ')}</code>
            </button>
          )}
        </div>
        {notice && (
          <p style={s('margin: 8px 0 0; font-size: 10.5px; color: var(--color-neutral-500);')}>
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
