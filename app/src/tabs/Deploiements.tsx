import { useState } from 'react'
import { ArrowUpRight, Plus } from '@phosphor-icons/react'

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

const DOT_ETAT: Record<IntegrationState, string> = {
  ok: 'var(--color-ok)',
  error: 'var(--color-err)',
  building: 'var(--color-text-tertiary)',
  unknown: 'var(--color-text-faint)',
}

const ETAT_STYLE: Record<IntegrationState, string> = {
  ok: 'color: var(--color-ok); border: 1px solid var(--color-ok-border);',
  error: 'color: var(--color-err); border: 1px solid var(--color-err-border);',
  building: 'color: var(--color-neutral-300); border: 1px solid var(--color-border-control);',
  unknown: 'color: var(--color-neutral-500); border: 1px dashed var(--color-border-control);',
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
      <div>
        <EnTete onOpenPreferences={onOpenPreferences} onMasquer={() => {
          localStorage.setItem(CLE_MASQUE, '1')
          setMasque(true)
        }} />
        <div style={s('padding: 14px 0 0;')}>
          <div style={s('font-size: 12px; color: var(--color-neutral-500); max-width: 480px; margin-bottom: 10px;')}>
            {t('deploiements.empty_desc')}
          </div>
          <button
            type="button"
            onClick={() => onOpenPreferences()}
            style={s(
              'width: 100%; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 8px; border: 1px dashed var(--color-border-control); background: transparent; color: var(--color-text-quaternary);',
            )}
          >
            <Plus size={14} aria-hidden="true" />
            <span style={s('font-size: 12.5px;')}>{t('deploiements.add_integration')}</span>
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
    <div>
      <EnTete onOpenPreferences={onOpenPreferences} />
      <div style={s('display: flex; flex-direction: column; gap: 8px; padding: 14px 0 0;')}>
        {integrations.map(integ => {
          const status = statuses[integ.id]
          const etat = status?.state ?? 'unknown'
          const deployments = status?.deployments

          return (
            <div
              key={integ.id}
              style={s('border: 1px solid var(--color-border-card); border-radius: 8px; background: var(--color-surface-card); padding: 11px 12px;')}
            >
              <div style={s('display: flex; align-items: flex-start; gap: 10px;')}>
                <span
                  style={s(
                    `width: 7px; height: 7px; border-radius: 50%; flex: none; margin-top: 4px; background: ${DOT_ETAT[etat]};`,
                  )}
                />
                <div style={s('flex: 1; min-width: 0;')}>
                  <div style={s('font-size: 12.5px; color: var(--color-text);')}>
                    {integ.label} · {integ.provider}
                  </div>
                  <div
                    style={s(
                      'font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-discrete); margin-top: 2px;',
                    )}
                  >
                    {status ? t(ETAT_LABEL[etat]) : t('deploiements.never_checked')}
                    {status?.detail ? ` · ${status.detail}` : ''}
                  </div>
                </div>
                {integ.url && (
                  <a
                    href={integ.url}
                    target="_blank"
                    rel="noreferrer"
                    title={integ.url}
                    style={s('flex: none; display: block; color: var(--color-text-quaternary);')}
                  >
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                )}
              </div>

              {deployments?.length ? (
                <div style={s('margin-top: 6px;')}>
                  {deployments.map(d => (
                    <LigneDeploiement key={d.id} d={d} />
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                style={s(
                  'cursor: pointer; font-size: 10.5px; padding: 3px 8px; margin-top: 8px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-secondary);',
                )}
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

/** En-tête fixe — maquette : "Déploiements" + lien "Configurer", 38px, séparateur bas. */
function EnTete({
  onOpenPreferences,
  onMasquer,
}: {
  onOpenPreferences: (opts?: { provider?: IntegrationProvider }) => void
  onMasquer?: () => void
}) {
  return (
    <div
      style={s(
        'height: 38px; flex: none; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-border-chrome);',
      )}
    >
      <div style={s('font-size: 12px; font-weight: 500; color: var(--color-text);')}>{t('deploiements.title')}</div>
      <div style={s('flex: 1;')} />
      {onMasquer && (
        <button
          type="button"
          onClick={onMasquer}
          style={s('cursor: pointer; border: 0; background: transparent; font-size: 11.5px; color: var(--color-text-quaternary);')}
        >
          {t('deploiements.hide')}
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpenPreferences()}
        style={s('cursor: pointer; border: 0; background: transparent; font-size: 11.5px; color: var(--color-text-quaternary);')}
      >
        {t('deploiements.configure')}
      </button>
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
  const style = s(LIGNE_STYLE + (d.url && survol ? ' background: var(--color-surface-hover);' : ''))
  const survolProps = d.url ? { onMouseEnter: () => setSurvol(true), onMouseLeave: () => setSurvol(false) } : {}

  const contenu = (
    <>
      <span
        style={s(
          `width: 6px; height: 6px; border-radius: 50%; flex: none; background: currentColor; ${ETAT_STYLE[d.state]}`,
        )}
      />
      <span
        className={`tag ${d.environment === 'Production' ? '' : 'tag-neutral'}`}
        style={s(
          `font-size: 9.5px; padding: 1px 7px;${
            d.environment === 'Production' ? ' color: var(--color-plan); background: var(--color-plan-bg); border: 1px solid var(--color-plan-border);' : ''
          }`,
        )}
      >
        {d.environment}
      </span>
      {d.commit && (
        <span style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-neutral-500);')}>
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
