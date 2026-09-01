import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

/**
 * Le garde-fou des couleurs écrites en dur.
 *
 * Il avait été posé pour qu'un thème clair puisse exister à côté du sombre,
 * raison retirée par T-0075 quand le clair a été supprimé. Elle est revenue
 * (T-0227) : c'est de nouveau ce test qui empêche le travail de se défaire un
 * composant à la fois.
 *
 * Deux choses ont changé avec lui en T-0230.
 *
 * Il ne connaissait que le hex, et laissait passer les quinze `rgba()` du
 * dossier — six voiles de modale recopiés à l'identique, cinq ombres, et les
 * seules couleurs de TEXTE en dur d'`app/src`, dans la lightbox. Toutes
 * fausses en clair, aucune vue par un test.
 *
 * Et sa liste d'exemptions a disparu. Elle nommait vingt fichiers « portés
 * littéralement depuis la maquette » (T-0074, T-0076, T-0079) ; à la fin du
 * chantier, dix-sept n'avaient plus une seule couleur littérale et restaient
 * dispensés du contrôle pour rien. Les trois derniers sont passés aux jetons.
 * Un portage littéral qui se représenterait rouvrirait la liste — mais il
 * faudra l'assumer, pas en hériter.
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

/**
 * Le seul fichier encore dispensé, et pour une raison qui n'est pas la
 * couleur : son style part dans le DOM de la PAGE OBSERVÉE, qui n'a pas notre
 * design system et ne lira jamais nos jetons. Une valeur littérale y est la
 * seule possible — choisie lisible sur une page claire comme sombre.
 */
const HORS_OVRSEE = new Set(['navigateur-webview.ts'])

/**
 * Ce qui compte comme une couleur écrite en dur.
 *
 * Le hex seul ne suffisait pas : `app/src` portait quinze `rgba()` — six
 * voiles de modale recopiés à l'identique, cinq ombres, et les seules couleurs
 * de texte en dur du dossier — qu'aucun test ne voyait passer. Un thème clair
 * les rendait toutes fausses (T-0230).
 */
const COULEUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')

const sources = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dir, entree.name)
    if (entree.isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(entree.name) || entree.name.includes('.test.')) return []
    return [chemin]
  })

test('aucune couleur en dur dans app/src, hors exceptions', () => {
  const fautifs = []

  for (const fichier of sources(join(racine, 'app', 'src'))) {
    // `theme.ts` est le seul endroit où les couleurs s'écrivent.
    if (fichier.endsWith('theme.ts')) continue
    // `basename` et non `split('/')` : sous Windows `join` rend des `\`, et le
    // découpage ne trouvait alors aucun fichier dispensé — tout le lot passait
    // pour fautif.
    if (HORS_OVRSEE.has(basename(fichier))) continue

    readFileSync(fichier, 'utf8')
      .split('\n')
      .forEach((ligne, i) => {
        for (const trouve of ligne.match(COULEUR) ?? []) {
          if (EXCEPTIONS.has(trouve.toLowerCase())) continue
          fautifs.push(`${fichier.slice(racine.length + 1)}:${i + 1} ${trouve}`)
        }
      })
  }

  assert.deepEqual(fautifs, [], 'ces couleurs doivent passer par un jeton du design system')
})
