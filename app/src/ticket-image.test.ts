import test from 'node:test'
import assert from 'node:assert/strict'

import { insererImage, MAX_COTE } from './ticket-image'

test('insererImage pose le markdown au curseur et rend la position suivante', () => {
  const { texte, curseur } = insererImage('avant après', 'ovrsee/tickets/images/T-1-ab.webp', 6, 6)

  assert.equal(texte, 'avant ![](ovrsee/tickets/images/T-1-ab.webp)après')
  // Le curseur se pose derrière l'image, prêt pour la suite de la phrase.
  assert.equal(curseur, texte.indexOf('après'))
})

test('insererImage remplace la sélection au lieu de s’ajouter à elle', () => {
  const { texte } = insererImage('garde ceci pas cela', 'x.webp', 6, 19)

  assert.equal(texte, 'garde ![](x.webp)')
})

test('insererImage sur un corps vide ne laisse pas d’espace de tête', () => {
  const { texte } = insererImage('', 'x.webp', 0, 0)

  assert.equal(texte, '![](x.webp)')
})

test('insererImage n’ajoute aucune mise en forme : le curseur fait foi', () => {
  // `media()` rend une image en inline — coller en fin de phrase ne demande
  // pas de saut de ligne, et en ajouter un couperait une phrase entamée.
  assert.equal(insererImage('Un bug.', 'x.webp', 7, 7).texte, 'Un bug.![](x.webp)')
  assert.equal(insererImage('Un bug.\n\n', 'x.webp', 9, 9).texte, 'Un bug.\n\n![](x.webp)')
})

test('MAX_COTE reste sous ce que le serveur accepte', () => {
  // Une garde de cohérence : le ré-encodage existe pour tenir sous
  // IMAGE_MAX_OCTETS (700 ko) côté serveur, lui-même sous CORPS_MAX.
  assert.ok(MAX_COTE > 0 && MAX_COTE <= 2048)
})
