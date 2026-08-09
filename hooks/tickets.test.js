import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  DEFAULT_COLUMNS,
  colonneFinale,
  readBoard,
  readTickets,
  nextTicketId,
  ticketFileName,
  isSafeTicketFileName,
  createTicket,
  writeBoard,
  addColumn,
  renameColumn,
  removeColumn,
  reorderColumn,
  updateTicket,
  moveTicket,
  deleteTicket,
  sortTickets,
  importOpenPlans,
} from './tickets.js'

/** Un dossier `cockpit/` jetable. */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-tickets-'))
  const cockpitDir = join(root, 'cockpit')
  mkdirSync(join(cockpitDir, 'tickets'), { recursive: true })
  mkdirSync(join(cockpitDir, 'plans'), { recursive: true })
  return cockpitDir
}

const ecrireBoardBrut = (cockpitDir, content) =>
  writeFileSync(join(cockpitDir, 'board.json'), content, 'utf8')

// --- readBoard -------------------------------------------------------------

test('readBoard rend les colonnes par défaut quand board.json est absent', () => {
  assert.deepEqual(readBoard(fixture()), DEFAULT_COLUMNS)
})

test('readBoard rend les colonnes par défaut sur un board illisible', () => {
  const cockpitDir = fixture()
  ecrireBoardBrut(cockpitDir, '{ pas du json')
  assert.deepEqual(readBoard(cockpitDir), DEFAULT_COLUMNS)
})

test('readBoard refuse un board dont une colonne n’a pas d’id', () => {
  const cockpitDir = fixture()
  ecrireBoardBrut(cockpitDir, JSON.stringify({ colonnes: [{ titre: 'Sans id' }] }))
  assert.deepEqual(readBoard(cockpitDir), DEFAULT_COLUMNS)
})

test('readBoard refuse un board aux id dupliqués', () => {
  const cockpitDir = fixture()
  ecrireBoardBrut(
    cockpitDir,
    JSON.stringify({ colonnes: [{ id: 'a', titre: 'A' }, { id: 'a', titre: 'Encore A' }] }),
  )
  assert.deepEqual(readBoard(cockpitDir), DEFAULT_COLUMNS)
})

test('readBoard lit des colonnes personnalisées', () => {
  const cockpitDir = fixture()
  ecrireBoardBrut(
    cockpitDir,
    JSON.stringify({ colonnes: [{ id: 'idees', titre: 'Idées' }, { id: 'fini', titre: 'Fini', wip: 2 }] }),
  )
  assert.deepEqual(readBoard(cockpitDir), [
    { id: 'idees', titre: 'Idées' },
    { id: 'fini', titre: 'Fini', wip: 2 },
  ])
})

// --- nextTicketId ----------------------------------------------------------

test('nextTicketId part de T-0001 sur un tableau vide', () => {
  assert.equal(nextTicketId([]), 'T-0001')
})

test('nextTicketId prend le maximum, pas le nombre de tickets', () => {
  const tickets = [{ meta: { id: 'T-0001' } }, { meta: { id: 'T-0007' } }]
  assert.equal(nextTicketId(tickets), 'T-0008')
})

test('nextTicketId ignore les id non conformes', () => {
  const tickets = [{ meta: { id: 'bidon' } }, { meta: {} }, { meta: { id: 'T-0003' } }]
  assert.equal(nextTicketId(tickets), 'T-0004')
})

// --- noms de fichiers ------------------------------------------------------

test('ticketFileName préfixe par l’id et réduit le titre', () => {
  assert.equal(ticketFileName('T-0012', 'Glisser-déposer entre colonnes'), 'T-0012-glisser-deposer-entre-colonnes.md')
})

test('isSafeTicketFileName rejette tout ce qui pourrait sortir du dossier', () => {
  assert.equal(isSafeTicketFileName('T-0001-ok.md'), true)
  assert.equal(isSafeTicketFileName('../plans/plan.md'), false)
  assert.equal(isSafeTicketFileName('sous\\dossier.md'), false)
  assert.equal(isSafeTicketFileName('nul\0.md'), false)
  assert.equal(isSafeTicketFileName('.cache.md'), false)
  assert.equal(isSafeTicketFileName('T-0001-ok.txt'), false)
  assert.equal(isSafeTicketFileName(''), false)
})

// --- createTicket ----------------------------------------------------------

test('createTicket écrit un fichier lisible par readTickets', () => {
  const cockpitDir = fixture()
  const written = createTicket(cockpitDir, { titre: 'Premier ticket', corps: '## Contexte\nParce que.' })

  assert.equal(written.meta.id, 'T-0001')
  assert.equal(written.meta.colonne, 'backlog')
  assert.equal(written.meta.priorite, 'moyenne')
  assert.equal(written.file, 'T-0001-premier-ticket.md')

  const tickets = readTickets(cockpitDir)
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0].meta.titre, 'Premier ticket')
  assert.match(tickets[0].body, /Parce que\./)
})

