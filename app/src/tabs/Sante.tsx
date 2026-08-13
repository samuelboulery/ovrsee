import { useState } from 'react'

import { closeActivePlans, humanAge, lastAudit, plansOuverts, type GitStatus, type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'

/**
 * Indicateurs factuels sur l'état du dépôt, sans note ni score.
 *
 * Le projet évite délibérément de résumer ou d'interpréter (voir les
 * commentaires de `data.ts` sur les faux résumés) — un score composite ferait
 * exactement ça. Chaque ligne ici est vérifiable d'un coup d'œil au terminal :
 * `git status`, la date du dernier scan, la date du dernier audit tracé.
 *
 * `gitStatus` vient de l'état local d'`Apercu`, pas de `snapshot.gitStatus` :
 * c'est ce qu'un clic sur Rafraîchir (dans `Branches`) met à jour sans
 * attendre un rechargement complet du projet.
 */
export function Sante({
  snapshot,
  gitStatus,
  onReload,
  onVoirTousLesPlans,
}: {
  snapshot: Snapshot
  gitStatus: GitStatus
  /** Relit `ovrsee/` — après avoir clos le plan actif, il faut relire pour le voir disparaître. */
  onReload: () => void
  onVoirTousLesPlans: () => void
}) {
  const git = gitStatus
  const ouverts = plansOuverts(snapshot.plans ?? [])
  const audit = lastAudit(snapshot.audits ?? [])
  const fichiersModifies = git.dirty.staged + git.dirty.unstaged + git.dirty.untracked
  const ahead = git.branches.find(b => b.name === git.branch)?.ahead ?? 0
  const [clotureEnCours, setClotureEnCours] = useState(false)
  const [erreurCloture, setErreurCloture] = useState<string | null>(null)

  const clorePlanActif = () => {
    if (clotureEnCours) return
    setClotureEnCours(true)
    setErreurCloture(null)
    closeActivePlans(snapshot.root)
      .then(() => onReload())
      .catch(err => setErreurCloture(String(err.message ?? err)))
      .finally(() => setClotureEnCours(false))
  }

  return (
    <div style={s('margin-top: 18px;')}>
      <Titre>{t('sante.title')}</Titre>
      <div style={s('display: flex; flex-wrap: wrap; gap: 8px;')}>
        <Badge
          etat={fichiersModifies > 0 ? 'attention' : 'ok'}
          texte={
            git.branch === null
              ? t('sante.no_branch')
              : fichiersModifies > 0
                ? t(fichiersModifies > 1 ? 'sante.tree_dirty_plural' : 'sante.tree_dirty', { n: fichiersModifies })
                : t('sante.tree_clean')
          }
        />
        {git.branch !== null && (
          <Badge
            etat={ahead > 0 ? 'attention' : 'ok'}
            texte={
              ahead > 0
                ? t(ahead > 1 ? 'sante.unpushed_plural' : 'sante.unpushed', { n: ahead })
                : t('sante.unpushed_none')
            }
          />
        )}
        <Badge
          etat="neutre"
          texte={
            audit
              ? t('sante.last_audit', { age: humanAge(audit.date), skill: audit.skill })
              : t('sante.no_audit')
          }
        />
      </div>

      <div style={s('margin-top: 10px;')}>
        <div style={s('display: flex; align-items: center; gap: 8px; margin-bottom: 6px;')}>
          <div style={s('font-size: 11px; color: var(--color-neutral-600); flex: 1;')}>
            {ouverts.length > 0 ? `${t('sante.open_plans')} · ${ouverts.length}` : t('sante.no_open_plans')}
          </div>
          {snapshot.activePlan && ouverts.some(p => p.file === snapshot.activePlan) && (
            <button
              type="button"
              disabled={clotureEnCours}
              onClick={clorePlanActif}
              style={s(
                'cursor: pointer; font-size: 10.5px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
              )}
            >
              {clotureEnCours ? t('sante.closing_plan') : t('sante.close_active_plan')}
            </button>
          )}
          {ouverts.length > 0 && (
            <button
              type="button"
              onClick={onVoirTousLesPlans}
              style={s(
                'cursor: pointer; font-size: 10.5px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
              )}
            >
              {t('sante.see_all_plans')}
            </button>
          )}
        </div>

        {erreurCloture && (
          <div style={s('font-size: 11px; color: var(--color-err); margin-bottom: 8px;')}>{erreurCloture}</div>
        )}

        {ouverts.length > 0 && (
          <div style={s('border: 1px solid var(--color-border-card); border-radius: 8px; background: var(--color-surface-card); overflow: hidden;')}>
            {ouverts.map((plan, index) => {
              const actif = plan.file === snapshot.activePlan
              return (
                <div
                  key={plan.file}
                  style={s(
                    'display: flex; align-items: center; gap: 8px; padding: 8px 10px; ' +
                      (index < ouverts.length - 1 ? 'border-bottom: 1px solid var(--color-border-chrome);' : ''),
                  )}
                >
                  <span
                    style={s(
                      `width: 5px; height: 5px; border-radius: 50%; flex: none; background: ${actif ? 'var(--color-accent)' : 'var(--color-text-ghost)'};`,
                    )}
                  />
                  <span
                    style={s(
                      'flex: 1; font-size: 11.5px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                    )}
                  >
                    {plan.title}
                  </span>
                  {actif && (
                    <span
                      style={s(
                        'flex: none; font-size: 9.5px; padding: 1px 6px; border-radius: 4px; color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border);',
                      )}
                    >
                      {t('sante.active_badge')}
                    </span>
                  )}
                  <span style={s('flex: none; font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-quaternary);')}>
                    {humanAge(plan.opened)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={s(
        'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-discrete); margin-bottom: 10px;',
      )}
    >
      {children}
    </div>
  )
}

const ETAT_BADGE: Record<'ok' | 'attention' | 'neutre', string> = {
  ok: 'background: var(--color-ok-bg); border: 1px solid var(--color-ok-border); color: var(--color-ok);',
  attention: 'background: var(--color-warn-bg); border: 1px solid var(--color-warn-border); color: var(--color-warn);',
  neutre: 'background: var(--color-surface-control); border: 1px solid var(--color-border-control); color: var(--color-text-tertiary);',
}
const DOT_ETAT: Record<'ok' | 'attention' | 'neutre', string> = {
  ok: 'var(--color-ok)',
  attention: 'var(--color-warn)',
  neutre: 'var(--color-text-faint)',
}

function Badge({ texte, etat }: { texte: string; etat: 'ok' | 'attention' | 'neutre' }) {
  return (
    <span
      style={s(
        `display: inline-flex; align-items: center; gap: 7px; height: 27px; padding: 0 10px; border-radius: 6px; font-size: 12px; ${ETAT_BADGE[etat]}`,
      )}
    >
      <span style={s(`width: 5px; height: 5px; border-radius: 50%; display: block; background: ${DOT_ETAT[etat]};`)} />
      {texte}
    </span>
  )
}
