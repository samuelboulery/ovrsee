import assert from 'node:assert/strict'
import test from 'node:test'

import {
  briefLines,
  buildInjections,
  frDate,
  humanAge,
  lastScan,
  layoutGraph,
  pageName,
  planFiles,
  planRejected,
  planWhy,
  plansOuverts,
  restant,
  shotDate,
  sortTickets,
  stackFrom,
  stripMarkdown,
  tablesFrom,
  type Plan,
  type Snapshot,
  type Ticket,
} from './data'

/**
 * Un instantané minimal mais valide. Les tests le dégradent champ par champ :
 * c'est la seule façon d'éprouver ce que le cockpit fait d'un projet dont les
 * fichiers ont mal vieilli, et c'est exactement le cas où il sert.
 */
const snapshot = (patch: Partial<Snapshot> = {}): Snapshot =>
  ({
    root: '/tmp/projet',
    equipped: true,
    plans: [],
    pages: { pages: [], orphanShots: [] },
    scans: [],
    shots: {},
    board: [],
    tickets: [],
    timeline: [],
    graph: null,
    packageJson: null,
    config: null,
    readme: null,
    ...patch,
  }) as unknown as Snapshot

const plan = (patch: Partial<Plan> = {}): Plan =>
  ({
    file: '2026-08-09-un-plan.md',
    title: 'Un plan',
    status: 'open',
    opened: '2026-08-09',
    closed: null,
    body: '',
    commits: [],
    ...patch,
  }) as unknown as Plan

// --- briefLines : le champ `pages` mal formé -------------------------------
//
// Un `cockpit/pages/pages.json` qui n'est pas un objet à tableau `pages` a
// vidé toute l'application le 9 août 2026 : `snapshot.pages?.pages.length`
// protégeait `pages` d'être nul, pas `pages.pages` d'être absent.

test('briefLines survit à un pages.json qui est un tableau', () => {
  const snap = snapshot({ pages: [] as unknown as Snapshot['pages'] })
  const lines = briefLines(snap)
  assert.ok(lines.some(l => l.text.includes('0 page(s)')))
})

test('briefLines survit à un pages.json vide, nul ou sans tableau', () => {
  for (const pages of [null, undefined, {}, 'texte'] as unknown[]) {
    const snap = snapshot({ pages: pages as Snapshot['pages'] })
    assert.ok(briefLines(snap).some(l => l.text.includes('0 page(s)')))
  }
})

test('briefLines survit à des plans et des scans absents', () => {
  const snap = snapshot({
    plans: undefined as unknown as Plan[],
    scans: undefined as unknown as Snapshot['scans'],
  })
  assert.ok(briefLines(snap).some(l => l.text.includes('$ claude')))
})

test('briefLines sans instantané annonce la lecture en cours', () => {
  assert.equal(briefLines(null).length, 1)
})

test('briefLines dit un scan échoué au lieu de le taire', () => {
  const snap = snapshot({
    scans: [{ date: '2026-08-09', ok: false, commit: 'abc1234', error: 'port occupé' }],
  })
  const texte = briefLines(snap)
    .map(l => l.text)
    .join('\n')
  assert.match(texte, /ÉCHOUÉ/)
  assert.match(texte, /port occupé/)
})

// --- buildInjections ------------------------------------------------------

test('buildInjections survit à un pages.json mal formé', () => {
  const snap = snapshot({ pages: [] as unknown as Snapshot['pages'] })
  const blocs = buildInjections(snap)
  assert.equal(blocs[0].label, 'Carte des pages (0)')
})

test('buildInjections survit à une page sans liens', () => {
  const snap = snapshot({
    pages: {
      pages: [{ route: '/', slug: 'accueil', title: 'Accueil' }],
      orphanShots: [],
    } as unknown as Snapshot['pages'],
  })
  assert.match(buildInjections(snap)[0].text, /aucun lien/)
})

test('buildInjections sans instantané ne propose rien', () => {
  assert.deepEqual(buildInjections(null), [])
})

// --- fonctions pures de lecture -------------------------------------------

test('plansOuverts ne retient que les plans au statut ouvert', () => {
  const plans = [
    plan({ status: 'closed', closed: '2026-08-01' }),
    plan({ status: 'open', closed: null }),
  ]
  assert.equal(plansOuverts(plans).length, 1)
})