test('createTicket refuse un titre vide', () => {
  assert.throws(() => createTicket(fixture(), { titre: '   ' }), /titre/)
})

test('createTicket refuse une colonne inconnue', () => {
  assert.throws(() => createTicket(fixture(), { titre: 'X', colonne: 'nowhere' }), /colonne/)
})

test('createTicket refuse une priorité inconnue', () => {
  assert.throws(() => createTicket(fixture(), { titre: 'X', priorite: 'urgentissime' }), /priorit/)
})

test('createTicket crée le dossier tickets/ s’il manque', () => {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-tickets-'))
  const cockpitDir = join(root, 'cockpit')
  createTicket(cockpitDir, { titre: 'Sans dossier' })
  assert.deepEqual(readdirSync(join(cockpitDir, 'tickets')), ['T-0001-sans-dossier.md'])
})

test('createTicket refuse d’écrire à travers un lien symbolique', () => {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-tickets-'))
  const cockpitDir = join(root, 'cockpit')
  mkdirSync(cockpitDir, { recursive: true })
  // Un dépôt hostile peut livrer `cockpit/tickets -> ~/.ssh` : l'écriture doit
  // refuser le lien, pas le suivre.
  symlinkSync(mkdtempSync(join(tmpdir(), 'cockpit-ailleurs-')), join(cockpitDir, 'tickets'))

  assert.throws(() => createTicket(cockpitDir, { titre: 'X' }), /lien symbolique/)
})

// --- readTickets et colonnes disparues -------------------------------------

test('readTickets replie un ticket dont la colonne n’existe plus', () => {
  const cockpitDir = fixture()
  createTicket(cockpitDir, { titre: 'Orphelin', colonne: 'revue' })
  ecrireBoardBrut(cockpitDir, JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }] }))

  const [ticket] = readTickets(cockpitDir)
  assert.equal(ticket.meta.colonne, 'todo')
})

test('readTickets ignore un fichier illisible sans emporter les autres', () => {
  const cockpitDir = fixture()
  createTicket(cockpitDir, { titre: 'Valide' })
  writeFileSync(join(cockpitDir, 'tickets', 'T-9999-casse.md'), 'pas de frontmatter', 'utf8')

  assert.equal(readTickets(cockpitDir).length, 1)
})

test('readTickets rend un tableau vide quand le dossier n’existe pas', () => {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-tickets-'))
  assert.deepEqual(readTickets(join(root, 'cockpit')), [])
})

// --- moveTicket / updateTicket / deleteTicket ------------------------------

test('moveTicket ne change que la colonne et la date de mise à jour', () => {
  const cockpitDir = fixture()
  const { file, meta } = createTicket(cockpitDir, { titre: 'À déplacer' })

  assert.equal(moveTicket(cockpitDir, file, 'en-cours'), true)

  const [ticket] = readTickets(cockpitDir)
  assert.equal(ticket.meta.colonne, 'en-cours')
  assert.equal(ticket.meta.titre, meta.titre)
  assert.equal(ticket.meta.cree, meta.cree)
})

test('moveTicket refuse une colonne inconnue', () => {
  const cockpitDir = fixture()
  const { file } = createTicket(cockpitDir, { titre: 'À déplacer' })
  assert.throws(() => moveTicket(cockpitDir, file, 'nowhere'), /colonne/)
})

test('moveTicket refuse un nom de fichier hors du dossier', () => {
  assert.throws(() => moveTicket(fixture(), '../plans/x.md', 'pret'), /fichier/)
})

test('updateTicket réécrit le corps et garde l’id', () => {
  const cockpitDir = fixture()
  const { file } = createTicket(cockpitDir, { titre: 'Titre initial', corps: 'ancien' })

  updateTicket(cockpitDir, file, { titre: 'Titre revu', priorite: 'haute', corps: 'nouveau' })

  const [ticket] = readTickets(cockpitDir)
  assert.equal(ticket.meta.id, 'T-0001')
  assert.equal(ticket.meta.titre, 'Titre revu')
  assert.equal(ticket.meta.priorite, 'haute')
  assert.equal(ticket.body.trim(), 'nouveau')
  // Le nom du fichier ne bouge pas : l'id est la clé, pas le titre.
  assert.equal(ticket.file, file)
})

