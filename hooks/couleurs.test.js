import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

/**
 * Le garde-fou du thème clair.
 *
 * Les couleurs de `app/src` ont été remplacées une à une par des jetons pour
 * qu'un thème puisse exister. Sans ce test, la prochaine écrite en dur repasse
 * inaperçue et le travail se défait un composant à la fois.
 *
 * Il vit dans `hooks/` et non dans `app/src` parce que `app/src` est compilé
 * sans les types Node : y lire des fichiers demanderait une dépendance de types
 * pour du code qui ne tourne que dans un navigateur.
 *
 * Les exceptions sont nommées. Une couleur qui ne dépend pas du thème — une
 * couleur de marque, le fond du webview Chromium, un masque CSS — a le droit
 * d'exister, à condition qu'on l'ait dit ici.
 */
const EXCEPTIONS = new Set([
  '#9184d9', // marque
  '#796cbf', // marque, tracé du graphe
  '#ffffff', // fond du webview Chromium, qui n'est pas l'ovrsee
  '#fff',
  '#000', // mask-image
])

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')

const sources = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dir, entree.name)
    if (entree.isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(entree.name) || entree.name.includes('.test.')) return []
    return [chemin]
  })

test('aucune couleur en dur dans app/src, hors exceptions déclarées', () => {
  const fautifs = []

  for (const fichier of sources(join(racine, 'app', 'src'))) {
    // `theme.ts` est le seul endroit où les couleurs s'écrivent.
    if (fichier.endsWith('theme.ts')) continue

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
