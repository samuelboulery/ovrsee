import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  DEFAULT_COLUMNS,
  addColumn,
  colonneFinale,
  readBoard,
  renameColumn,
  reorderColumn,
  writeBoard,
} from './board.js'
import { createTicket, readTickets, removeColumn } from './tickets.js'

/** Un dossier `ovrsee/` jetable. */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-board-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

const ecrireBoardBrut = (ovrseeDir, content) =>
  writeFileSync(join(ovrseeDir, 'board.json'), content, 'utf8')

// --- readBoard -------------------------------------------------------------

test('readBoard rend les colonnes par défaut quand board.json est absent', () => {
  assert.deepEqual(readBoard(fixture()), DEFAULT_COLUMNS)
})

test('readBoard rend les colonnes par défaut sur un board illisible', () => {
  const ovrseeDir = fixture()
  ecrireBoardBrut(ovrseeDir, '{ pas du json')
  assert.deepEqual(readBoard(ovrseeDir), DEFAULT_COLUMNS)
})

test('readBoard refuse un board dont une colonne n’a pas d’id', () => {
  const ovrseeDir = fixture()
  ecrireBoardBrut(ovrseeDir, JSON.stringify({ colonnes: [{ titre: 'Sans id' }] }))
  assert.deepEqual(readBoard(ovrseeDir), DEFAULT_COLUMNS)
})

test('readBoard refuse un board aux id dupliqués', () => {
  const ovrseeDir = fixture()
  ecrireBoardBrut(
    ovrseeDir,
    JSON.stringify({ colonnes: [{ id: 'a', titre: 'A' }, { id: 'a', titre: 'Encore A' }] }),
  )
  assert.deepEqual(readBoard(ovrseeDir), DEFAULT_COLUMNS)
})

test('readBoard lit des colonnes personnalisées', () => {
  const ovrseeDir = fixture()
  ecrireBoardBrut(
    ovrseeDir,
    JSON.stringify({ colonnes: [{ id: 'idees', titre: 'Idées' }, { id: 'fini', titre: 'Fini', wip: 2 }] }),
  )
  assert.deepEqual(readBoard(ovrseeDir), [
    { id: 'idees', titre: 'Idées' },
    { id: 'fini', titre: 'Fini', wip: 2 },
  ])
})


// --- colonneFinale ---------------------------------------------------------

test('colonneFinale est la dernière colonne, sauf s’il n’y en a qu’une', () => {
  assert.equal(colonneFinale(DEFAULT_COLUMNS), 'fait')
  assert.equal(colonneFinale([{ id: 'tout', titre: 'Tout' }]), null)
  assert.equal(colonneFinale([]), null)
})

// --- édition des colonnes --------------------------------------------------

test('writeBoard écrit des colonnes valides et les relit', () => {
  const ovrseeDir = fixture()
  writeBoard(ovrseeDir, [{ id: 'a', titre: 'A' }, { id: 'b', titre: 'B', wip: 2 }])

  assert.deepEqual(readBoard(ovrseeDir), [{ id: 'a', titre: 'A' }, { id: 'b', titre: 'B', wip: 2 }])
})

test('writeBoard refuse ce que readBoard ne saurait pas relire', () => {
  const ovrseeDir = fixture()
  assert.throws(() => writeBoard(ovrseeDir, []), /vide/)
  assert.throws(() => writeBoard(ovrseeDir, [{ id: '', titre: 'A' }]), /identifiant/)
  assert.throws(() => writeBoard(ovrseeDir, [{ id: 'a', titre: '  ' }]), /titre/)
  assert.throws(
    () => writeBoard(ovrseeDir, [{ id: 'a', titre: 'A' }, { id: 'a', titre: 'Bis' }]),
    /deux fois/,
  )
  assert.throws(() => writeBoard(ovrseeDir, [{ id: 'a', titre: 'A', wip: 0 }]), /wip|limite/)
})

test('addColumn dérive l’identifiant du titre et l’ajoute à la fin', () => {
  const ovrseeDir = fixture()
  const colonnes = addColumn(ovrseeDir, { titre: 'À revoir', wip: 2 })

  assert.equal(colonnes.at(-1).id, 'a-revoir')
  assert.equal(colonnes.at(-1).titre, 'À revoir')
  assert.equal(colonnes.at(-1).wip, 2)
  assert.equal(colonnes.length, DEFAULT_COLUMNS.length + 1)
})

