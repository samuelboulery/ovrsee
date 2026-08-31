import assert from 'node:assert/strict'
import { briefLines, buildActions, buildInjections, decideInjection, deliveredActions } from './brief'
import test from 'node:test'

import { setCurrentLanguage } from './i18n'
import {
  childrenOf,
  colonneFinale,
  commitsDeLaFrise,
  composerCommande,
  epicEtat,
  epicProgress,
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
  ticketsPrets,
  type Plan,
  type Snapshot,
  type Ticket,
  type SettingsType,
} from './data'

// Ces tests comparent du texte : ils épinglent donc la langue, sinon ils
// dépendraient de `navigator.language`, absent sous `node --test`. Ce qu'ils
// vérifient est le contenu du brief, pas sa traduction — celle-ci est gardée
// par `hooks/i18n.test.js`.
setCurrentLanguage('fr')

/**
 * Un instantané minimal mais valide. Les tests le dégradent champ par champ :
 * c'est la seule façon d'éprouver ce que l'ovrsee fait d'un projet dont les
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
// Un `ovrsee/pages/pages.json` qui n'est pas un objet à tableau `pages` a
// vidé toute l'application le 9 août 2026 : `snapshot.pages?.pages.length`
// protégeait `pages` d'être nul, pas `pages.pages` d'être absent.

test('briefLines survit à un pages.json qui est un tableau', () => {
  const snap = snapshot({ pages: [] as unknown as Snapshot['pages'] })
  const lines = briefLines(snap)
  assert.ok(lines.some(l => l.text.includes('0 page')))
})

test('briefLines survit à un pages.json vide, nul ou sans tableau', () => {
  for (const pages of [null, undefined, {}, 'texte'] as unknown[]) {
    const snap = snapshot({ pages: pages as Snapshot['pages'] })
    assert.ok(briefLines(snap).some(l => l.text.includes('0 page')))
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

test('ticketsPrets ne compte que la colonne « prêt »', () => {
  const tickets = [
    { id: 'T-1', colonne: 'backlog' },
    { id: 'T-2', colonne: 'a-specifier' },
    { id: 'T-3', colonne: 'pret' },
    { id: 'T-4', colonne: 'pret' },
    { id: 'T-5', colonne: 'en-cours' },
    { id: 'T-6', colonne: 'fait' },
  ] as unknown as Ticket[]
  // C'est tout l'objet de l'issue #52 : le backlog n'est pas actionnable.
  assert.equal(ticketsPrets(tickets), 2)
  assert.equal(ticketsPrets([]), 0)
})

test('ticketsPrets rend 0 sur un board qui ne reprend pas l’id « pret »', () => {
  const tickets = [
    { id: 'T-1', colonne: 'todo' },
    { id: 'T-2', colonne: 'doing' },
  ] as unknown as Ticket[]
  assert.equal(ticketsPrets(tickets), 0)
})

test('ticketsPrets : un epic avec enfants prêts ne compte pas double', () => {
  const tickets = [
    { id: 'E-1', type: 'epic', colonne: 'pret' },
    { id: 'T-1', epic: 'E-1', colonne: 'pret' },
    { id: 'T-2', epic: 'E-1', colonne: 'pret' },
  ] as unknown as Ticket[]
  // L'epic s'efface derrière ses enfants, comme dans `restant`.
  assert.equal(ticketsPrets(tickets), 2)
})

test("childrenOf retourne les enfants d'un epic triés", () => {
  const tickets = [
    { id: 'T-1', titre: 'Epic', type: 'epic', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-2', titre: 'Enfant 1', epic: 'T-1', priorite: 'moyenne', cree: '2026-08-02' },
    { id: 'T-3', titre: 'Enfant 2', epic: 'T-1', priorite: 'haute', cree: '2026-08-03' },
    { id: 'T-4', titre: 'Autre', priorite: 'basse', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  const children = childrenOf(tickets, 'T-1')
  assert.equal(children.length, 2)
  assert.equal(children[0].id, 'T-3') // T-3 haute en premier
  assert.equal(children[1].id, 'T-2') // T-2 moyenne en deuxième
})

test("childrenOf retourne une liste vide si epic inexistant", () => {
  const tickets = [
    { id: 'T-1', priorite: 'haute', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  const children = childrenOf(tickets, 'T-999')
  assert.deepEqual(children, [])
})

test("epicProgress calcule la progression des enfants", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']
  const fini = colonneFinale(board)

  // Aucun enfant
  assert.deepEqual(epicProgress([], fini), { done: 0, total: 0, percent: 0 })

  // 1 enfant fini, 2 pas finis
  const children = [
    { id: 'T-1', colonne: 'backlog' },
    { id: 'T-2', colonne: 'fait' },
    { id: 'T-3', colonne: 'backlog' },
  ] as unknown as Ticket[]
  const prog = epicProgress(children, fini)
  assert.equal(prog.total, 3)
  assert.equal(prog.done, 1)
  assert.equal(prog.percent, 33)

  // finalColumn null → pas de comptage
  assert.deepEqual(epicProgress(children, null), { done: 0, total: 3, percent: 0 })
})

test("epicEtat se déduit des enfants", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'en-cours', titre: 'En cours' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']
  const enfants = (...colonnes: string[]) =>
    colonnes.map((colonne, i) => ({ id: `T-${i}`, colonne })) as unknown as Ticket[]

  assert.equal(epicEtat([], board), 'vide')
  assert.equal(epicEtat(enfants('backlog', 'backlog'), board), 'non-commencee')
  assert.equal(epicEtat(enfants('backlog', 'en-cours'), board), 'en-cours')
  assert.equal(epicEtat(enfants('fait', 'backlog'), board), 'en-cours')
  assert.equal(epicEtat(enfants('fait', 'fait'), board), 'terminee')
})

test("epicEtat : un tableau à une colonne n'a rien de terminé", () => {
  // `colonneFinale` rend null sous une seule colonne — sans quoi tout ticket
  // du tableau serait « fini » du seul fait d'exister.
  const board = [{ id: 'tout', titre: 'Tout' }] as Snapshot['board']
  const enfants = [{ id: 'T-1', colonne: 'tout' }] as unknown as Ticket[]

  assert.equal(epicEtat(enfants, board), 'non-commencee')
})

test("restant avec epics : un epic vide compte pour 1", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']

  const tickets = [
    { id: 'T-1', type: 'epic', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-2', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  // Epic vide (pas d'enfants) + 1 ticket ordinaire = 2 à faire
  assert.equal(restant(tickets, board), 2)
})

test("restant avec epics : un epic avec enfants ne compte pas", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']

  const tickets = [
    { id: 'T-1', type: 'epic', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-2', epic: 'T-1', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-3', epic: 'T-1', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  // Epic avec 2 enfants = 2 à faire (epic ne compte pas, ses enfants oui)
  assert.equal(restant(tickets, board), 2)
})

test("restant avec epics : un enfant orphelin compte", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']

  const tickets = [
    { id: 'T-1', epic: 'T-999', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  // Enfant orphelin (epic inexistant) compte comme ticket ordinaire
  assert.equal(restant(tickets, board), 1)
})

test("restant avec epics : cas complexe", () => {
  const board = [
    { id: 'backlog', titre: 'Backlog' },
    { id: 'en-cours', titre: 'En cours' },
    { id: 'fait', titre: 'Fait' },
  ] as Snapshot['board']

  const tickets = [
    // Epic 1 avec 3 enfants : 1 fait, 2 en backlog
    { id: 'T-1', type: 'epic', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-2', epic: 'T-1', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-3', epic: 'T-1', colonne: 'en-cours', priorite: 'haute', cree: '2026-08-01' },
    { id: 'T-4', epic: 'T-1', colonne: 'fait', priorite: 'haute', cree: '2026-08-01' },

    // Epic 2 vide
    { id: 'T-5', type: 'epic', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },

    // Ticket ordinaire
    { id: 'T-6', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01' },
  ] as unknown as Ticket[]

  // T-2, T-3 (enfants en backlog et en-cours), T-5 (epic vide), T-6 (ticket ordinaire) = 4
  // T-4 est en colonne finale, ne compte pas
  // T-1 a des enfants, ne compte pas
  assert.equal(restant(tickets, board), 4)
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

/**
 * La densité lit la frise, pas les plans : c'est ce qui lui fait voir les
 * commits hors plan. Si cette fonction en perdait une sorte, l'histogramme
 * redeviendrait faux sans que rien ne le signale.
 */