test('lastScan rend le dernier scan, ou null', () => {
  assert.equal(lastScan([]), null)
  const scans = [
    { date: '2026-08-01', ok: true, commit: 'aaa' },
    { date: '2026-08-09', ok: false, commit: 'bbb' },
  ] as Snapshot['scans']
  assert.equal(lastScan(scans)?.commit, 'bbb')
})

test('frDate et humanAge encaissent une date absente ou illisible', () => {
  for (const valeur of [null, undefined, '', 'pas une date']) {
    assert.equal(typeof frDate(valeur as unknown as string), 'string')
    assert.equal(typeof humanAge(valeur as unknown as string), 'string')
  }
})

test('shotDate lit la date en tête du nom de fichier', () => {
  assert.equal(shotDate('2026-08-09-bb2fc14.png'), '2026-08-09')
})

test('sortTickets trie par priorité, puis du plus récent au plus ancien', () => {
  const t = (id: string, priorite: string, cree: string): Ticket =>
    ({ id, priorite, cree, titre: id, colonne: 'backlog', file: `${id}.md` }) as unknown as Ticket
  const ordre = sortTickets([
    t('T-3', 'basse', '2026-08-01'),
    t('T-2', 'haute', '2026-08-01'),
    t('T-1', 'haute', '2026-08-02'),
  ]).map(x => x.id)
  assert.deepEqual(ordre, ['T-1', 'T-2', 'T-3'])
})

test('restant compte les tickets hors de la dernière colonne', () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']
  const tickets = [
    { id: 'T-1', colonne: 'backlog' },
    { id: 'T-2', colonne: 'fait' },
  ] as unknown as Ticket[]
  assert.equal(restant(tickets, board), 1)
  assert.equal(restant([], board), 0)
  assert.equal(restant(tickets, [] as unknown as Snapshot['board']), 2)
})

test('layoutGraph encaisse une liste de pages vide', () => {
  const { placed, width, height } = layoutGraph([])
  assert.deepEqual(placed, [])
  assert.equal(typeof width, 'number')
  assert.equal(typeof height, 'number')
})

test('pageName retombe sur la route quand le titre manque', () => {
  const pages = [{ route: '/x', slug: 'x', title: '' }] as unknown as Parameters<typeof pageName>[1]
  assert.ok(pageName(pages[0], pages).length > 0)
})

test('stripMarkdown retire les marques sans vider le texte', () => {
  assert.equal(stripMarkdown('**gras** et `code`'), 'gras et code')
})

test('planWhy, planRejected et planFiles encaissent un corps vide', () => {
  const vide = plan({ body: '' })
  assert.equal(typeof planWhy(vide), 'string')
  assert.equal(planRejected(vide), null)
  assert.deepEqual(planFiles(vide), [])
})

test('tablesFrom encaisse un graphe absent', () => {
  assert.deepEqual(tablesFrom(null), [])
})

test('tablesFrom transporte la date déclarée, et ne l’invente pas', () => {
  const rows = tablesFrom({
    nodes: [
      { id: 'coffre', label: 'Commandes', file_type: 'table', declared: '2026-03-12' },
      { id: 'muette', label: 'Clients', file_type: 'table', declared: null },
      { id: 'code', label: 'orders', file_type: 'sql' },
    ],
    links: [],
  })
  const par = Object.fromEntries(rows.map(r => [r.name, r]))

  assert.equal(par.Commandes.declared, '2026-03-12')
  // Déclarée mais non datée : `null`, pas `undefined`.
  assert.equal(par.Clients.declared, null)
  // Venue de Graphify : rien du tout, c'est ce qui la fait afficher une confiance.
  assert.equal('declared' in par.orders, false)
})

test('stackFrom encaisse un package.json absent', () => {
  assert.deepEqual(stackFrom(null), [])
})

test('stackFrom n’attribue une raison que si un WHY: la donne', () => {
  const pkg = { dependencies: { 'node-pty': '1.1.0' }, devDependencies: { vite: '8.0.0' } }
  const rows = stackFrom(pkg, { 'node-pty': 'le seul pty qui compile en arm64.' })

  assert.equal(rows.find(r => r.name === 'node-pty')?.why, 'le seul pty qui compile en arm64.')
  // Le point du ticket : sans WHY:, rien. Pas un plan qui cite le nom.
  assert.equal(rows.find(r => r.name === 'vite')?.why, null)
})
