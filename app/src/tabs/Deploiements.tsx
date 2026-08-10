import { useState } from 'react'

import type { Integration, IntegrationState, IntegrationStatus } from '../data'
import { t, type TranslationKey } from '../i18n'
import { s } from '../style'
import type { IntegrationsBridge } from '../useTerminal'

const ETAT_STYLE: Record<IntegrationState, string> = {
  ok: 'color: var(--color-accent-200); border: 1px solid var(--color-accent-700);',
  error: 'color: var(--color-accent-300); border: 1px solid var(--color-accent-700);',
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

/**
 * Intégrations déploiements/base de données — Vercel, Netlify, Supabase,
 * autre. Aucun statut n'est vérifié au chargement : voir `Branches.tsx`,
 * même principe pour la même raison — un appel réseau silencieux à chaque
 * ouverture de l'onglet coûterait à qui a une connexion lente ou un jeton
 * proche de sa limite de requêtes.
 *
 * Ajouter, éditer ou supprimer une intégration se fait dans Préférences ;
 * cette carte n'affiche que ce qui est déjà configuré.
 */
export function Deploiements({ root, integrations }: { root: string; integrations: Integration[] }) {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [checking, setChecking] = useState<string | null>(null)
  const ovrsee = bridge()

  if (integrations.length === 0) return null

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

          return (
            <div key={integ.id} className="card" style={s('padding: 9px 12px; min-width: 190px;')}>
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
                  style={s('font-size: 11px; color: var(--color-accent-300); margin-top: 3px; display: block;')}
                >
                  {integ.url}
                </a>
              )}

              {status?.detail && (
                <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}>
                  {status.detail}
                </div>
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