test('addColumn ne réutilise jamais un identifiant déjà pris', () => {
  const ovrseeDir = fixture()
  addColumn(ovrseeDir, { titre: 'Revue' })
  const colonnes = addColumn(ovrseeDir, { titre: 'Revue' })

  const ids = colonnes.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids.slice(-2), ['revue-2', 'revue-3'])
})

test('addColumn insère après une colonne donnée', () => {
  const ovrseeDir = fixture()
  const colonnes = addColumn(ovrseeDir, { titre: 'Bloqué', apres: 'pret' })

  assert.deepEqual(
    colonnes.map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'bloque', 'en-cours', 'revue', 'fait'],
  )
})

test('renameColumn ne touche pas à l’identifiant, donc pas aux tickets', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Un ticket', colonne: 'revue' })

  renameColumn(ovrseeDir, 'revue', { titre: 'Relecture', wip: 4 })

  const colonne = readBoard(ovrseeDir).find(c => c.id === 'revue')
  assert.equal(colonne.titre, 'Relecture')
  assert.equal(colonne.wip, 4)
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'revue')
})

test('renameColumn retire la limite quand wip vaut null', () => {
  const ovrseeDir = fixture()
  renameColumn(ovrseeDir, 'en-cours', { wip: null })

  assert.equal('wip' in readBoard(ovrseeDir).find(c => c.id === 'en-cours'), false)
})

test('renameColumn refuse une colonne inconnue', () => {
  assert.throws(() => renameColumn(fixture(), 'nowhere', { titre: 'X' }), /colonne/)
})

test('removeColumn déplace les tickets avant de retirer la colonne', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Orphelin en puissance', colonne: 'revue' })

  removeColumn(ovrseeDir, 'revue', 'fait')

  assert.equal(readBoard(ovrseeDir).some(c => c.id === 'revue'), false)
  // Le fichier porte la nouvelle colonne : pas un repli d'affichage, une écriture.
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('removeColumn exige une destination tant que la colonne porte des tickets', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Encore là', colonne: 'revue' })

  assert.throws(() => removeColumn(ovrseeDir, 'revue'), /destination/)
  assert.throws(() => removeColumn(ovrseeDir, 'revue', 'revue'), /destination/)
  assert.throws(() => removeColumn(ovrseeDir, 'revue', 'nowhere'), /destination/)
})

test('removeColumn se passe de destination sur une colonne vide', () => {
  const ovrseeDir = fixture()
  assert.equal(removeColumn(ovrseeDir, 'revue').some(c => c.id === 'revue'), false)
})

test('removeColumn refuse de vider le tableau', () => {
  const ovrseeDir = fixture()
  writeBoard(ovrseeDir, [{ id: 'seule', titre: 'Seule' }])

  assert.throws(() => removeColumn(ovrseeDir, 'seule'), /dernière|seule colonne/)
})

test('reorderColumn place une colonne à l’index demandé', () => {
  const ovrseeDir = fixture()

  assert.deepEqual(
    reorderColumn(ovrseeDir, 'fait', 0).map(c => c.id),
    ['fait', 'backlog', 'a-specifier', 'pret', 'en-cours', 'revue'],
  )
  assert.deepEqual(
    reorderColumn(ovrseeDir, 'fait', 5).map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'en-cours', 'revue', 'fait'],
  )
})

test('reorderColumn borne l’index au lieu de refuser le geste', () => {
  const ovrseeDir = fixture()

  assert.deepEqual(
    reorderColumn(ovrseeDir, 'backlog', 99).map(c => c.id),
    ['a-specifier', 'pret', 'en-cours', 'revue', 'fait', 'backlog'],
  )
  assert.deepEqual(
    reorderColumn(ovrseeDir, 'backlog', -3).map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'en-cours', 'revue', 'fait'],
  )
})

test('reorderColumn au même index ne réécrit rien', () => {
  const ovrseeDir = fixture()

  assert.deepEqual(
    reorderColumn(ovrseeDir, 'pret', 2).map(c => c.id),
    DEFAULT_COLUMNS.map(c => c.id),
  )
})

test('reorderColumn refuse une colonne inconnue', () => {
  assert.throws(() => reorderColumn(fixture(), 'nowhere', 0), /colonne/)
})

