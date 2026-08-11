import { useState } from 'react'

import {
  humanAge,
  type DeploymentInfo,
  type Integration,
  type IntegrationProvider,
  type IntegrationState,
  type IntegrationStatus,
} from '../data'
import { t, type TranslationKey } from '../i18n'
import { s } from '../style'
import type { IntegrationsBridge } from '../useTerminal'

const ETAT_STYLE: Record<IntegrationState, string> = {
  ok: 'color: var(--color-accent); border: 1px solid var(--color-accent-700);',
  error: 'color: var(--color-accent); border: 1px solid var(--color-accent-700);',
  building: 'color: var(--color-neutral-300); border: 1px solid var(--color-neutral-700);',
  unknown: 'color: var(--color-neutral-500); border: 1px dashed var(--color-neutral-700);',
}

const ETAT_LABEL: Record<IntegrationState, TranslationKey> = {
  ok: 'deploiements.state_ok',
  error: 'deploiements.state_error',
  building: 'deploiements.state_building',
  unknown: 'deploiements.state_unknown',
}

/**
 * Le pont des secrets d'intégration, ou rien.
 *
 * Lu directement sur `window`, sans importer `useTerminal.ts` : ce module
 * charge `@xterm/xterm` (et sa feuille de style), qui n'existe pas dans le
 * rendu serveur des tests (`render.test.tsx`). Seul le *type* du pont est
 * importé ici — effacé à la compilation, donc sans effet sur le runtime.
 */
const bridge = (): IntegrationsBridge | null => {
  if (typeof window === 'undefined') return null
  return window.ovrsee?.integrations ?? null
}

const CLE_MASQUE = 'ovrsee.deploiements.hidden'

/**
 * Intégrations déploiements/base de données — Vercel, Netlify, Supabase,
 * autre. Aucun statut n'est vérifié au chargement : voir `Branches.tsx`,
 * même principe pour la même raison — un appel réseau silencieux à chaque
 * ouverture de l'onglet coûterait à qui a une connexion lente ou un jeton
 * proche de sa limite de requêtes.
 *
 * Ajouter, éditer ou supprimer une intégration se fait dans Préférences ;
 * cette carte n'affiche que ce qui est déjà configuré.
 *
 * Vide, la carte reste visible avec deux CTA plutôt que de disparaître : le
 * seul moyen de savoir que la fonctionnalité existe. Un bouton « Masquer »
 * la retire pour qui ne s'en sert pas — mais dès qu'une intégration existe,
 * la carte redevient utile et s'affiche sans tenir compte de ce réglage, pas
 * besoin d'aller le rouvrir quelque part.
 */
