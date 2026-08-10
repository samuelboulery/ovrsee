import { useEffect, useState } from 'react'

import { fetchConfigClaude, installSkills, type ConfigClaude } from './data'
import { s } from './style'
import { t } from './i18n'
import { ErrorBox, SectionTitle } from './PreferencesControls'
import { SkillsList, useSkills } from './SkillsPanel'

/**
 * La section « Claude Code » des préférences.
 *
 * Elle réunit ce qui vivait dans deux modales concurrentes de la barre
 * latérale : le catalogue des skills et la lecture de `~/.claude/`. La
 * séparation ne tenait pas — on se demande ce qui est installé et quels skills
 * le sont dans le même mouvement.
 *
 * Tout est en lecture seule sauf les skills : l'ovrsee écrit dans
 * `~/.claude/skills/`, jamais dans les agents, les commandes ou les hooks de
 * quelqu'un d'autre. Le masquage des secrets se fait côté serveur
 * (`hooks/config-claude.js`) : la réponse ne contient aucun secret en clair.
 *
 * Le chargement reste ici, et pas dans la coquille des préférences : ouvrir
 * l'écran pour changer le thème n'a pas à lire `~/.claude/` au passage.
 */

type Vue = 'skills' | 'agents' | 'commands' | 'plugins' | 'hooks' | 'env'

const VUES: Array<[Vue, string]> = [
  ['skills', 'Skills'],
  ['agents', 'Agents'],
  ['commands', 'Commands'],
  ['plugins', 'Plugins'],
  ['hooks', 'Hooks'],
  ['env', 'Env'],
]

/** Le chapeau gris commun à chaque vue : d'où vient ce qu'on lit. */
function Source({ texte, chemin }: { texte: string; chemin: string }) {
  return (
    <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
      {texte} <code>{chemin}</code>.
    </div>
  )
}

/** Le mot qu'on affiche quand une liste est vide. */
function Vide({ texte }: { texte: string }) {
  return <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>{texte}</div>
}

