import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

/**
 * Le garde-fou des couleurs hors du chantier de portage littéral.
 *
 * Ce test interdisait toute couleur en dur pour qu'un thème clair puisse
 * exister à côté du sombre — raison retirée par T-0075 (thème clair supprimé,
 * pas de maquette claire). T-0074 a ensuite tranché : plutôt que de corriger
 * les jetons `--color-accent-800/900` un par un (la cause du bug de contraste
 * violet signalé sur 8 captures), le châssis et l'Aperçu portent désormais
 * littéralement les valeurs hex de `Ovrsee App.dc.html`, comme la maquette
 * elle-même le fait — sans variable CSS.
 *
 * Le garde-fou reste utile ailleurs : `app/src` a des onglets qui partagent le
 * même bug de jetons et n'ont pas encore été portés (chantier 2). Sans lui, une
 * couleur en dur qui n'est pas un portage délibéré y passerait inaperçue.
 *
 * Il vit dans `hooks/` et non dans `app/src` parce que `app/src` est compilé
 * sans les types Node : y lire des fichiers demanderait une dépendance de types
 * pour du code qui ne tourne que dans un navigateur.
 */
const EXCEPTIONS = new Set([
  '#7d76f0', // marque
  '#8682cf', // marque, tracé du graphe
  '#ffffff', // fond du webview Chromium, qui n'est pas l'ovrsee
  '#fff',
  '#000', // mask-image
])

// Fichiers portés littéralement depuis la maquette (T-0074, T-0076, T-0079) :
// leurs couleurs sont un choix délibéré, pas une dérive — jamais pour
// contourner le garde-fou ailleurs.
const FICHIERS_PORTES = new Set([
  'App.tsx',
  'Terminal.tsx',
  'Apercu.tsx',
  'Sante.tsx',
  'Deploiements.tsx',
  'Branches.tsx',
  'Illisibles.tsx',
  'Produit.tsx',
  'Historique.tsx',
  'Navigateur.tsx',
  'Onboarding.tsx',
  'OnboardingArt.tsx',
  'PreferencesControls.tsx',
  'SkillsPanel.tsx',
  'Environnements.tsx',
  'Donnees.tsx',
  'ActivityPanel.tsx',
  'Tableau.tsx',
])

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')

const sources = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dir, entree.name)
    if (entree.isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(entree.name) || entree.name.includes('.test.')) return []
    return [chemin]
  })

test('aucune couleur en dur dans app/src, hors exceptions et fichiers portés', () => {
  const fautifs = []

  for (const fichier of sources(join(racine, 'app', 'src'))) {
    // `theme.ts` est le seul endroit où les couleurs s'écrivent.
    if (fichier.endsWith('theme.ts')) continue
    if (FICHIERS_PORTES.has(fichier.split('/').pop())) continue

    readFileSync(fichier, 'utf8')
      .split('\n')
      .forEach((ligne, i) => {
        for (const trouve of ligne.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
          if (EXCEPTIONS.has(trouve.toLowerCase())) continue
          fautifs.push(`${fichier.slice(racine.length + 1)}:${i + 1} ${trouve}`)
        }
      })
  }

  assert.deepEqual(fautifs, [], 'ces couleurs doivent passer par un jeton de theme.ts')
})
