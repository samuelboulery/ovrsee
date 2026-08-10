/**
 * Intégrations déploiements et base de données, dans
 * `~/.claude/ovrsee/integrations.json`, clé par chemin de projet.
 *
 * Module pur : pas d'accès réseau, pas de chiffrement, pas de shell. Le
 * champ `tokenCipher` est un buffer base64 opaque pour ce module — le
 * chiffrer et le déchiffrer est la responsabilité du processus principal
 * Electron (`electron/main.js`), jamais de ce fichier.
 *
 * Jamais dans `<repo>/ovrsee/` : ce fichier est hors dépôt, jamais versionné.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

/** Les fournisseurs pris en charge en v1. */
export const PROVIDERS = ['vercel', 'netlify', 'supabase', 'autre']

/**
 * Chemin du fichier d'intégrations.
 *
 * `OVRSEE_INTEGRATIONS` env var pour les tests, même logique que
 * `settingsPath()` dans `settings.js`.
 */
export const integrationsPath = () =>
  process.env.OVRSEE_INTEGRATIONS ?? join(homedir(), '.claude', 'ovrsee', 'integrations.json')

/**
 * Lit tout le fichier. Un fichier absent ou corrompu rend un objet vide,
 * jamais une exception.
 *
 * @returns {Record<string, unknown>}
 */
function readAll() {
  try {
    const raw = readFileSync(integrationsPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Valide une entrée d'intégration. `id`, `provider` (connu) et `label`
 * (non vide) sont requis ; `url` et `tokenCipher`, s'ils sont présents,
 * doivent être des chaînes.
 *
 * @param {unknown} entry
 * @returns {boolean}
 */
function isValidIntegration(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
  if (typeof entry.id !== 'string' || !entry.id.trim()) return false
  if (!PROVIDERS.includes(entry.provider)) return false
  if (typeof entry.label !== 'string' || !entry.label.trim()) return false
  if (entry.url !== undefined && typeof entry.url !== 'string') return false
  if (entry.tokenCipher !== undefined && typeof entry.tokenCipher !== 'string') return false
  return true
}

/**
 * Valide une liste d'intégrations champ par champ : chaque entrée invalide
 * est rejetée individuellement, les valides sont conservées.
 *
 * @param {unknown} partial
 * @returns {Array<{id: string, provider: string, label: string, url?: string, tokenCipher?: string}>}
 */
export function validateIntegrationList(partial) {
  if (!Array.isArray(partial)) return []
  return partial.filter(isValidIntegration)
}

/**
 * Lit les intégrations d'un projet. Projet absent du fichier → liste vide.
 *
 * @param {string} root chemin du projet
 * @returns {Array<object>}
 */
export function readIntegrations(root) {
  const all = readAll()
  return validateIntegrationList(all[root])
}

/**
 * Écrit les intégrations d'un projet, en isolant les autres projets déjà
 * présents dans le fichier. Les entrées invalides sont rejetées avant
 * écriture.
 *
 * @param {string} root chemin du projet
 * @param {Array<object>} list intégrations à écrire
 */
export function writeIntegrations(root, list) {
  const all = readAll()
  const next = { ...all, [root]: validateIntegrationList(list) }
  const dir = join(integrationsPath(), '..')
  mkdirSync(dir, { recursive: true })
  writeFileSync(integrationsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8')
}
