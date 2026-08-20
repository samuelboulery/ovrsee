/**
 * Le formulaire de configuration du crawl, partagé.
 *
 * Deux endroits l'ouvrent, et il n'y a qu'un seul `ovrsee.config.json` : le
 * panneau d'équipement, sur un projet neuf, et l'onglet Produit, sur un projet
 * déjà équipé mais sans configuration — cas qui n'avait aucun chemin avant, et
 * dont le crawl se plaignait à chaque tentative sans que rien ne le propose.
 *
 * Écrire le fichier passe par l'action `init` de `/api/projects`, comme
 * l'équipement : `install()` est idempotent et n'écrase jamais une
 * configuration existante, donc l'appeler sur un projet déjà équipé ne réécrit
 * ni les hooks ni le tableau.
 */

import { useEffect, useState } from 'react'

import { getFolderState, projectAction } from './data'
import { t } from './i18n'
import { s } from './style'

/** Un champ texte du formulaire de configuration. */
export function Champ({
  id,
  label,
  valeur,
  onValeur,
}: {
  id: string
  label: string
  valeur: string
  onValeur: (valeur: string) => void
}) {
  return (
    <label htmlFor={id} style={s('display: block; margin-top: 8px;')}>
      <span style={s('display: block; font-size: 11px; color: var(--color-neutral-500);')}>
        {label}
      </span>
      <input
        id={id}
        type="text"
        className="input"
        value={valeur}
        onChange={event => onValeur(event.target.value)}
        spellCheck={false}
        style={s('margin-top: 4px; font-family: var(--font-mono); font-size: 12px;')}
      />
    </label>
  )
}

/**
 * Les deux champs, sans carte ni bouton : le panneau d'équipement les pose
 * dans sa propre option à cocher, l'onglet Produit dans sa propre carte.
 */
export function ChampsCrawl({
  dev,
  baseUrl,
  onDev,
  onBaseUrl,
  prefixe = 'champ',
}: {
  dev: string
  baseUrl: string
  onDev: (valeur: string) => void
  onBaseUrl: (valeur: string) => void
  prefixe?: string
}) {
  return (
    <>
      <Champ id={`${prefixe}-dev`} label={t('equipment.field_dev')} valeur={dev} onValeur={onDev} />
      <Champ
        id={`${prefixe}-base-url`}
        label={t('equipment.field_base_url')}
        valeur={baseUrl}
        onValeur={onBaseUrl}
      />
    </>
  )
}

/**
 * Le formulaire complet, pour un projet déjà équipé : les deux champs
 * pré-remplis par la détection du serveur, et le bouton qui écrit.
 */
export function ConfigCrawl({
  root,
  onEcrit,
}: {
  root: string
  onEcrit: () => void
}) {
  const [dev, setDev] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Les mêmes propositions que le panneau d'équipement — c'est le serveur qui
  // les détecte, en lisant les scripts du projet.
  useEffect(() => {
    let vivant = true
    getFolderState(root)
      .then(etat => {
        if (!vivant) return
        setDev(etat.defaults.dev)
        setBaseUrl(etat.defaults.baseUrl)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [root])

  const ecrire = () => {
    setBusy(true)
    setErreur(null)
    projectAction('init', root, { config: { dev, baseUrl } })
      .then(onEcrit)
      .catch(err => setErreur(String(err.message ?? err)))
      .finally(() => setBusy(false))
  }

  const pret = dev.trim() !== '' && baseUrl.trim().startsWith('http')

  return (
    <div
      style={s(
        'width: min(420px, 100%); padding: 14px; background: var(--color-surface-card); border: 1px solid var(--color-divider); border-radius: 6px; text-align: left;',
      )}
    >
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
        )}
      >
        {t('equipment.opt_config')}
      </div>
      <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 6px;')}>
        {t('equipment.config_crawl_note')}
      </div>

      <ChampsCrawl
        prefixe="produit-config"
        dev={dev}
        baseUrl={baseUrl}
        onDev={setDev}
        onBaseUrl={setBaseUrl}
      />

      {erreur && (
        <div style={s('font-size: 11px; color: var(--color-danger); margin-top: 8px;')}>{erreur}</div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !pret}
        onClick={ecrire}
        style={s('margin-top: 12px; width: 100%; font-size: 12px;')}
      >
        {busy ? t('produit.config_writing') : t('produit.config_write')}
      </button>
    </div>
  )
}
