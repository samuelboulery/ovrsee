import assert from 'node:assert/strict'
import test from 'node:test'

import { darkTheme, lightTheme } from './theme'

/**
 * `_ds/ovrsee/styles.css` EST le thème sombre (système Ovrsee, T-0045).
 *
 * Une version de ce module recopiait les quatre-vingt-dix jetons du design
 * system pour les « thématiser », et l'accent changeait de teinte au
 * passage : l'apparence par défaut changeait sans que personne l'ait
 * demandé. Ces valeurs sont donc gardées sous surveillance.
 */
test('la palette sombre garde les valeurs de la maquette', () => {
  assert.equal(darkTheme.bgPrimary, '#0b0c0e', 'fond des panneaux')
  assert.equal(darkTheme.xtermCursor, '#7d76f0', 'le curseur porte la couleur de marque')
})

test('les deux palettes diffèrent sur tous les fonds', () => {
  for (const clef of ['bgPrimary', 'bgSecondary', 'bgTertiary', 'bgLightbox'] as const) {
    assert.notEqual(darkTheme[clef], lightTheme[clef], `${clef} devrait changer avec le thème`)
  }
})

/**
 * Un texte prévu pour un fond sombre reste illisible sur du blanc : le premier
 * plan du terminal doit s'inverser, pas seulement son fond.
 */
test('le terminal inverse fond et texte, pas seulement le fond', () => {
  assert.notEqual(darkTheme.xtermBg, lightTheme.xtermBg)
  assert.notEqual(darkTheme.xtermFg, lightTheme.xtermFg)
})