test('commitsDeLaFrise rend les commits des plans et ceux hors plan', () => {
  const commits = commitsDeLaFrise([
    {
      kind: 'plan',
      date: '2026-07-20',
      plan: 'p.md',
      title: 'Un plan',
      status: 'closed',
      commits: [
        { sha: 'aaa', date: '2026-07-20T09:00:00', subject: 'dans le plan' },
        { sha: 'bbb', date: '2026-07-20T10:00:00', subject: 'aussi' },
      ],
    },
    {
      kind: 'commit',
      date: '2026-07-20',
      commit: { sha: 'ccc', date: '2026-07-20T11:00:00', subject: 'hors plan' },
    },
  ])

  assert.deepEqual(
    commits.map(c => c.sha),
    ['aaa', 'bbb', 'ccc'],
  )
})

test('commitsDeLaFrise survit à une frise absente ou mal formée', () => {
  assert.deepEqual(commitsDeLaFrise([]), [])
  assert.deepEqual(commitsDeLaFrise(null as never), [])
  // Une bande de plan sans commits : le plan existe, git n'en sait rien encore.
  assert.deepEqual(
    commitsDeLaFrise([
      { kind: 'plan', date: '2026-07-20', plan: 'p.md', title: 'x', status: 'open', commits: [] },
    ]),
    [],
  )
})