export function Deploiements({
  root,
  integrations,
  onOpenPreferences,
}: {
  root: string
  integrations: Integration[]
  onOpenPreferences: (opts?: { provider?: IntegrationProvider }) => void
}) {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [checking, setChecking] = useState<string | null>(null)
  const [masque, setMasque] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(CLE_MASQUE) === '1',
  )
  const ovrsee = bridge()

  if (integrations.length === 0) {
    if (masque) return null

    return (
      <div style={s('margin-top: 18px;')} className="card">
        <div style={s('display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;')}>
          <div>
            <Titre>{t('deploiements.title')}</Titre>
            <div style={s('font-size: 12px; color: var(--color-neutral-500); max-width: 480px;')}>
              {t('deploiements.empty_desc')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={s('font-size: 11px; padding: 3px 9px; flex: none;')}
            onClick={() => {
              localStorage.setItem(CLE_MASQUE, '1')
              setMasque(true)
            }}
          >
            {t('deploiements.hide')}
          </button>
        </div>
        <div style={s('display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;')}>
          <button
            type="button"
            className="btn btn-secondary"
            style={s('font-size: 12px; padding: 4px 9px;')}
            onClick={() => onOpenPreferences({ provider: 'vercel' })}
          >
            {t('deploiements.add_deploy')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={s('font-size: 12px; padding: 4px 9px;')}
            onClick={() => onOpenPreferences({ provider: 'supabase' })}
          >
            {t('deploiements.add_db')}
          </button>
        </div>
      </div>
    )
  }

  const verifier = (id: string) => {
    if (!ovrsee) return
    setChecking(id)
    ovrsee
      .checkStatus(root, id)
      .then(status => setStatuses(prev => ({ ...prev, [id]: status })))
      .finally(() => setChecking(null))
  }

  return (
    <div style={s('margin-top: 18px;')}>
      <Titre>{t('deploiements.title')}</Titre>
      <div style={s('display: flex; flex-wrap: wrap; gap: 10px;')}>
        {integrations.map(integ => {
          const status = statuses[integ.id]
          const etat = status?.state ?? 'unknown'
          const deployments = status?.deployments

          return (
            <div
              key={integ.id}
              className="card"
              style={s(`padding: 9px 12px; min-width: ${deployments?.length ? 320 : 190}px;`)}
            >
              <div style={s('display: flex; align-items: center; gap: 6px;')}>
                <div style={s('font-size: 12.5px; font-weight: 500;')}>{integ.label}</div>
                <span className="tag" style={s(`font-size: 10px; ${ETAT_STYLE[etat]}`)}>
                  {status ? t(ETAT_LABEL[etat]) : t('deploiements.never_checked')}
                </span>
              </div>

              <div
                style={s(
                  'font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;',
                )}
              >
                {integ.provider}
              </div>

              {integ.url && (
                <a
                  href={integ.url}
                  target="_blank"
                  rel="noreferrer"
                  style={s('font-size: 11px; color: var(--color-accent); margin-top: 3px; display: block;')}
                >
                  {integ.url}
                </a>
              )}

              {deployments?.length ? (
                <div style={s('margin-top: 6px;')}>
                  {deployments.map(d => (
                    <LigneDeploiement key={d.id} d={d} />
                  ))}
                </div>
              ) : (
                status?.detail && (
                  <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}>
                    {status.detail}
                  </div>
                )
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={s('font-size: 11px; padding: 3px 9px; margin-top: 7px;')}
                disabled={!ovrsee || checking === integ.id}
                title={ovrsee ? undefined : t('deploiements.electron_only')}
                onClick={() => verifier(integ.id)}
              >
                {checking === integ.id ? t('deploiements.checking') : t('deploiements.check')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LIGNE_STYLE =
  'display: flex; align-items: center; gap: 6px; padding: 4px 6px; margin: 0 -6px; border-top: 1px solid var(--color-divider); border-radius: 4px; text-decoration: none; color: inherit; transition: background .1s;'

/**
 * Une ligne = un déploiement. Cliquable vers son URL propre quand elle
 * existe — pas seulement vers le tableau de bord général du fournisseur,
 * c'est tout l'intérêt par rapport au lien unique déjà affiché plus haut.
 *
 * Le fond au survol est le seul indice que la ligne est cliquable : le
 * curseur `pointer` d'un `<a>` se voit à peine sur du texte sans bouton ni
 * soulignement.
 */
function LigneDeploiement({ d }: { d: DeploymentInfo }) {
  const [survol, setSurvol] = useState(false)
  const style = s(LIGNE_STYLE + (d.url && survol ? ' background: var(--theme-bg-tertiary);' : ''))
  const survolProps = d.url ? { onMouseEnter: () => setSurvol(true), onMouseLeave: () => setSurvol(false) } : {}

  const contenu = (
    <>
      <span
        style={s(
          `width: 6px; height: 6px; border-radius: 50%; flex: none; background: currentColor; ${ETAT_STYLE[d.state]}`,
        )}
      />
      <span
        className={`tag ${d.environment === 'Production' ? 'tag-accent' : 'tag-neutral'}`}
        style={s('font-size: 9.5px; padding: 1px 7px;')}
      >
        {d.environment}
      </span>
      {d.commit && (
        <span style={s('font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--color-neutral-500);')}>
          {d.commit}
        </span>
      )}
      {d.branch && (
        <span
          style={s(
            'font-size: 10.5px; color: var(--color-neutral-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          )}
        >
          {d.branch}
        </span>
      )}
      <span style={s('margin-left: auto; font-size: 10.5px; color: var(--color-neutral-600); flex: none;')}>
        {humanAge(d.createdAt)}
      </span>
    </>
  )

  if (!d.url) return <div style={style}>{contenu}</div>

  return (
    <a href={d.url} target="_blank" rel="noreferrer" style={style} {...survolProps}>
      {contenu}
    </a>
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
