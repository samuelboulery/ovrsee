import assert from 'node:assert/strict'
import test from 'node:test'

import { darkTheme } from './theme'

/**
 * `_ds/ovrsee/styles.css` EST le thème sombre (système Ovrsee, T-0045).
 * Seul thème pour l'instant (T-0075) — pas de maquette claire.
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
