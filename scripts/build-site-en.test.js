import { test } from 'node:test'
import assert from 'node:assert/strict'

import { construire, sources, traduire } from './build-site-en.js'

const { html, dict } = sources()
const en = construire(html, dict)

test('la page générée se déclare anglaise et canonique sous /en/', () => {
  assert.match(en, /<html lang="en">/)
  assert.match(en, /<link rel="canonical" href="https:\/\/ovrsee\.app\/en\/">/)
  assert.match(en, /<meta property="og:url" content="https:\/\/ovrsee\.app\/en\/">/)
  assert.match(en, /<meta property="og:locale" content="en_US">/)
})

test('les deux versions se citent mutuellement', () => {
  for (const page of [html, en]) {
    assert.match(page, /<link rel="alternate" hreflang="fr" href="https:\/\/ovrsee\.app\/">/)
    assert.match(page, /<link rel="alternate" hreflang="en" href="https:\/\/ovrsee\.app\/en\/">/)
    assert.match(page, /<link rel="alternate" hreflang="x-default" href="https:\/\/ovrsee\.app\/">/)
  }
})

test('le titre principal est traduit', () => {
  assert.match(en, /<h1[^>]*>Vibecode fast,/)
  assert.ok(!en.includes('Vibecoder vite,'), 'le titre français subsiste')
})

// Le vrai critère : plus rien de traduisible. Si `traduire()` a encore quelque chose à
// faire sur sa propre sortie, c'est qu'une chaîne française est passée à travers.
test('aucune chaîne du dictionnaire ne reste à traduire', () => {
  assert.equal(traduire(en, dict), en)
})

test('la source française n’est pas modifiée', () => {
  assert.match(html, /<html lang="fr">/)
  assert.match(html, /<link rel="canonical" href="https:\/\/ovrsee\.app\/">/)
})

// Les chemins d'assets doivent être absolus, sinon `/en/` les cherche sous `/en/`.
test('les assets sont référencés depuis la racine', () => {
  for (const chemin of ['/styles.css', '/app.js', '/favicon.svg', '/fonts/IBMPlexSans.woff2']) {
    assert.ok(en.includes(`"${chemin}"`), `chemin relatif restant : ${chemin}`)
  }
})

test('la bascule de langue est faite de liens, pas de gestionnaires', () => {
  assert.match(en, /<a href="\/" hreflang="fr"/)
  assert.match(en, /<a href="\/en\/" hreflang="en"/)
  assert.ok(!en.includes('pickFr'), 'la bascule JS subsiste')
})