/** Les skills — la seule vue qui écrit quelque chose. */
function VueSkills() {
  const { skills, choisis, setChoisis, setSkills } = useSkills()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <div>
      <div style={s('font-size: 11.5px; color: var(--color-neutral-600); margin-bottom: 12px;')}>
        {t('skills.installed_in')} <code>~/.claude/skills/</code>. {t('skills.learn_ovrsee')}
      </div>

      <SkillsList skills={skills} choisis={choisis} onChoisis={setChoisis} />

      <div style={s('margin-top: 12px; display: flex; flex-direction: column; gap: 10px;')}>
        {erreur && <ErrorBox>{erreur}</ErrorBox>}

        {done && (
          <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
            {done.map(line => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || choisis.length === 0}
          onClick={() => {
            setBusy(true)
            setErreur(null)
            installSkills(choisis)
              .then(result => {
                setDone(result.done)
                setSkills(result.skills)
              })
              .catch(err => setErreur(String(err.message ?? err)))
              .finally(() => setBusy(false))
          }}
        >
          {busy
            ? t('skills.installing')
            : choisis.length === 0
              ? t('skills.nothing_to_install')
              : t('skills.install_count', { count: choisis.length })}
        </button>
      </div>
    </div>
  )
}

export function SectionClaude() {
  const [config, setConfig] = useState<ConfigClaude | null>(null)
  const [busy, setBusy] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [vue, setVue] = useState<Vue>('skills')

  useEffect(() => {
    let vivant = true
    fetchConfigClaude()
      .then(data => {
        if (!vivant) return
        setConfig(data)
        setBusy(false)
      })
      .catch(err => {
        if (!vivant) return
        setErreur(String(err.message ?? err))
        setBusy(false)
      })
    return () => {
      vivant = false
    }
  }, [])

  return (
    <>
      <SectionTitle>{t('pref.claude')}</SectionTitle>

      <div
        style={s(
          'display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--color-divider); padding: 10px 0 12px; margin-bottom: 14px;',
        )}
      >
        {VUES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={vue === id ? 'btn btn-primary' : 'btn btn-ghost'}
            aria-current={vue === id ? 'true' : undefined}
            onClick={() => setVue(id)}
            style={s('font-size: 12px;')}
          >
            {label}
          </button>
        ))}
      </div>

      {erreur && (
        <div style={s('margin-bottom: 12px;')}>
          <ErrorBox>{erreur}</ErrorBox>
        </div>
      )}

      {/* Les skills ne dépendent pas de `/api/config-claude` : ils ont leur
          propre chargement, et une lecture de `~/.claude/` en panne ne doit pas
          emporter la seule vue qui sert à réparer quelque chose. */}
      {vue === 'skills' && <VueSkills />}

      {vue !== 'skills' && busy && (
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          {t('config.loading')}
        </div>
      )}

      {vue !== 'skills' && !busy && config && (
        <>
          {vue === 'agents' && (
            <div>
              <Source texte={t('config.agents_desc')} chemin="~/.claude/agents/" />
              {config.agents.length === 0 ? (
                <Vide texte={t('config.agents_empty')} />
              ) : (
                <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
                  {config.agents.map(agent => (
                    <div
                      key={agent.name}
                      style={s(
                        'display: flex; flex-direction: column; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;',
                      )}
                    >
                      <div style={s('font-size: 12.5px; font-weight: 500;')}>{agent.name}</div>
                      {agent.description && (
                        <div
                          style={s(
                            'font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;',
                          )}
                        >
                          {agent.description}
                        </div>
                      )}
                      {agent.tools && (
                        <div
                          style={s('font-size: 10px; color: var(--color-neutral-600); margin-top: 5px;')}
                        >
                          {t('config.tools')}{' '}
                          {Array.isArray(agent.tools) ? agent.tools.join(', ') : agent.tools}
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

          {vue === 'commands' && (
            <div>
              <Source texte={t('config.commands_desc')} chemin="~/.claude/commands/" />
              {config.commands.length === 0 ? (
                <Vide texte={t('config.commands_empty')} />
              ) : (
                <div style={s('display: flex; flex-direction: column; gap: 10px;')}>
                  {config.commands.map(cmd => (
                    <div
                      key={cmd.name}
                      style={s(
                        'display: flex; flex-direction: column; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;',
                      )}
                    >
                      <div style={s('font-size: 12.5px; font-weight: 500;')}>{cmd.name}</div>
                      {cmd.description && (
                        <div
                          style={s(
                            'font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;',
                          )}
                        >
                          {cmd.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {vue === 'plugins' && (
            <div>
              <Source
                texte={t('config.plugins_desc')}
                chemin="~/.claude/plugins/installed_plugins.json"
              />
              {config.plugins.length === 0 ? (
                <Vide texte={t('config.plugins_empty')} />
              ) : (
                <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
                  {config.plugins.map(plugin => (
                    <div
                      key={plugin.name}
                      style={s(
                        'display: flex; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-divider); border-radius: 6px; align-items: center;',
                      )}
                    >
                      <div style={s('font-size: 12px;')}>{plugin.name}</div>
                      <div style={s('flex: 1;')} />
                      <div
                        className="tag"
                        style={s(
                          `font-size: 10px;${plugin.status === 'enabled' ? ' color: var(--color-accent-300);' : ''}`,
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

          {vue === 'hooks' && (
            <div>
              <Source texte={t('config.hooks_desc')} chemin="~/.claude/settings.json" />
              {Object.keys(config.hooks).length === 0 ? (
                <Vide texte={t('config.hooks_empty')} />
              ) : (
                <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
                  {Object.entries(config.hooks).map(([eventName, hookItems]) => (
                    <div key={eventName}>
                      <div style={s('font-size: 12px; font-weight: 500; margin-bottom: 4px;')}>
                        {eventName}
                      </div>
                      {Array.isArray(hookItems) &&
                        hookItems.map((item, idx) => (
                          <div
                            key={`${eventName}-${idx}`}
                            style={s(
                              'display: flex; flex-direction: column; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; margin-left: 8px; font-size: 11px;',
                            )}
                          >
                            {item.matcher && (
                              <div style={s('color: var(--color-neutral-600);')}>
                                {t('config.matcher')} <code>{item.matcher}</code>
                              </div>
                            )}
                            {item.hooks && Array.isArray(item.hooks) && (
                              <div style={s('color: var(--color-neutral-500); margin-top: 2px;')}>
                                {item.hooks.length} {t('config.hooks_label')}{' '}
                                {item.hooks.map((h: any) => h.type).join(', ')}
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

          {vue === 'env' && (
            <div>
              <Source texte={t('config.env_desc')} chemin="~/.claude/settings.json" />
              <div style={s('font-size: 11px; color: var(--color-neutral-600); margin: -6px 0 12px;')}>
                {t('config.env_masked')}
              </div>
              {Object.keys(config.env).length === 0 ? (
                <Vide texte={t('config.env_empty')} />
              ) : (
                <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
                  {Object.keys(config.env).map(key => (
                    <div
                      key={key}
                      style={s(
                        'display: flex; gap: 10px; padding: 6px 8px; border: 1px solid var(--color-divider); border-radius: 4px; font-size: 11px;',
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
    </>
  )
}
