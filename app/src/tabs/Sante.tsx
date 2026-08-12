import { humanAge, lastAudit, plansOuverts, type GitStatus, type Snapshot } from '../data'
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
export function Sante({ snapshot, gitStatus }: { snapshot: Snapshot; gitStatus: GitStatus }) {
  const git = gitStatus
  const ouverts = plansOuverts(snapshot.plans ?? [])
  const audit = lastAudit(snapshot.audits ?? [])
  const fichiersModifies = git.dirty.staged + git.dirty.unstaged + git.dirty.untracked
  const ahead = git.branches.find(b => b.name === git.branch)?.ahead ?? 0

  return (
    <div style={s('margin-top: 18px;')}>
      <Titre>{t('sante.title')}</Titre>
      <div style={s('display: flex; flex-wrap: wrap; gap: 8px;')}>
        <Badge
          accent={fichiersModifies > 0}
          texte={
            git.branch === null
              ? t('sante.no_branch')
              : fichiersModifies > 0
                ? t('sante.tree_dirty', { n: fichiersModifies })
                : t('sante.tree_clean')
          }
        />
        {git.branch !== null && (
          <Badge
            accent={ahead > 0}
            texte={ahead > 0 ? t('sante.unpushed', { n: ahead }) : t('sante.unpushed_none')}
          />
        )}
        <Badge
          accent={audit === null}
          texte={
            audit
              ? t('sante.last_audit', { age: humanAge(audit.date), skill: audit.skill })
              : t('sante.no_audit')
          }
        />
      </div>

      <div style={s('margin-top: 10px;')}>
        <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-bottom: 6px;')}>
          {ouverts.length > 0 ? `${t('sante.open_plans')} · ${ouverts.length}` : t('sante.no_open_plans')}
        </div>
        {ouverts.length > 0 && (
          <div style={s('display: flex; flex-direction: column; gap: 3px;')}>
            {ouverts.map(plan => (
              <div
                key={plan.file}
                style={s('font-size: 11.5px; color: var(--color-neutral-400); display: flex; gap: 8px;')}
              >
                <span style={s('flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
                  {plan.title}
                </span>
                <span style={s('color: var(--color-neutral-600); flex: none;')}>
                  {humanAge(plan.opened)}
                </span>
              </div>
            ))}
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
        'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;',
      )}
    >
      {children}
    </div>
  )
}

function Badge({ texte, accent = false }: { texte: string; accent?: boolean }) {
  return (
    <span
      className={accent ? 'tag tag-accent' : 'tag tag-neutral'}
      style={s('font-size: 11.5px;')}
    >
      {texte}
    </span>
  )
}
