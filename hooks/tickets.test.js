import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  DEFAULT_COLUMNS,
  childrenOf,
  colonneFinale,
  orphanChildren,
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

/** Un dossier `ovrsee/` jetable. */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tickets-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  mkdirSync(join(ovrseeDir, 'plans'), { recursive: true })
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
  const ovrseeDir = fixture()
  const written = createTicket(ovrseeDir, { titre: 'Premier ticket', corps: '## Contexte\nParce que.' })

  assert.equal(written.meta.id, 'T-0001')
  assert.equal(written.meta.colonne, 'backlog')
  assert.equal(written.meta.priorite, 'moyenne')
  assert.equal(written.file, 'T-0001-premier-ticket.md')

  const tickets = readTickets(ovrseeDir)
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
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tickets-'))
  const ovrseeDir = join(root, 'ovrsee')
  createTicket(ovrseeDir, { titre: 'Sans dossier' })
  assert.deepEqual(readdirSync(join(ovrseeDir, 'tickets')), ['T-0001-sans-dossier.md'])
})

test('createTicket refuse d’écrire à travers un lien symbolique', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tickets-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(ovrseeDir, { recursive: true })
  // Un dépôt hostile peut livrer `ovrsee/tickets -> ~/.ssh` : l'écriture doit
  // refuser le lien, pas le suivre.
  symlinkSync(mkdtempSync(join(tmpdir(), 'ovrsee-ailleurs-')), join(ovrseeDir, 'tickets'))

  assert.throws(() => createTicket(ovrseeDir, { titre: 'X' }), /lien symbolique/)
})

// --- readTickets et colonnes disparues -------------------------------------

test('readTickets replie un ticket dont la colonne n’existe plus', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Orphelin', colonne: 'revue' })
  ecrireBoardBrut(ovrseeDir, JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }] }))

  const [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.colonne, 'todo')
})

test('readTickets ignore un fichier illisible sans emporter les autres', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Valide' })
  writeFileSync(join(ovrseeDir, 'tickets', 'T-9999-casse.md'), 'pas de frontmatter', 'utf8')

  assert.equal(readTickets(ovrseeDir).length, 1)
})

test('readTickets rend un tableau vide quand le dossier n’existe pas', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tickets-'))
  assert.deepEqual(readTickets(join(root, 'ovrsee')), [])
})

// --- moveTicket / updateTicket / deleteTicket ------------------------------

test('moveTicket ne change que la colonne et la date de mise à jour', () => {
  const ovrseeDir = fixture()
  const { file, meta } = createTicket(ovrseeDir, { titre: 'À déplacer' })

  assert.equal(moveTicket(ovrseeDir, file, 'en-cours'), true)

  const [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.colonne, 'en-cours')
  assert.equal(ticket.meta.titre, meta.titre)
  assert.equal(ticket.meta.cree, meta.cree)
})

test('moveTicket refuse une colonne inconnue', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'À déplacer' })
  assert.throws(() => moveTicket(ovrseeDir, file, 'nowhere'), /colonne/)
})

test('moveTicket refuse un nom de fichier hors du dossier', () => {
  assert.throws(() => moveTicket(fixture(), '../plans/x.md', 'pret'), /fichier/)
})

test('updateTicket réécrit le corps et garde l’id', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Titre initial', corps: 'ancien' })

  updateTicket(ovrseeDir, file, { titre: 'Titre revu', priorite: 'haute', corps: 'nouveau' })

  const [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.id, 'T-0001')
  assert.equal(ticket.meta.titre, 'Titre revu')
  assert.equal(ticket.meta.priorite, 'haute')
  assert.equal(ticket.body.trim(), 'nouveau')
  // Le nom du fichier ne bouge pas : l'id est la clé, pas le titre.
  assert.equal(ticket.file, file)
})

