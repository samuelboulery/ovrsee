import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { ONGLETS } from './screenshots.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(RACINE, 'docs', 'screenshots')
const README = ['README.md', 'README.fr.md']

/**
 * Le garde-fou des captures. Elles ne se testent pas au contenu — c'est une
 * image, et personne ne dira ce qu'elle montre. Ce qui se vérifie, et qui a
 * réellement cassé : un onglet ajouté sans sa capture, une capture qu'un seul
 * des deux README cite, un fichier qui traîne après un changement de format.
 */
test('chaque onglet a sa capture, citée par les deux README', () => {
  for (const [id] of ONGLETS) {
    assert.ok(existsSync(join(SORTIE, `${id}.webp`)), `docs/screenshots/${id}.webp manque`)
    for (const page of README) {
      const texte = readFileSync(join(RACINE, page), 'utf8')
      assert.ok(texte.includes(`docs/screenshots/${id}.webp`), `${page} ne cite pas ${id}.webp`)
    }
  }
})

test('aucune capture orpheline dans docs/screenshots', () => {
  const attendus = new Set(ONGLETS.map(([id]) => `${id}.webp`))
  for (const fichier of readdirSync(SORTIE)) {
    assert.ok(attendus.has(fichier), `docs/screenshots/${fichier} ne correspond à aucun onglet`)
  }
})
