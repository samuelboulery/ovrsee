/**
 * Le bloc « Intégrations » de la section Projet des préférences.
 *
 * Ajouter, éditer ou supprimer une intégration passe par
 * `window.ovrsee.integrations` (IPC Electron), jamais par `/api/*` : un jeton
 * ne doit jamais transiter par le dev server HTTP local. Voir le corollaire
 * dans `CLAUDE.md` et `electron/preload.cjs`.
 *
 * Sans projet ouvert ou hors de l'app Electron, le bloc l'affiche franchement
 * plutôt que de proposer un formulaire qui ne peut rien enregistrer.
 */

import { useState } from 'react'

import type { Integration, IntegrationProvider } from './data'
import { t, type TranslationKey } from './i18n'
import { ErrorBox, Field } from './PreferencesControls'
import { s } from './style'
import type { IntegrationsBridge } from './useTerminal'

/**
 * Lu directement sur `window`, sans importer `useTerminal.ts` : ce module
 * charge `@xterm/xterm` (et sa feuille de style), absent du rendu serveur des
 * tests (`prefs.test.tsx`). Seul le *type* du pont est importé — effacé à la
 * compilation.
 */
const bridge = (): IntegrationsBridge | null => {
  if (typeof window === 'undefined') return null
  return window.ovrsee?.integrations ?? null
}

const PROVIDERS: Array<[IntegrationProvider, string]> = [
  ['vercel', 'Vercel'],
  ['netlify', 'Netlify'],
  ['supabase', 'Supabase'],
  ['autre', 'Autre'],
]

/**
 * L'URL demandée n'est pas décorative : `hooks/integrationProviders.js` y
 * extrait l'identifiant du projet/site pour appeler l'API du fournisseur
 * (nom de projet Vercel, site Netlify, ref Supabase). L'exemple doit donc
 * coller exactement à la forme attendue, pas à un fournisseur générique.
 */
const URL_HINT: Record<IntegrationProvider, TranslationKey> = {
  vercel: 'pref.integrations_url_hint_vercel',
  netlify: 'pref.integrations_url_hint_netlify',
  supabase: 'pref.integrations_url_hint_supabase',
  autre: 'pref.integrations_url_hint_autre',
}

/**
 * Le jeton, lui, n'a pas qu'une forme — pour Supabase en particulier, la clé
 * `anon`/`service_role` du projet (très visible dans Project Settings → API)
 * n'est pas ce qu'attend l'API Management appelée pour lire le statut. Un
 * mauvais choix ici échoue silencieusement côté utilisateur, d'où l'avertissement
 * explicite plutôt qu'un simple « Jeton API ».
 */
const TOKEN_HINT: Record<IntegrationProvider, TranslationKey> = {
  vercel: 'pref.integrations_token_hint_vercel',
  netlify: 'pref.integrations_token_hint_netlify',
  supabase: 'pref.integrations_token_hint_supabase',
  autre: 'pref.integrations_token_hint_autre',
}

const TOKEN_HELP_URL: Record<IntegrationProvider, string | null> = {
  vercel: 'https://vercel.com/account/tokens',
  netlify: 'https://app.netlify.com/user/applications#personal-access-tokens',
  supabase: 'https://supabase.com/dashboard/account/tokens',
  autre: null,
}

