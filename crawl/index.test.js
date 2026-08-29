import { test } from 'node:test'
import assert from 'node:assert/strict'

import { sanitizePageCapture } from './index.js'

// --- filtrage du titre et de l'extrait captés dans le DOM observé ----------

test('sanitizePageCapture masque un jeton sk-... dans le texte', () => {
  const { text } = sanitizePageCapture('Tableau de bord', 'Clé de test : sk-abcdefgh12345678')
  assert.ok(!text.includes('sk-abcdefgh12345678'), 'le jeton ne doit pas survivre')
  assert.match(text, /\*\*\*/)
})

test('sanitizePageCapture masque une affectation API_KEY=... dans le texte', () => {
  const { text } = sanitizePageCapture('Config', 'API_KEY=abcdef1234567890 pret')
  assert.ok(!text.includes('abcdef1234567890'), 'la valeur ne doit pas survivre')
  assert.match(text, /\*\*\*/)
})

test('sanitizePageCapture masque aussi un titre pollué', () => {
  const { title } = sanitizePageCapture('Erreur — API_KEY=abcdef1234567890', 'texte anodin')
  assert.ok(!title.includes('abcdef1234567890'), 'le titre ne doit pas porter le secret')
  assert.match(title, /\*\*\*/)
})

test('sanitizePageCapture tronque le texte à 400 caractères après filtrage', () => {
  const { text } = sanitizePageCapture('Titre', 'a'.repeat(500))
  assert.equal(text.length, 400)
})
