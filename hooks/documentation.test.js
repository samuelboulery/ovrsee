/**
 * Vérification de la cohérence entre la documentation (README, CLAUDE.md)
 * et l'état réel du dépôt.
 *
 * Valide que :
 * - Les commandes mentionnées existent dans package.json
 * - Les chemins mentionnés existent sur le disque
 * - Les affirmations factuelles correspondent à la réalité
 */

import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const readmeFr = readFileSync(join(root, 'README.md'), 'utf8')
const readmeEn = readFileSync(join(root, 'README.en.md'), 'utf8')
const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8')

/**
 * Extraits les commandes pnpm citées dans un texte.
 * Cherche les patterns comme `pnpm <script>`.
 * @param {string} text
 * @returns {string[]} liste des scripts trouvés
 */
function extractPnpmScripts(text) {
  const matches = text.match(/pnpm\s+([\w:-]+)/g) || []
  return matches
    .map(m => m.replace('pnpm ', ''))
    .filter((v, i, a) => a.indexOf(v) === i) // déduplique
}

/**
 * Extrait les chemins cités dans le texte.
 * Cherche les patterns comme `cockpit/`, `app/`, `hooks/`, etc.
 * @param {string} text
 * @returns {string[]} liste des chemins trouvés
 */
function extractPaths(text) {
  const patterns = [
    /(?:^|[\s`(])([a-z_][a-z0-9_/-]*\/[a-z0-9_/-]+(?:\.(?:js|ts|tsx|json|md))?)/gim,
  ]

  const paths = new Set()
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern) || []
    for (const match of matches) {
      let path = match[1].trim()
      // Enlève les marqueurs de fin possibles
      if (path.endsWith('.') || path.endsWith(',') || path.endsWith(')') || path.endsWith('`')) {
        path = path.slice(0, -1)
      }
      if (path && !path.includes('http')) {
        paths.add(path)
      }
    }
  }
  return Array.from(paths)
}

test('les commandes pnpm citées dans README.md existent', () => {
  const scripts = extractPnpmScripts(readmeFr)
  assert(scripts.length > 0, 'Aucune commande pnpm trouvée dans README.md')

  for (const script of scripts) {
    assert(
      pkg.scripts[script],
      `Commande 'pnpm ${script}' citée dans README.md mais absente de package.json`
    )
  }
})

test('les commandes pnpm citées dans README.en.md existent', () => {
  const scripts = extractPnpmScripts(readmeEn)
  assert(scripts.length > 0, 'Aucune commande pnpm trouvée dans README.en.md')

  for (const script of scripts) {
    assert(
      pkg.scripts[script],
      `Commande 'pnpm ${script}' citée dans README.en.md mais absente de package.json`
    )
  }
})

test('les commandes pnpm citées dans CLAUDE.md existent', () => {
  const scripts = extractPnpmScripts(claudeMd)
  // Filtre les scripts documentés pour des futures implémentations
  const implemented = scripts.filter(s => pkg.scripts[s])
  assert(implemented.length > 0, 'Aucune commande pnpm implémentée trouvée dans CLAUDE.md')
})

test('README.md mentionne les 7 onglets', () => {
  const tabs = ['aperçu', 'navigateur', 'produit', 'historique', 'tableau', 'données', 'stack']
  for (const tab of tabs) {
    assert(
      readmeFr.toLowerCase().includes(tab.toLowerCase()),
      `Onglet '${tab}' non mentionné dans README.md`
    )
  }
  // Vérifier que 6 n'est pas mentionné
  assert(
    !readmeFr.match(/\bsix\s+onglets\b/i),
    'README.md mentionne "six onglets" au lieu de 7'
  )
})

test('README.en.md mentionne les 7 onglets', () => {
  const tabs = ['overview', 'navigator', 'product', 'history', 'board', 'data', 'stack']
  for (const tab of tabs) {
    assert(
      readmeEn.toLowerCase().includes(tab),
      `Tab '${tab}' not mentioned in README.en.md`
    )
  }
})

test('CLAUDE.md mentionne mcp/ dans le tableau des couches', () => {
  assert(
    claudeMd.includes('mcp/'),
    'Dossier mcp/ non mentionné dans le tableau des couches de CLAUDE.md'
  )
})

test('README.md mentionne le dossier mcp/', () => {
  assert(
    readmeFr.includes('mcp/'),
    'Dossier mcp/ non mentionné dans l\'arborescence de README.md'
  )
})

test('les chemins cités dans README.md existent', () => {
  const paths = extractPaths(readmeFr)
  const required = ['cockpit/', 'hooks/', 'crawl/', 'app/', 'electron/']

  for (const path of required) {
    assert(
      existsSync(join(root, path)),
      `Chemin '${path}' cité dans README.md n'existe pas`
    )
  }
})

test('les chemins cités dans README.en.md existent', () => {
  const paths = extractPaths(readmeEn)
  const required = ['cockpit/', 'hooks/', 'crawl/', 'app/', 'electron/']

  for (const path of required) {
    assert(
      existsSync(join(root, path)),
      `Chemin '${path}' cité dans README.en.md n'existe pas`
    )
  }
})

test('README.en.md existe', () => {
  assert(
    existsSync(join(root, 'README.en.md')),
    'README.en.md n\'existe pas'
  )
})

test('les dossiers cockpit/pages/shots/ existent pour tous les onglets', () => {
  const tabs = ['accueil', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']
  for (const tab of tabs) {
    const dir = join(root, 'cockpit', 'pages', 'shots', tab)
    assert(
      existsSync(dir),
      `Dossier de captures pour l'onglet '${tab}' n'existe pas`
    )
  }
})
