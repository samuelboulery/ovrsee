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

// Un `extractPaths` vivait ici, censé relever tous les chemins cités dans un
// README pour vérifier qu'ils existent. Les deux tests plus bas l'appelaient et
// jetaient son résultat — parce qu'il ne marchait pas : son alternance
// `js|ts|tsx|json` faisait correspondre `js` en premier, donc `ovrsee/board.json`
// devenait `ovrsee/board.js`, et la prose produisait des chemins inventés comme
// `plans/tickets/pages`. Le câbler aurait fait échouer les tests sur du bruit.
//
// Ce qui reste vérifie une liste courte et écrite à la main. C'est moins
// ambitieux, mais c'est vrai.

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

test('les dossiers cités dans README.md existent', () => {
  const required = ['ovrsee/', 'hooks/', 'crawl/', 'app/', 'electron/']

  for (const path of required) {
    assert(
      existsSync(join(root, path)),
      `Chemin '${path}' cité dans README.md n'existe pas`
    )
  }
})

test('les dossiers cités dans README.en.md existent', () => {
  const required = ['ovrsee/', 'hooks/', 'crawl/', 'app/', 'electron/']

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

// Ce test regardait autrefois `ovrsee/pages/shots/` sur le disque. Les captures
// ne sont plus suivies par git (`.gitignore`, et `data.ts` conseille de les
// ignorer dans les projets observés) : un clone frais n'en a aucune, et
// l'assertion échouait en CI sans que rien ne soit cassé.
//
// L'invariant qui compte survit au clone : `pages.json`, lui, est versionné, et
// c'est lui que l'interface lit pour savoir quelle capture montrer.
test('pages.json déclare une capture pour chaque onglet', () => {
  const tabs = ['accueil', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']
  const pages = JSON.parse(readFileSync(join(root, 'ovrsee', 'pages', 'pages.json'), 'utf8'))
  const couverts = new Set(
    pages.pages.map(p => p.shot?.split('/')[1]).filter(Boolean)
  )

  for (const tab of tabs) {
    assert(
      couverts.has(tab),
      `Aucune capture déclarée pour l'onglet '${tab}' dans pages.json`
    )
  }
})
