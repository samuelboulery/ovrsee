import { useEffect, useState } from 'react'
import { projectAction, getFolderState, fetchSettings, decideInjection, type FolderState, type SettingsType } from './data'
import { t } from './i18n'
import { pasteToClaude } from './useTerminal'
import { s } from './style'
import { SkillsList, useSkills } from './SkillsPanel'


/**
 * Envoie les commandes de bootstrap à la session, une par une.
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
async function envoyerBootstrap(
  commandes: string[],
  dire: (message: string | null) => void,
): Promise<void> {
  const envoyees = commandes.filter(Boolean).map(commande => decideInjection(commande))
  const toutesPassees = envoyees.every(({ text }) => pasteToClaude(text))

  if (toutesPassees && envoyees.length > 0) {
    dire(`${envoyees.length} commande(s) envoyée(s) à la session Claude`)
    return
  }

  try {
    await navigator.clipboard.writeText(commandes.join('\n'))
    dire('Pas de session ouverte — commandes copiées dans le presse-papier')
  } catch {
    dire('Pas de session ouverte, et la copie a été refusée par le navigateur')
  }
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
  const { skills, choisis, setChoisis } = useSkills()

  useEffect(() => {
    getFolderState(root).then(setState).catch(err => onError(String(err.message ?? err)))
    fetchSettings().then(setSettings).catch(() => {})
  }, [root, onError])

  const missingPrereq = state
    ? ([
        !state.isGit && t('equipment.missing_git'),
        !state.hasLockfile && state.hasPackageJson && t('equipment.missing_lockfile'),
        !state.hasConfig && t('equipment.missing_config'),
      ].filter(Boolean) as string[])
    : []

  const bootstrapCommands = settings?.bootstrap || ['/project-setup']

  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; overflow-y: auto;',
      )}
    >
      {state && !state.isGit && (
        <div
          style={s(
            'width: min(520px, 100%); padding: 12px; background: var(--theme-bg-secondary); border-radius: 4px; text-align: left;',
          )}
        >
          <div style={s('font-size: 11px; font-weight: 500; color: var(--color-accent-500); margin-bottom: 8px;')}>
            {t('equipment.bootstrap_title')}
          </div>
          <p style={s('margin: 0 0 8px; font-size: 10px; color: var(--color-neutral-500);')}>
            {t('equipment.bootstrap_desc')}
          </p>
          <code
            style={s(
              'display: block; padding: 8px; background: var(--theme-bg-tertiary); border-radius: 3px; font-size: 10px; color: var(--color-accent-400); margin-bottom: 8px; word-break: break-all;',
            )}
          >
            {bootstrapCommands.join('\n')}
          </code>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => envoyerBootstrap(bootstrapCommands, setNotice)}
            style={s('font-size: 10px;')}
          >
            {t('equipment.send_to_terminal')}
          </button>
          {notice && (
            <p style={s('margin: 8px 0 0; font-size: 10px; color: var(--color-neutral-500);')}>
              {notice}
            </p>
          )}
        </div>
      )}

      <div>
        <div style={s('font-size: 13px; color: var(--color-neutral-400);')}>
          {t('equipment.not_equipped')} — {t('equipment.no_plans')}
        </div>
        <div style={s('font-size: 11.5px; color: var(--color-neutral-600); max-width: 52ch; margin-top: 8px;')}>
          {t('equipment.description')}
        </div>
      </div>

      {missingPrereq.length > 0 && !done && (
        <div
          style={s(
            'width: min(520px, 100%); padding: 12px; background: var(--theme-bg-secondary); border-radius: 4px; text-align: left;',
          )}
        >
          <div style={s('font-size: 11px; font-weight: 500; color: var(--color-neutral-600); margin-bottom: 8px;')}>
            {t('equipment.prerequisites_title')}
          </div>
          <ul style={s('margin: 0; padding: 0 0 0 18px; font-size: 10px; color: var(--color-neutral-500);')}>
            {missingPrereq.map(msg => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {!done && (
        <div style={s('width: min(520px, 100%); margin-top: 8px; text-align: left;')}>
          <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-bottom: 12px;')}>
            <strong>L'initialisation écrit :</strong>
            <ul style={s('margin: 8px 0 0 0; padding-left: 18px;')}>
              <li style={s('margin: 4px 0;')}>✓ cockpit/plans/</li>
              <li style={s('margin: 4px 0;')}>✓ .git/hooks/post-commit</li>
              {/* 2 hooks: SessionStart (l.145) + PostToolUse (l.154) dans hooks/install.js:installClaudeHooks */}
              <li style={s('margin: 4px 0;')}>✓ ~/.claude/settings.json (2 hooks Claude Code)</li>
            </ul>
          </div>

          {skills.length > 0 && (
            <div style={s('border-top: 1px solid var(--color-divider); padding-top: 12px; margin-top: 12px;')}>
              <div
                style={s(
                  'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px;',
                )}
              >
                {t('equipment.skills_title')}
              </div>
              <SkillsList skills={skills} choisis={choisis} onChoisis={setChoisis} />
            </div>
          )}
        </div>
      )}

      {done ? (
        <div style={s('font-size: 11px; color: var(--color-neutral-500); text-align: left;')}>
          {done.map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy || !state || missingPrereq.length > 0}
          onClick={() => {
            setBusy(true)
            projectAction('init', root, { skills: choisis })
              .then(result => {
                setDone(result.done ?? [])
                onDone()
              })
              .catch(err => onError(String(err.message ?? err)))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? t('equipment.initializing') : t('equipment.initialize_btn')}
        </button>
      )}
    </div>
  )
}
