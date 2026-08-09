import { useEffect, useState } from 'react'

import { fetchConfigClaude, fetchSkills, type ConfigClaude, type SkillEntry } from './data'
import { s } from './style'
import { t } from './i18n'
import { SkillsList } from './SkillsPanel'

/**
 * Affiche la configuration Claude Code : agents, commands, plugins, hooks, env.
 *
 * Les sections sont en lecture seule — rien n'est modifié depuis cette modale.
 * Le masquage des secrets s'effectue côté serveur : la réponse ne contient aucun
 * secret en clair.
 */
export function ConfigClaudeModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<ConfigClaude | null>(null)
  const [skills, setSkills] = useState<SkillEntry[]>([])
  const [busy, setBusy] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'skills' | 'agents' | 'commands' | 'plugins' | 'hooks' | 'env'>(
    'agents'
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setBusy(true)
    setErreur(null)
    Promise.all([fetchConfigClaude(), fetchSkills()])
      .then(([data, skillsList]) => {
        setConfig(data)
        setSkills(skillsList)
        setBusy(false)
      })
      .catch(err => {
        setErreur(String(err.message ?? err))
        setBusy(false)
      })
  }, [])

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px;'
      )}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={s(
          'width: min(720px, 100%); max-height: 100%; overflow: auto; background: var(--theme-bg-secondary); border: 1px solid var(--color-divider); border-radius: 8px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;'
        )}
      >
        <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
          <h2
            style={s(
              'font-family: var(--font-heading); font-weight: 500; font-size: 16px; margin: 0;'
            )}
          >
            {t('config.title')}
          </h2>
          <div style={s('flex: 1;')} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('config.close')}
          </button>
        </div>

        {erreur && (
          <div
            style={s(
              'font-size: 12px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;'
            )}
          >
            {erreur}
          </div>
        )}

        {busy && (
          <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
            {t('config.loading')}
          </div>
        )}

        {!busy && config && (
          <>
            <div style={s('display: flex; gap: 8px; border-bottom: 1px solid var(--color-divider); padding-bottom: 10px;')}>
              {(
                ['skills', 'agents', 'commands', 'plugins', 'hooks', 'env'] as const
              ).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'btn btn-primary' : 'btn btn-ghost'}
                  onClick={() => setActiveTab(tab)}
                  style={s('font-size: 12px;')}
                >
                  {tab === 'skills'
                    ? 'Skills'
                    : tab === 'agents'
                      ? 'Agents'
                      : tab === 'commands'
                        ? 'Commands'
                        : tab === 'plugins'
                          ? 'Plugins'
                          : tab === 'hooks'
                            ? 'Hooks'
                            : 'Env'}
                </button>
              ))}
            </div>

            {activeTab === 'skills' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.skills_desc')} <code>~/.claude/skills/</code>.
                </div>
                <SkillsList skills={skills} choisis={[]} onChoisis={() => {}} />
              </div>
            )}

            {activeTab === 'agents' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.agents_desc')} <code>~/.claude/agents/</code>.
                </div>
                {config.agents.length === 0 ? (
                  <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
                    {t('config.agents_empty')}
                  </div>
                ) : (
                  <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
                    {config.agents.map(agent => (
                      <div
                        key={agent.name}
                        style={s(
                          'display: flex; flex-direction: column; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;'
                        )}
                      >
                        <div style={s('font-size: 12.5px; font-weight: 500;')}>
                          {agent.name}
                        </div>
                        {agent.description && (
                          <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;')}>
                            {agent.description}
                          </div>
                        )}
                        {agent.tools && (
                          <div style={s('font-size: 10px; color: var(--color-neutral-600); margin-top: 5px;')}>
                            {t('config.tools')} {Array.isArray(agent.tools) ? agent.tools.join(', ') : agent.tools}
                          </div>
                        )}
                        {agent.model && (
                          <div style={s('font-size: 10px; color: var(--color-neutral-600);')}>
                            {t('config.model')} {agent.model}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'commands' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.commands_desc')} <code>~/.claude/commands/</code>.
                </div>
                {config.commands.length === 0 ? (
                  <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
                    {t('config.commands_empty')}
                  </div>
                ) : (
                  <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
                    {config.commands.map(cmd => (
                      <div
                        key={cmd.name}
                        style={s(
                          'display: flex; flex-direction: column; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;'
                        )}
                      >
                        <div style={s('font-size: 12.5px; font-weight: 500;')}>
                          {cmd.name}
                        </div>
                        {cmd.description && (
                          <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;')}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plugins' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.plugins_desc')} <code>~/.claude/plugins/installed_plugins.json</code>.
                </div>
                {config.plugins.length === 0 ? (
                  <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
                    {t('config.plugins_empty')}
                  </div>
                ) : (
                  <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
                    {config.plugins.map(plugin => (
                      <div
                        key={plugin.name}
                        style={s(
                          'display: flex; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-divider); border-radius: 6px; align-items: center;'
                        )}
                      >
                        <div style={s('font-size: 12px;')}>{plugin.name}</div>
                        <div style={s('flex: 1;')} />
                        <div
                          className="tag"
                          style={s(
                            `font-size: 10px;${plugin.status === 'enabled' ? ' color: var(--color-accent-300);' : ''}`
                          )}
                        >
                          {plugin.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'hooks' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.hooks_desc')} <code>~/.claude/settings.json</code>.
                </div>
                {Object.keys(config.hooks).length === 0 ? (
                  <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
                    {t('config.hooks_empty')}
                  </div>
                ) : (
                  <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
                    {Object.entries(config.hooks).map(([eventName, hookItems]) => (
                      <div key={eventName}>
                        <div style={s('font-size: 12px; font-weight: 500; margin-bottom: 4px;')}>
                          {eventName}
                        </div>
                        {Array.isArray(hookItems) && hookItems.map((item, idx) => (
                          <div
                            key={`${eventName}-${idx}`}
                            style={s(
                              'display: flex; flex-direction: column; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; margin-left: 8px; font-size: 11px;'
                            )}
                          >
                            {item.matcher && (
                              <div style={s('color: var(--color-neutral-600);')}>
                                {t('config.matcher')} <code>{item.matcher}</code>
                              </div>
                            )}
                            {item.hooks && Array.isArray(item.hooks) && (
                              <div style={s('color: var(--color-neutral-500); margin-top: 2px;')}>
                                {item.hooks.length} {t('config.hooks_label')} {item.hooks.map((h: any) => h.type).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'env' && (
              <div>
                <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
                  {t('config.env_desc')} <code>~/.claude/settings.json</code>. Les valeurs sont masquées.
                </div>
                {Object.keys(config.env).length === 0 ? (
                  <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
                    {t('config.env_empty')}
                  </div>
                ) : (
                  <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
                    {Object.keys(config.env).map(key => (
                      <div
                        key={key}
                        style={s(
                          'display: flex; gap: 10px; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 11px;'
                        )}
                      >
                        <code>{key}</code>
                        <div style={s('flex: 1;')} />
                        <code style={s('color: var(--color-neutral-500);')}>****</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