test('deleteTicket retire le fichier', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Jetable' })

  assert.equal(deleteTicket(ovrseeDir, file), true)
  assert.deepEqual(readTickets(ovrseeDir), [])
  assert.equal(deleteTicket(ovrseeDir, file), false)
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

const writePlan = (ovrseeDir, file, meta) =>
  writeFileSync(
    join(ovrseeDir, 'plans', file),
    `---\n${JSON.stringify(meta, null, 2)}\n---\n\n## Intention\nParce que.\n`,
    'utf8',
  )

test('importOpenPlans crée un ticket par plan ouvert, et une seule fois', () => {
  const ovrseeDir = fixture()
  writePlan(ovrseeDir, '2026-08-01-jamais-commence.md', {
    status: 'open',
    title: 'Jamais commencé',
    opened: '2026-08-01',
    closed: null,
    commits: [],
  })
  writePlan(ovrseeDir, '2026-08-02-en-cours.md', {
    status: 'open',
    title: 'En cours',
    opened: '2026-08-02',
    closed: null,
    commits: [{ sha: 'abc1234', date: '2026-08-02T10:00:00+02:00', files: [] }],
  })
  writePlan(ovrseeDir, '2026-08-03-clos.md', {
    status: 'closed',
    title: 'Clos',
    opened: '2026-08-03',
    closed: '2026-08-03',
    commits: [],
  })

  const premier = importOpenPlans(ovrseeDir)
  assert.equal(premier.length, 2)

  const parPlan = Object.fromEntries(readTickets(ovrseeDir).map(t => [t.meta.plan, t.meta.colonne]))
  assert.equal(parPlan['2026-08-01-jamais-commence.md'], 'backlog')
  assert.equal(parPlan['2026-08-02-en-cours.md'], 'en-cours')

  // Second passage : rien de neuf, pas de doublon.
  assert.deepEqual(importOpenPlans(ovrseeDir), [])
  assert.equal(readTickets(ovrseeDir).length, 2)
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

// --- epics (type et epic) --------------------------------------------------

test("createTicket accepte un type 'epic'", () => {
  const ovrseeDir = fixture()
  const written = createTicket(ovrseeDir, { titre: 'Mon epic', type: 'epic' })

  assert.equal(written.meta.type, 'epic')

  const [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.type, 'epic')
})

test('createTicket refuse un type invalide', () => {
  const ovrseeDir = fixture()
  assert.throws(() => createTicket(ovrseeDir, { titre: 'X', type: 'roadmap' }), /type/)
})

test('createTicket accepte un epic parent', () => {
  const ovrseeDir = fixture()
  const epic = createTicket(ovrseeDir, { titre: 'Epic', type: 'epic' })
  const enfant = createTicket(ovrseeDir, { titre: 'Enfant', epic: epic.meta.id })

  assert.equal(enfant.meta.epic, epic.meta.id)

  const tickets = readTickets(ovrseeDir)
  assert.equal(tickets.find(t => t.meta.id === enfant.meta.id).meta.epic, epic.meta.id)
})

test('createTicket refuse un epic invalide', () => {
  const ovrseeDir = fixture()
  assert.throws(() => createTicket(ovrseeDir, { titre: 'X', epic: 'pas-un-id' }), /epic/)
  assert.throws(() => createTicket(ovrseeDir, { titre: 'X', epic: 'T-999-trop-long' }), /epic/)
})

test('updateTicket peut changer type et epic', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Avant' })

  updateTicket(ovrseeDir, file, { type: 'epic' })

  let [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.type, 'epic')

  const epic = createTicket(ovrseeDir, { titre: 'Parent', type: 'epic' })
  updateTicket(ovrseeDir, file, { epic: epic.meta.id })

  ticket = readTickets(ovrseeDir).find(t => t.meta.id === ticket.meta.id)
  assert.equal(ticket.meta.epic, epic.meta.id)
})

test('updateTicket peut détacher un enfant en mettant epic à null', () => {
  const ovrseeDir = fixture()
  const epic = createTicket(ovrseeDir, { titre: 'Parent', type: 'epic' })
  const { file, meta } = createTicket(ovrseeDir, { titre: 'Enfant', epic: epic.meta.id })

  updateTicket(ovrseeDir, file, { epic: null })

  const ticket = readTickets(ovrseeDir).find(t => t.meta.id === meta.id)
  assert.equal(ticket.meta.epic, undefined)
})

test('updateTicket peut retirer le type epic', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Était epic', type: 'epic' })

  updateTicket(ovrseeDir, file, { type: null })

  const [ticket] = readTickets(ovrseeDir)
  assert.equal(ticket.meta.type, undefined)
})

test("childrenOf retourne les enfants d'un epic triés", () => {
  const ovrseeDir = fixture()
  const epic = createTicket(ovrseeDir, { titre: 'Epic', type: 'epic' })
  const enfant1 = createTicket(ovrseeDir, { titre: 'Enfant 1', epic: epic.meta.id, priorite: 'moyenne' })
  const enfant2 = createTicket(ovrseeDir, { titre: 'Enfant 2', epic: epic.meta.id, priorite: 'haute' })
  createTicket(ovrseeDir, { titre: 'Autre' })

  const tickets = readTickets(ovrseeDir)
  const children = childrenOf(tickets, epic.meta.id)

  assert.equal(children.length, 2)
  // T-enfant2 (haute) avant T-enfant1 (moyenne)
  assert.equal(children[0].meta.titre, 'Enfant 2')
  assert.equal(children[1].meta.titre, 'Enfant 1')
})

test('childrenOf retourne une liste vide si epic inexistant', () => {
  const ovrseeDir = fixture()
  const tickets = readTickets(ovrseeDir)
  const children = childrenOf(tickets, 'T-999')
  assert.deepEqual(children, [])
})

test("orphanChildren détecte les enfants pointant un epic inexistant", () => {
  const ovrseeDir = fixture()
  const epic = createTicket(ovrseeDir, { titre: 'Epic', type: 'epic' })
  const enfantVrai = createTicket(ovrseeDir, { titre: 'Enfant vrai', epic: epic.meta.id })
  const enfantOrphelin = createTicket(ovrseeDir, { titre: 'Orphelin', epic: 'T-999' })
  createTicket(ovrseeDir, { titre: 'Ordinaire' })

  const tickets = readTickets(ovrseeDir)
  const orphans = orphanChildren(tickets)

  assert.equal(orphans.length, 1)
  assert.equal(orphans[0].meta.titre, 'Orphelin')
})
