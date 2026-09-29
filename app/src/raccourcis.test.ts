import assert from 'node:assert/strict'
import test from 'node:test'

import { estMac, raccourci, setPlateforme, toucheMod } from './raccourcis'

/**
 * L'écriture des raccourcis, par plateforme.
 *
 * Ce test existe parce que l'interface les rendait en glyphes Apple codés en
 * dur — `⌘K`, `⇧⌘E`, `⌘⇧C` — jusque dans l'application Windows, où ⌘ ne
 * désigne aucune touche du clavier.
 *
 * Chaque cas épingle sa plateforme. La détection lit `navigator.platform`, un
 * global que Node ≥ 21 définit avec l'OS de la machine : sans épingle, ces
 * assertions dépendraient du poste qui les joue.
 */

/** `[appel, attendu sur macOS, attendu ailleurs]` */
const CAS: Array<[Array<string | number>, string, string]> = [
  [['K'], '⌘K', 'Ctrl+K'],
  [[','], '⌘,', 'Ctrl+,'],
  [['O'], '⌘O', 'Ctrl+O'],
  [[3], '⌘3', 'Ctrl+3'],
  [['shift', 'E'], '⇧⌘E', 'Ctrl+Shift+E'],
  [['shift', 'C'], '⇧⌘C', 'Ctrl+Shift+C'],
  [['shift', 7], '⇧⌘7', 'Ctrl+Shift+7'],
  [['alt', 1], '⌥⌘1', 'Ctrl+Alt+1'],
  // L'ordre des modificateurs est normalisé, pas repris de l'appelant : macOS
  // écrit `⌃⌥⇧⌘`, et le code portait les deux formes — `⇧⌘E` dans l'onglet
  // Navigateur, `⌘⇧C` dans l'Aperçu.
  [['shift', 'alt', 'E'], '⌥⇧⌘E', 'Ctrl+Alt+Shift+E'],
]

test('raccourci : les glyphes Apple sur macOS', () => {
  setPlateforme('mac')
  for (const [touches, attendu] of CAS) {
    assert.equal(raccourci(...touches), attendu, `raccourci(${JSON.stringify(touches)})`)
  }
})

test('raccourci : les mots Windows ailleurs', () => {
  setPlateforme('autre')
  for (const [touches, , attendu] of CAS) {
    assert.equal(raccourci(...touches), attendu, `raccourci(${JSON.stringify(touches)})`)
  }
})

test('toucheMod : la modificatrice seule, pour une phrase', () => {
  setPlateforme('mac')
  assert.equal(toucheMod(), '⌘')
  setPlateforme('autre')
  assert.equal(toucheMod(), 'Ctrl')
})

test('setPlateforme(null) rend la main à la détection', () => {
  setPlateforme('mac')
  assert.equal(estMac(), true)
  setPlateforme(null)
  // Ce que la détection répond dépend de la machine — on vérifie seulement
  // qu'elle répond, et sans lever là où `navigator` manque.
  assert.equal(typeof estMac(), 'boolean')
})

test('une valeur inconnue vaut une épingle absente', () => {
  setPlateforme('mac')
  setPlateforme('windows' as unknown as 'autre')
  assert.equal(typeof estMac(), 'boolean')
})
