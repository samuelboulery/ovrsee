import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extraitDePage, sanitizePageCapture } from './index.js'

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

// --- l'extrait d'une page (T-0294) ----------------------------------------

test('l’extrait préfère la description de la page', () => {
  assert.equal(
    extraitDePage({ description: ' Suivi de projet. ', h1: 'Accueil', p: 'Bonjour', main: 'x', texte: 'tout' }),
    'Suivi de projet.',
  )
})

test('sans description, le titre et le premier paragraphe', () => {
  assert.equal(extraitDePage({ description: '', h1: 'Accueil', p: 'Bonjour', main: 'x', texte: 'tout' }), 'Accueil\nBonjour')
  assert.equal(extraitDePage({ h1: 'Accueil', texte: 'tout' }), 'Accueil')
})

test('sans rien de tout ça, le contenu principal plutôt que la page entière', () => {
  assert.equal(extraitDePage({ main: ' Contenu ', texte: 'Rechercher… ⌘K VUES 7' }), 'Contenu')
  assert.equal(extraitDePage({ texte: 'Rechercher… ⌘K VUES 7' }), 'Rechercher… ⌘K VUES 7')
  assert.equal(extraitDePage({}), '')
})