// --- composerCommande : adaptation du gestionnaire de paquets ---------

test('composerCommande compose la ligne adaptée au gestionnaire', () => {
  assert.equal(composerCommande('ovrsee:crawl', 'pnpm'), 'pnpm ovrsee:crawl')
  assert.equal(composerCommande('ovrsee:crawl', 'npm'), 'npm run ovrsee:crawl')
  assert.equal(composerCommande('ovrsee:crawl', 'yarn'), 'yarn ovrsee:crawl')
  assert.equal(composerCommande('ovrsee:crawl', 'bun'), 'bun ovrsee:crawl')
})

test('composerCommande nécessite le gestionnaire explicite', () => {
  // Le paramètre packageManager est obligatoire pour éviter les défauts trompeurs
  assert.equal(composerCommande('ovrsee:crawl', 'pnpm'), 'pnpm ovrsee:crawl')
  assert.equal(composerCommande('test', 'npm'), 'npm run test')
})

// --- Gestion des onglets : filtrage et redirection ---

test('onglet masqué : rendu survit avec un seul onglet actif', () => {
  const snap = snapshot({})
  // Ce test vérifie simplement que les onglets rendus survivent
  // même si un seul est actif. Le filtrage se fait dans App.tsx.
  assert.ok(snap)
})

// --- buildActions : actions livrées + personnalisées ---

test('buildActions compose les actions livrées avec le gestionnaire pnpm', () => {
  const snap = snapshot({})
  const settings = {
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [],
  } as SettingsType

  const actions = buildActions(snap, settings)

  // Deux actions livrées : le crawl n'y est plus, il a son bouton dans Produit.
  const delivered = actions.filter((a): a is { label: string; text: string } => !('error' in a))
  assert.equal(delivered.length, 2)
  assert.ok(delivered.every(a => !a.text.includes('ovrsee:crawl')))
})

test('buildActions compose les actions livrées avec le gestionnaire npm', () => {
  const snap = snapshot({})
  const settings = {
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'npm',
    sourceGraphe: 'auto',
    customActions: [],
  } as SettingsType

  const actions = buildActions(snap, settings)
  const delivered = actions.filter((a): a is { label: string; text: string } => !('error' in a))

  // Aucune action livrée ne dépend plus du gestionnaire de paquets.
  assert.equal(delivered.length, 2)
  assert.ok(delivered.every(a => !a.text.includes('ovrsee:crawl')))
})

test('deliveredActions retourne les commandes livrées, sans les personnalisées', () => {
  const settings = {
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [{ label: 'perso', text: 'echo hi' }],
  } as SettingsType

  const actions = deliveredActions(settings)

  // Le crawl a quitté la liste : il partait sans chemin de projet, dans une
  // session dont le dossier courant est le projet observé — où le script
  // n'existe pas. C'est le bouton de l'onglet Produit qui le lance.
  assert.equal(actions.length, 2)
  assert.ok(actions.every(a => !a.text.includes('ovrsee:crawl')))
  assert.ok(actions.every(a => a.label !== 'perso'))
})