test('deleteTicket retire le fichier', () => {
  const cockpitDir = fixture()
  const { file } = createTicket(cockpitDir, { titre: 'Jetable' })

  assert.equal(deleteTicket(cockpitDir, file), true)
  assert.deepEqual(readTickets(cockpitDir), [])
  assert.equal(deleteTicket(cockpitDir, file), false)
})

// --- sortTickets -----------------------------------------------------------

test('sortTickets classe par priorité puis du plus récent au plus ancien', () => {
  const tickets = [
    { meta: { id: 'T-0001', priorite: 'basse', cree: '2026-08-09' } },
    { meta: { id: 'T-0002', priorite: 'haute', cree: '2026-08-01' } },
    { meta: { id: 'T-0003', priorite: 'moyenne', cree: '2026-08-05' } },
    { meta: { id: 'T-0004', priorite: 'haute', cree: '2026-08-08' } },
  ]
  assert.deepEqual(
    sortTickets(tickets).map(t => t.meta.id),
    ['T-0004', 'T-0002', 'T-0003', 'T-0001'],
  )
})

// --- importOpenPlans -------------------------------------------------------

const writePlan = (cockpitDir, file, meta) =>
  writeFileSync(
    join(cockpitDir, 'plans', file),
    `---\n${JSON.stringify(meta, null, 2)}\n---\n\n## Intention\nParce que.\n`,
    'utf8',
  )

test('importOpenPlans crée un ticket par plan ouvert, et une seule fois', () => {
  const cockpitDir = fixture()
  writePlan(cockpitDir, '2026-08-01-jamais-commence.md', {
    status: 'open',
    title: 'Jamais commencé',
    opened: '2026-08-01',
    closed: null,
    commits: [],
  })
  writePlan(cockpitDir, '2026-08-02-en-cours.md', {
    status: 'open',
    title: 'En cours',
    opened: '2026-08-02',
    closed: null,
    commits: [{ sha: 'abc1234', date: '2026-08-02T10:00:00+02:00', files: [] }],
  })
  writePlan(cockpitDir, '2026-08-03-clos.md', {
    status: 'closed',
    title: 'Clos',
    opened: '2026-08-03',
    closed: '2026-08-03',
    commits: [],
  })

  const premier = importOpenPlans(cockpitDir)
  assert.equal(premier.length, 2)

  const parPlan = Object.fromEntries(readTickets(cockpitDir).map(t => [t.meta.plan, t.meta.colonne]))
  assert.equal(parPlan['2026-08-01-jamais-commence.md'], 'backlog')
  assert.equal(parPlan['2026-08-02-en-cours.md'], 'en-cours')

  // Second passage : rien de neuf, pas de doublon.
  assert.deepEqual(importOpenPlans(cockpitDir), [])
  assert.equal(readTickets(cockpitDir).length, 2)
})

// --- colonneFinale ---------------------------------------------------------

test('colonneFinale est la dernière colonne, sauf s’il n’y en a qu’une', () => {
  assert.equal(colonneFinale(DEFAULT_COLUMNS), 'fait')
  assert.equal(colonneFinale([{ id: 'tout', titre: 'Tout' }]), null)
  assert.equal(colonneFinale([]), null)
})

// --- édition des colonnes --------------------------------------------------

test('writeBoard écrit des colonnes valides et les relit', () => {
  const cockpitDir = fixture()
  writeBoard(cockpitDir, [{ id: 'a', titre: 'A' }, { id: 'b', titre: 'B', wip: 2 }])

  assert.deepEqual(readBoard(cockpitDir), [{ id: 'a', titre: 'A' }, { id: 'b', titre: 'B', wip: 2 }])
})

test('writeBoard refuse ce que readBoard ne saurait pas relire', () => {
  const cockpitDir = fixture()
  assert.throws(() => writeBoard(cockpitDir, []), /vide/)
  assert.throws(() => writeBoard(cockpitDir, [{ id: '', titre: 'A' }]), /identifiant/)
  assert.throws(() => writeBoard(cockpitDir, [{ id: 'a', titre: '  ' }]), /titre/)
  assert.throws(
    () => writeBoard(cockpitDir, [{ id: 'a', titre: 'A' }, { id: 'a', titre: 'Bis' }]),
    /deux fois/,
  )
  assert.throws(() => writeBoard(cockpitDir, [{ id: 'a', titre: 'A', wip: 0 }]), /wip|limite/)
})

test('addColumn dérive l’identifiant du titre et l’ajoute à la fin', () => {
  const cockpitDir = fixture()
  const colonnes = addColumn(cockpitDir, { titre: 'À revoir', wip: 2 })

  assert.equal(colonnes.at(-1).id, 'a-revoir')
  assert.equal(colonnes.at(-1).titre, 'À revoir')
  assert.equal(colonnes.at(-1).wip, 2)
  assert.equal(colonnes.length, DEFAULT_COLUMNS.length + 1)
})

