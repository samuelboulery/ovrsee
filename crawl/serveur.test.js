import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { memeServeur, titreHtml, titreServi } from './serveur.js'

// --- réutiliser le serveur déjà lancé (T-0281) -----------------------------

test('le titre se lit dans le HTML servi', () => {
  assert.equal(titreHtml('<html><head><title> Ovrsee </title></head></html>'), 'Ovrsee')
  assert.equal(titreHtml('<TITLE lang="fr">Mon app</TITLE>'), 'Mon app')
  assert.equal(titreHtml('<html></html>'), '')
})

test('même serveur seulement sur le même baseUrl et le même titre non vide', () => {
  const connu = { baseUrl: 'http://localhost:5180', titre: 'Ovrsee' }
  assert.equal(memeServeur(connu, 'http://localhost:5180', 'Ovrsee'), true)
  assert.equal(memeServeur(connu, 'http://localhost:5180', 'Autre'), false)
  assert.equal(memeServeur(connu, 'http://localhost:3000', 'Ovrsee'), false, 'un baseUrl changé ne réutilise rien')
  assert.equal(memeServeur({ baseUrl: 'http://localhost:5180', titre: '' }, 'http://localhost:5180', ''), false)
  assert.equal(memeServeur(null, 'http://localhost:5180', 'Ovrsee'), false, 'sans crawl lancé par nous, rien de connu')
  assert.equal(memeServeur(connu, 'http://localhost:5180', null), false)
})

test('titreServi lit le titre d’un serveur qui répond, et rend null sans serveur', async () => {
  const server = createServer((req, res) => res.end('<title>Ovrsee</title>'))
  await new Promise(ok => server.listen(0, '127.0.0.1', ok))
  const { port } = server.address()
  try {
    assert.equal(await titreServi(`http://127.0.0.1:${port}/`), 'Ovrsee')
  } finally {
    server.close()
  }
  assert.equal(await titreServi(`http://127.0.0.1:${port}/`), null)
})

test('titreServi ne suit pas une redirection', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(302, { location: '/ailleurs' })
      res.end()
    } else res.end('<title>Ailleurs</title>')
  })
  await new Promise(ok => server.listen(0, '127.0.0.1', ok))
  try {
    assert.equal(await titreServi(`http://127.0.0.1:${server.address().port}/`), '')
  } finally {
    server.close()
  }
})
