import { test } from 'node:test'
import assert from 'node:assert/strict'

import { retainable } from './index.js'

const NOW = new Date('2026-08-08T12:00:00Z')
const shot = date => `${date}-abc123.png`

test('une capture par jour est gardée sur les trente derniers jours', () => {
  const files = ['2026-08-08', '2026-08-01', '2026-07-20', '2026-07-12'].map(shot)
  const keep = retainable(files, NOW)
  assert.equal(keep.size, 4, 'aucun de ces jours-là ne doit disparaître')
})

test('sur deux jours, tous les crawls du jour survivent', () => {
  // Le cas qui a motivé T-0136 : douze crawls du même jour, et pages.json cite
  // le dernier écrit. Aucun ne doit tomber tant qu'il est frais.
  const files = ['aaa', 'bbb', 'ccc'].map(sha => `2026-08-08-${sha}.png`)
  assert.equal(retainable(files, NOW).size, 3)
})

test('au-delà de deux jours, une seule capture par jour survit', () => {
  const files = ['aaa', 'bbb', 'ccc'].map(sha => `2026-08-01-${sha}.png`)
  const keep = retainable(files, NOW)
  assert.equal(keep.size, 1, 'douze photographies du même écran ne valent pas plus qu\'une')
  assert.ok(keep.has('2026-08-01-ccc.png'), 'le départage se fait sur le nom, de façon stable')
})

test('des jours différents gardent chacun leur capture', () => {
  const files = ['2026-08-05', '2026-08-04', '2026-08-03'].map(shot)
  assert.equal(retainable(files, NOW).size, 3)
})

test('au-delà de trente jours, une seule capture par semaine survit', () => {
  // Trois captures dans la même semaine de juin, très au-delà du seuil.
  const files = ['2026-06-01', '2026-06-02', '2026-06-03'].map(shot)
  const keep = retainable(files, NOW)
  assert.equal(keep.size, 1)
  assert.ok(keep.has(shot('2026-06-03')), 'la plus récente de la semaine est gardée')
})

test('des semaines différentes gardent chacune leur capture', () => {
  const files = ['2026-06-03', '2026-05-20', '2026-04-15', '2026-01-02'].map(shot)
  assert.equal(retainable(files, NOW).size, 4)
})

test('la frontière des trente jours ne perd pas la capture qui tombe dessus', () => {
  const files = [shot('2026-07-09')] // exactement 30 jours avant NOW
  assert.equal(retainable(files, NOW).size, 1)
})

test('les fichiers sans date exploitable sont laissés en place plutôt que supprimés', () => {
  // Ne pas les mettre dans `keep` reviendrait à les effacer. Face à un fichier
  // qu'on ne sait pas dater, on ne détruit pas.
  const keep = retainable(['pas-une-date.png', shot('2026-08-08')], NOW)
  assert.ok(keep.has(shot('2026-08-08')))
  assert.equal(keep.has('pas-une-date.png'), false)
})

test('aucune capture ne donne un ensemble vide, sans planter', () => {
  assert.equal(retainable([], NOW).size, 0)
})
