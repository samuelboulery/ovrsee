import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeRoutes, isDynamicSegment, pageSlug, sameOrigin } from './routes.js'

// --- reconnaissance d'un segment variable ---------------------------------

test('isDynamicSegment reconnaît les identifiants usuels', () => {
  assert.ok(isDynamicSegment('42'))
  assert.ok(isDynamicSegment('0'))
  assert.ok(isDynamicSegment('507f1f77bcf86cd799439011'), 'ObjectId mongo')
  assert.ok(isDynamicSegment('9f8e7d6c-5b4a-4321-9876-1234567890ab'), 'uuid')
  assert.ok(isDynamicSegment('a3f5c9e1b2d4f6a8c0e2b4d6f8a0c2e4'), '32 hex')
})

test('isDynamicSegment laisse passer les segments qui nomment un écran', () => {
  for (const mot of ['login', 'settings', 'plante', 'new', 'export', 'herbier', 'v2', 'a-propos']) {
    assert.equal(isDynamicSegment(mot), false, `${mot} ne doit pas être vu comme un identifiant`)
  }
})

// --- normalisation ---------------------------------------------------------

test('normalizeRoutes replie les identifiants sur un paramètre', () => {
  const { routes, routeOf } = normalizeRoutes([
    '/plante/12',
    '/plante/13',
    '/plante/999',
    '/settings',
  ])

  assert.deepEqual(routes.sort(), ['/plante/:id', '/settings'])
  assert.equal(routeOf('/plante/12'), '/plante/:id')
  assert.equal(routeOf('/settings'), '/settings')
})

test('normalizeRoutes replie aussi un segment répété qui ne ressemble pas à un identifiant', () => {
  // Trois valeurs distinctes sous le même préfixe : c'est une collection, même
  // si les valeurs sont des mots (slugs d'article, noms d'utilisateur…).
  const { routeOf } = normalizeRoutes([
    '/herbier/prairie-seche',
    '/herbier/sous-bois',
    '/herbier/zone-humide',
  ])
  assert.equal(routeOf('/herbier/prairie-seche'), '/herbier/:id')
})

test('normalizeRoutes ne replie pas deux écrans frères distincts', () => {
  // Deux valeurs seulement, aucune ne ressemble à un identifiant : ce sont
  // deux écrans nommés, pas une collection.
  const { routes } = normalizeRoutes(['/compte/profil', '/compte/facturation'])
  assert.deepEqual(routes.sort(), ['/compte/facturation', '/compte/profil'])
})

test('normalizeRoutes numérote les paramètres successifs', () => {
  const { routeOf } = normalizeRoutes([
    '/herbier/1/plante/10',
    '/herbier/2/plante/20',
    '/herbier/3/plante/30',
  ])
  assert.equal(routeOf('/herbier/1/plante/10'), '/herbier/:id/plante/:id2')
})

test('normalizeRoutes garde la racine telle quelle', () => {
  const { routes, routeOf } = normalizeRoutes(['/'])
  assert.deepEqual(routes, ['/'])
  assert.equal(routeOf('/'), '/')
})

test('normalizeRoutes ignore la casse de fin de chemin et les doublons', () => {
  const { routes } = normalizeRoutes(['/settings', '/settings/', '/settings'])
  assert.deepEqual(routes, ['/settings'])
})

test('normalizeRoutes rend un résultat vide sans planter sur une entrée vide', () => {
  const { routes, routeOf } = normalizeRoutes([])
  assert.deepEqual(routes, [])
  assert.equal(routeOf('/inconnu'), '/inconnu', 'un chemin jamais vu se rend tel quel')
})

// --- nommage de fichier ----------------------------------------------------

test('pageSlug transforme une route en nom de dossier sûr', () => {
  assert.equal(pageSlug('/'), 'accueil')
  assert.equal(pageSlug('/settings'), 'settings')
  assert.equal(pageSlug('/plante/:id'), 'plante-id')
  assert.equal(pageSlug('/herbier/:id/plante/:id2'), 'herbier-id-plante-id2')
})

test('pageSlug ne produit jamais de chemin échappant du dossier', () => {
  assert.equal(pageSlug('/../../etc/passwd'), 'etc-passwd')
  assert.ok(!pageSlug('/a/../b').includes('..'))
})

// --- périmètre du parcours -------------------------------------------------

test('sameOrigin garde les liens internes et écarte les autres', () => {
  const base = 'http://localhost:5173'
  assert.ok(sameOrigin('http://localhost:5173/settings', base))
  assert.equal(sameOrigin('https://example.com/', base), false)
  assert.equal(sameOrigin('mailto:a@b.c', base), false)
  assert.equal(sameOrigin('javascript:void(0)', base), false)
  assert.equal(sameOrigin('http://localhost:9999/', base), false, 'port différent')
})

test('sameOrigin résout un href malformé comme le ferait un navigateur', () => {
  // `://cassé` et `` ne sont pas des URL absolues : un navigateur les résout
  // en chemin relatif sur l'origine courante. Les traiter comme internes est
  // le comportement juste — le dédoublonnage du parcours s'occupe du reste.
  assert.ok(sameOrigin('://cassé', 'http://localhost:5173'))
  assert.ok(sameOrigin('', 'http://localhost:5173'))
})

test('sameOrigin ne plante pas quand la base elle-même est invalide', () => {
  assert.equal(sameOrigin('/settings', 'pas-une-url'), false)
})