test('addColumn ne réutilise jamais un identifiant déjà pris', () => {
  const cockpitDir = fixture()
  addColumn(cockpitDir, { titre: 'Revue' })
  const colonnes = addColumn(cockpitDir, { titre: 'Revue' })

  const ids = colonnes.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids.slice(-2), ['revue-2', 'revue-3'])
})

test('addColumn insère après une colonne donnée', () => {
  const cockpitDir = fixture()
  const colonnes = addColumn(cockpitDir, { titre: 'Bloqué', apres: 'pret' })

  assert.deepEqual(
    colonnes.map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'bloque', 'en-cours', 'revue', 'fait'],
  )
})

test('renameColumn ne touche pas à l’identifiant, donc pas aux tickets', () => {
  const cockpitDir = fixture()
  const { file } = createTicket(cockpitDir, { titre: 'Un ticket', colonne: 'revue' })

  renameColumn(cockpitDir, 'revue', { titre: 'Relecture', wip: 4 })

  const colonne = readBoard(cockpitDir).find(c => c.id === 'revue')
  assert.equal(colonne.titre, 'Relecture')
  assert.equal(colonne.wip, 4)
  assert.equal(readTickets(cockpitDir).find(t => t.file === file).meta.colonne, 'revue')
})

test('renameColumn retire la limite quand wip vaut null', () => {
  const cockpitDir = fixture()
  renameColumn(cockpitDir, 'en-cours', { wip: null })

  assert.equal('wip' in readBoard(cockpitDir).find(c => c.id === 'en-cours'), false)
})

test('renameColumn refuse une colonne inconnue', () => {
  assert.throws(() => renameColumn(fixture(), 'nowhere', { titre: 'X' }), /colonne/)
})

test('removeColumn déplace les tickets avant de retirer la colonne', () => {
  const cockpitDir = fixture()
  const { file } = createTicket(cockpitDir, { titre: 'Orphelin en puissance', colonne: 'revue' })

  removeColumn(cockpitDir, 'revue', 'fait')

  assert.equal(readBoard(cockpitDir).some(c => c.id === 'revue'), false)
  // Le fichier porte la nouvelle colonne : pas un repli d'affichage, une écriture.
  assert.equal(readTickets(cockpitDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('removeColumn exige une destination tant que la colonne porte des tickets', () => {
  const cockpitDir = fixture()
  createTicket(cockpitDir, { titre: 'Encore là', colonne: 'revue' })

  assert.throws(() => removeColumn(cockpitDir, 'revue'), /destination/)
  assert.throws(() => removeColumn(cockpitDir, 'revue', 'revue'), /destination/)
  assert.throws(() => removeColumn(cockpitDir, 'revue', 'nowhere'), /destination/)
})

test('removeColumn se passe de destination sur une colonne vide', () => {
  const cockpitDir = fixture()
  assert.equal(removeColumn(cockpitDir, 'revue').some(c => c.id === 'revue'), false)
})

test('removeColumn refuse de vider le tableau', () => {
  const cockpitDir = fixture()
  writeBoard(cockpitDir, [{ id: 'seule', titre: 'Seule' }])

  assert.throws(() => removeColumn(cockpitDir, 'seule'), /dernière|seule colonne/)
})

test('reorderColumn place une colonne à l’index demandé', () => {
  const cockpitDir = fixture()

  assert.deepEqual(
    reorderColumn(cockpitDir, 'fait', 0).map(c => c.id),
    ['fait', 'backlog', 'a-specifier', 'pret', 'en-cours', 'revue'],
  )
  assert.deepEqual(
    reorderColumn(cockpitDir, 'fait', 5).map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'en-cours', 'revue', 'fait'],
  )
})

test('reorderColumn borne l’index au lieu de refuser le geste', () => {
  const cockpitDir = fixture()

  assert.deepEqual(
    reorderColumn(cockpitDir, 'backlog', 99).map(c => c.id),
    ['a-specifier', 'pret', 'en-cours', 'revue', 'fait', 'backlog'],
  )
  assert.deepEqual(
    reorderColumn(cockpitDir, 'backlog', -3).map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'en-cours', 'revue', 'fait'],
  )
})

test('reorderColumn au même index ne réécrit rien', () => {
  const cockpitDir = fixture()

  assert.deepEqual(
    reorderColumn(cockpitDir, 'pret', 2).map(c => c.id),
    DEFAULT_COLUMNS.map(c => c.id),
  )
})

test('reorderColumn refuse une colonne inconnue', () => {
  assert.throws(() => reorderColumn(fixture(), 'nowhere', 0), /colonne/)
})