export function BlocIntegrations({
  root,
  integrations: initiales,
  initialProvider,
}: {
  root?: string
  integrations: Integration[]
  /** Présélectionné quand on arrive du CTA « Ajouter » de la carte Déploiements de l'Aperçu. */
  initialProvider?: IntegrationProvider
}) {
  const [integrations, setIntegrations] = useState(initiales)
  const [provider, setProvider] = useState<IntegrationProvider>(initialProvider ?? 'vercel')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [edite, setEdite] = useState<string | null>(null)
  const [erreur, setErreur] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  const ovrsee = bridge()

  if (!root) {
    return (
      <p style={s('margin: 0; font-size: 12px; color: var(--color-neutral-600);')}>
        {t('pref.integrations_no_project')}
      </p>
    )
  }

  if (!ovrsee) {
    return (
      <p style={s('margin: 0; font-size: 12px; color: var(--color-neutral-600);')}>
        {t('deploiements.electron_only')}
      </p>
    )
  }

  const reinitialiser = () => {
    setProvider('vercel')
    setLabel('')
    setUrl('')
    setToken('')
    setEdite(null)
    setErreur(null)
  }

  const soumettre = () => {
    if (!label.trim()) {
      setErreur('pref.err_label_required')
      return
    }
    setErreur(null)
    setBusy(true)
    ovrsee
      .save(root, {
        id: edite ?? undefined,
        provider,
        label: label.trim(),
        url: url.trim() || undefined,
        token: token.trim() || undefined,
      })
      .then(result => {
        if ('error' in result) {
          setErreur('pref.integrations_error')
          return
        }
        setIntegrations(result)
        reinitialiser()
      })
      .finally(() => setBusy(false))
  }

  const supprimer = (id: string) => {
    setBusy(true)
    ovrsee
      .remove(root, id)
      .then(setIntegrations)
      .finally(() => setBusy(false))
  }

  return (
    <>
      <p style={s('margin: 0 0 14px; font-size: 12px; color: var(--color-neutral-500);')}>
        {t('pref.integrations_desc')}
      </p>

      <div
        style={s(
          'display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--color-divider); border-radius: 8px;',
        )}
      >
        <Field label={t('pref.integrations_provider')}>
          <select
            className="input"
            value={provider}
            onChange={event => setProvider(event.target.value as IntegrationProvider)}
            style={s('width: auto; min-height: 32px; font-size: 13px;')}
          >
            {PROVIDERS.map(([valeur, nom]) => (
              <option key={valeur} value={valeur}>
                {nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('pref.integrations_label')}>
          <input
            className="input"
            type="text"
            value={label}
            onChange={event => setLabel(event.target.value)}
            maxLength={50}
            style={s('font-size: 13px; min-height: 32px;')}
          />
        </Field>
        <Field label={t('pref.integrations_url')} hint={t(URL_HINT[provider])}>
          <input
            className="input"
            type="text"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://…"
            style={s('font-size: 13px; min-height: 32px; font-family: var(--font-mono);')}
          />
        </Field>
        <Field
          label={t('pref.integrations_token')}
          hint={
            <>
              {t(TOKEN_HINT[provider])}
              {TOKEN_HELP_URL[provider] && (
                <>
                  {' '}
                  <a
                    href={TOKEN_HELP_URL[provider]!}
                    target="_blank"
                    rel="noreferrer"
                    style={s('color: var(--color-accent);')}
                  >
                    {t('pref.integrations_token_create_link', {
                      provider: PROVIDERS.find(([valeur]) => valeur === provider)?.[1] ?? '',
                    })}
                  </a>
                </>
              )}
              {edite !== null && <> · {t('pref.integrations_token_hint_edit')}</>}
            </>
          }
        >
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={token}
            onChange={event => setToken(event.target.value)}
            style={s('font-size: 13px; min-height: 32px;')}
          />
        </Field>

        {erreur && <ErrorBox>{t(erreur)}</ErrorBox>}

        <div style={s('display: flex; gap: 8px;')}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={soumettre}>
            {edite === null ? t('pref.integrations_add') : t('pref.integrations_update')}
          </button>
          {edite !== null && (
            <button type="button" className="btn btn-ghost" onClick={reinitialiser}>
              {t('pref.actions_cancel')}
            </button>
          )}
        </div>
      </div>

      {integrations.length === 0 && (
        <p style={s('margin: 14px 0 0; font-size: 12px; color: var(--color-neutral-600);')}>
          {t('pref.integrations_empty')}
        </p>
      )}

      <div style={s('margin-top: 12px; display: flex; flex-direction: column; gap: 6px;')}>
        {integrations.map(integ => (
          <div
            key={integ.id}
            style={s(
              'display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; background: var(--theme-bg-tertiary);',
            )}
          >
            <div style={s('flex: 1; min-width: 0;')}>
              <div style={s('font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
                {integ.label}{' '}
                <span style={s('color: var(--color-neutral-600);')}>· {integ.provider}</span>
              </div>
              {integ.url && (
                <div
                  style={s(
                    'font-size: 11px; color: var(--color-neutral-600); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                  )}
                >
                  {integ.url}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`${t('pref.actions_edit')} — ${integ.label}`}
              onClick={() => {
                setEdite(integ.id)
                setProvider(integ.provider)
                setLabel(integ.label)
                setUrl(integ.url ?? '')
                setToken('')
                setErreur(null)
              }}
              style={s('font-size: 12px; padding: 2px 7px;')}
            >
              ✎
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`${t('pref.actions_delete')} — ${integ.label}`}
              onClick={() => supprimer(integ.id)}
              style={s('font-size: 12px; padding: 2px 7px;')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
