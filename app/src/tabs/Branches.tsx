import { useState } from 'react'

import { gitFetch, humanAge, type GitStatus } from '../data'
import { t } from '../i18n'
import { s } from '../style'

/**
 * Branches locales et leur avance/retard sur la remote suivie.
 *
 * Aucun fetch au chargement — voir le plan lié : un appel réseau silencieux à
 * chaque ouverture de l'onglet coûterait à qui a une connexion lente ou un
 * dépôt privé sans identifiants en cache. `gitStatus.lastFetch` dit donc
 * depuis quand ces chiffres sont connus, et le bouton les met à jour.
 */
export function Branches({
  root,
  gitStatus,
  onGitStatus,
}: {
  root: string
  gitStatus: GitStatus
  onGitStatus: (status: GitStatus) => void
}) {
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (gitStatus.branch === null && gitStatus.branches.length === 0) return null

  return (
    <div style={s('margin-top: 18px;')}>
      <div style={s('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
        <Titre>{t('branches.title')}</Titre>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          style={s('font-size: 11.5px; padding: 3px 9px;')}
          onClick={() => {
            setBusy(true)
            setErreur(null)
            gitFetch(root)
              .then(result => onGitStatus(result.gitStatus))
              .catch(err => setErreur(String(err.message ?? err)))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? t('branches.refreshing') : t('branches.refresh')}
        </button>
      </div>

      <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-bottom: 8px;')}>
        {gitStatus.lastFetch ? t('branches.last_fetch', { age: humanAge(gitStatus.lastFetch) }) : t('branches.never_fetched')}
      </div>

      {erreur && (
        <div
          style={s(
            'margin-bottom: 8px; font-size: 12px; color: var(--color-accent); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
          )}
        >
          {erreur}
        </div>
      )}

      <div className="table" style={s('font-size: 12px;')}>
        <table style={s('width: 100%; border-collapse: collapse;')}>
          <tbody>
            {gitStatus.branches.map(branche => (
              <tr key={branche.name}>
                <td style={s('padding: 4px 10px 4px 0; font-family: ui-monospace, monospace;')}>
                  {branche.name === gitStatus.branch ? <strong>{branche.name}</strong> : branche.name}
                </td>
                <td style={s('padding: 4px 10px; color: var(--color-neutral-500);')}>
                  {branche.upstream ?? t('branches.no_upstream')}
                </td>
                <td style={s('padding: 4px 0; color: var(--color-neutral-500); text-align: right;')}>
                  {branche.ahead === 0 && branche.behind === 0
                    ? t('branches.up_to_date')
                    : [
                        branche.ahead > 0 ? t('branches.ahead', { n: branche.ahead }) : null,
                        branche.behind > 0 ? t('branches.behind', { n: branche.behind }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
