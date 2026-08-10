import { test } from 'node:test'
import assert from 'node:assert/strict'

import { crawlUtile } from './ovrsee-post-commit.js'

/**
 * Le crawl coûte le démarrage d'une application et d'un navigateur. Le
 * déclencher sur un commit qui ne range que les sorties du crawl précédent en
 * produit une nouvelle fournée, laquelle en produira une autre : l'arbre de
 * travail ne peut alors jamais redevenir propre.
 *
 * Ce fichier existe aussi pour une raison de forme : importer le hook ne doit
 * rien exécuter. S'il lançait encore son corps à l'import, ce test lancerait un
 * crawl à chaque `pnpm test`.
 */

test('un commit qui touche du code déclenche le crawl', () => {
  assert.equal(crawlUtile(['app/src/App.tsx']), true)
  assert.equal(crawlUtile(['README.md', 'hooks/plans.js']), true)
})

test('un commit sans fichier source ne déclenche rien', () => {
  // `changedFiles()` a déjà retiré `ovrsee/` et `graphify-out/` : une liste
  // vide veut dire « ce commit n'a touché que des sorties ».
  assert.equal(crawlUtile([]), false)
})

test('crawlUtile encaisse une liste absente', () => {
  assert.equal(crawlUtile(undefined), false)
  assert.equal(crawlUtile(null), false)
})