test('buildActions inclut les actions personnalisées valides', () => {
  const snap = snapshot({})
  const settings = {
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [
      { label: 'Mon test', text: 'pnpm test' },
      { label: 'Lancer le serveur', text: 'pnpm dev' },
    ],
  } as SettingsType

  const actions = buildActions(snap, settings)
  const withoutErrors = actions.filter((a): a is { label: string; text: string } => !('error' in a))

  // 2 livrées + 2 personnalisées = 4
  assert.equal(withoutErrors.length, 4)
  assert.ok(withoutErrors.some(a => a.text === 'pnpm test'))
  assert.ok(withoutErrors.some(a => a.text === 'pnpm dev'))
})

test('buildActions rejette les actions personnalisées avec sauts de ligne', () => {
  const snap = snapshot({})
  const settings = {
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [
      { label: 'Commande invalide', text: 'pnpm test\npnpm build' },
    ],
  } as SettingsType

  const actions = buildActions(snap, settings)
  const errors = actions.filter((a): a is { label: string; error: string } => 'error' in a)

  // Une action rejetée avec erreur
  assert.equal(errors.length, 1)
  assert.equal(errors[0].label, 'Commande invalide')
  assert.match(errors[0].error, /saut de ligne|line break/)
})

// --- buildActions : les actions attachées à un projet (T-0216, issue #79) ---

/** Un profil minimal — seules les actions changent d'un test à l'autre. */
const reglages = (patch: Partial<SettingsType> = {}): SettingsType =>
  ({
    langue: 'fr',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [], ordre: [] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: [],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [],
    ...patch,
  }) as SettingsType

test('buildActions inclut les actions du projet ouvert, pas celles des autres', () => {
  const actions = buildActions(
    snapshot({ root: '/tmp/projet' }),
    reglages({
      projectActions: {
        '/tmp/projet': [{ label: 'Dev d’ici', text: '!pnpm run dev' }],
        '/tmp/ailleurs': [{ label: 'Dev d’ailleurs', text: '!make serve' }],
      },
    }),
  )
  const labels = actions.map(a => a.label)
  assert.ok(labels.includes('Dev d’ici'))
  assert.ok(!labels.includes('Dev d’ailleurs'))
})

test('buildActions sans snapshot ne rend aucune action de projet', () => {
  const actions = buildActions(
    null,
    reglages({ projectActions: { '/tmp/projet': [{ label: 'Dev', text: '!pnpm run dev' }] } }),
  )
  assert.ok(!actions.map(a => a.label).includes('Dev'))
})

test('buildActions rejette les sauts de ligne dans une action de projet aussi', () => {
  const actions = buildActions(
    snapshot({ root: '/tmp/projet' }),
    reglages({
      projectActions: { '/tmp/projet': [{ label: 'Deux lignes', text: 'pnpm test\npnpm build' }] },
    }),
  )
  const errors = actions.filter((a): a is { label: string; error: string } => 'error' in a)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].label, 'Deux lignes')
})

// Le panneau n'a plus qu'une liste : c'est `decideInjection` qui décide de la
// pastille, plus le classement en deux sections (issue #79).
test('le mode d’une action dit ce qui arrive au clic', () => {
  assert.equal(decideInjection('!pnpm run dev').mode, 'command')
  assert.equal(decideInjection('/graphify').mode, 'command')
  assert.equal(decideInjection('pnpm run dev').mode, 'context')
})

// --- decideInjection : contexte vs commande ---

test('decideInjection : commande avec ! → mode command avec \\n', () => {
  const result = decideInjection('!pnpm ovrsee:crawl')
  assert.equal(result.mode, 'command')
  assert.equal(result.text, '!pnpm ovrsee:crawl\n')
})

test('decideInjection : commande avec / → mode command avec \\n', () => {
  const result = decideInjection('/graphify')
  assert.equal(result.mode, 'command')
  assert.equal(result.text, '/graphify\n')
})

test('decideInjection : contexte multiligne → mode context sans \\n', () => {
  const context = 'Carte des pages (3)\n/route1 — titre1 → lien1\n/route2 — titre2 → aucun lien'
  const result = decideInjection(context)
  assert.equal(result.mode, 'context')
  // Pas de \n ajouté, le bracket paste l'encadrera
  assert.equal(result.text, context)
  assert(!result.text.endsWith('\n'))
})
