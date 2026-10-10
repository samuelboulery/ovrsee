import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import { memeProjet, titreAttendu, titreHtml, titreServi } from './serveur.js'

// --- réutiliser le serveur déjà lancé (T-0281) -----------------------------

test('le titre se lit dans le HTML servi', () => {
  assert.equal(titreHtml('<html><head><title> Ovrsee </title></head></html>'), 'Ovrsee')
  assert.equal(titreHtml('<TITLE lang="fr">Mon app</TITLE>'), 'Mon app')
  assert.equal(titreHtml('<html></html>'), '')
})

test('le titre attendu est celui servi au dernier crawl réussi, sinon celui de l’accueil', () => {
  assert.equal(titreAttendu({ titreHtml: 'Servi', pages: [{ route: '/', title: 'Rendu' }] }), 'Servi')
  assert.equal(titreAttendu({ pages: [{ route: '/x', title: 'X' }, { route: '/', title: ' Rendu ' }] }), 'Rendu')
  assert.equal(titreAttendu(null), '')
  assert.equal(titreAttendu({ pages: 'pas une liste' }), '')
})

test('même projet seulement sur un titre identique et non vide', () => {
  assert.equal(memeProjet('Ovrsee', 'Ovrsee'), true)
  assert.equal(memeProjet('Autre', 'Ovrsee'), false)
  assert.equal(memeProjet('', ''), false, 'deux titres vides ne prouvent rien')
  assert.equal(memeProjet(null, 'Ovrsee'), false)
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
