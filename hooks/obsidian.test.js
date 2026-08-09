import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { exportVault, GRAPHE } from './obsidian.js'

/**
 * Un dépôt observé jetable, avec un `cockpit/` complet : un plan clos, un plan
 * ouvert, deux tickets dont un lié, deux pages liées et une capture.
 */
function fixture({ scanOk = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-obsidian-'))
  const cockpitDir = join(root, 'cockpit')
  mkdirSync(join(cockpitDir, 'plans'), { recursive: true })
  mkdirSync(join(cockpitDir, 'tickets'), { recursive: true })
  mkdirSync(join(cockpitDir, 'pages', 'shots', 'accueil'), { recursive: true })

  const plan = (file, meta, body) =>
    writeFileSync(
      join(cockpitDir, 'plans', file),
      `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${body}\n`,
      'utf8',
    )

  plan(
    '2026-08-01-premier-plan.md',
    {
      status: 'closed',
      title: 'Premier plan',
      opened: '2026-08-01',
      closed: '2026-08-02',
      commits: [{ sha: 'abc1234', date: '2026-08-02T10:00:00Z', files: ['app/src/App.tsx'] }],
    },
    '## Contexte\n\nParce que.',
  )

  plan(
    '2026-08-05-second-plan.md',
    { status: 'open', title: 'Second plan', opened: '2026-08-05', closed: null, commits: [] },
    '## Contexte\n\nEncore.',
  )

  const ticket = (file, meta, body) =>
    writeFileSync(
      join(cockpitDir, 'tickets', file),
      `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${body}\n`,
      'utf8',
    )

  ticket(
    'T-0001-lie.md',
    {
      id: 'T-0001',
      titre: 'Ticket lié',
      colonne: 'en-cours',
      priorite: 'haute',
      tags: ['ui', 'test'],
      cree: '2026-08-05',
      maj: '2026-08-06',
      plan: '2026-08-05-second-plan.md',
    },
    '## Critères\n\n- [ ] Marche.',
  )

  ticket(
    'T-0002-fini.md',
    {
      id: 'T-0002',
      titre: 'Ticket "guillemets" et : deux-points',
      colonne: 'fait',
      priorite: 'basse',
      tags: [],
      cree: '2026-08-03',
      maj: '2026-08-04',
      plan: null,
    },
    'Rien de plus.',
  )

  writeFileSync(
    join(cockpitDir, 'pages', 'shots', 'accueil', '2026-08-09-abc1234.png'),
    'png-factice',
    'utf8',
  )

  writeFileSync(
    join(cockpitDir, 'pages', 'pages.json'),
    JSON.stringify({
      date: '2026-08-09',
      commit: 'abc1234',
      pages: [
        {
          route: '/',
          slug: 'accueil',
          title: 'Accueil',
          excerpt: 'La page d’entrée.',
          links: ['/produit'],
          shot: 'shots/accueil/2026-08-09-abc1234.png',
          shotDate: '2026-08-09',
        },
        {
          route: '/produit',
          slug: 'produit',
          title: 'Produit',
          excerpt: 'Les pages.',
          links: [],
          shot: '',
          shotDate: '',
        },
      ],
    }),
    'utf8',
  )

  writeFileSync(
    join(cockpitDir, 'pages', 'scans.jsonl'),
    JSON.stringify({ date: '2026-08-09', commit: 'abc1234', ok: scanOk, pages: 2 }) + '\n',
    'utf8',
  )

  return root
}

const vault = root => join(root, 'cockpit', 'obsidian')
const lire = (root, ...parts) => readFileSync(join(vault(root), ...parts), 'utf8')

/** Le frontmatter, sans les délimiteurs. */
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(match, 'frontmatter absent')
  return match[1]
}

/** Les cibles de tous les wikilinks d'une note, `![[…]]` compris. */
const wikilinks = text =>
  [...text.matchAll(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1].trim())

// --- structure -------------------------------------------------------------

test('l’export produit index, plans, tickets et pages', () => {
  const root = fixture()
  const done = exportVault(root)

  assert.ok(existsSync(join(vault(root), 'index.md')))
  assert.ok(existsSync(join(vault(root), 'plans', '2026-08-01-premier-plan.md')))
  assert.ok(existsSync(join(vault(root), 'tickets', 'T-0001-lie.md')))
  assert.ok(existsSync(join(vault(root), 'pages', 'accueil.md')))
  assert.match(done.join('\n'), /index\.md écrit/)
})

test('la capture est copiée dans le coffre — Obsidian ne lit rien du dehors', () => {
  const root = fixture()
  exportVault(root)

  assert.equal(lire(root, 'shots', 'accueil.png'), 'png-factice')
  assert.ok(wikilinks(lire(root, 'pages', 'accueil.md')).includes('shots/accueil.png'))
})

test('une page sans capture le dit plutôt que de pointer une image absente', () => {
  const root = fixture()
  exportVault(root)

  const note = lire(root, 'pages', 'produit.md')
  assert.match(note, /Aucune capture/)
  assert.ok(!existsSync(join(vault(root), 'shots', 'produit.png')))
})

// --- frontmatter -----------------------------------------------------------

test('le frontmatter est du YAML, pas le JSON du disque', () => {
  const root = fixture()
  exportVault(root)

  const meta = frontmatter(lire(root, 'tickets', 'T-0001-lie.md'))
  assert.match(meta, /^type: "ticket"$/m)
  assert.match(meta, /^colonne: "en-cours"$/m)
  assert.match(meta, /^tags:\n {2}- "ui"\n {2}- "test"$/m)
  assert.ok(!meta.includes('{'), 'du JSON a fui dans le frontmatter')
})

test('une liste vide reste une liste', () => {
  const root = fixture()
  exportVault(root)

  assert.match(frontmatter(lire(root, 'tickets', 'T-0002-fini.md')), /^tags: \[\]$/m)
})

test('guillemets et deux-points d’un titre ne cassent pas le YAML', () => {
  const root = fixture()
  exportVault(root)

  const meta = frontmatter(lire(root, 'tickets', 'T-0002-fini.md'))
  const ligne = meta.split('\n').find(l => l.startsWith('titre: '))
  assert.equal(JSON.parse(ligne.slice('titre: '.length)), 'Ticket "guillemets" et : deux-points')
})

// --- liens -----------------------------------------------------------------

test('tous les wikilinks pointent vers un fichier du coffre', () => {
  const root = fixture()
  exportVault(root)

  const notes = [
    ['index.md'],
    ['plans', '2026-08-05-second-plan.md'],
    ['tickets', 'T-0001-lie.md'],
    ['pages', 'accueil.md'],
  ]

  for (const parts of notes) {
    for (const cible of wikilinks(lire(root, ...parts))) {
      const chemin = join(vault(root), cible.endsWith('.png') ? cible : `${cible}.md`)
      assert.ok(existsSync(chemin), `${parts.join('/')} → ${cible} ne résout pas`)
    }
  }
})

test('un ticket lié cite son plan, et le plan cite son ticket', () => {
  const root = fixture()
  exportVault(root)

  assert.ok(
    wikilinks(lire(root, 'tickets', 'T-0001-lie.md')).includes('plans/2026-08-05-second-plan'),
  )
  assert.ok(
    wikilinks(lire(root, 'plans', '2026-08-05-second-plan.md')).includes('tickets/T-0001-lie'),
  )
})

test('l’index sépare ce qui est ouvert de ce qui reste à faire', () => {
  const root = fixture()
  exportVault(root)

  const index = lire(root, 'index.md')
  assert.match(frontmatter(index), /^plans_ouverts: 1$/m)
  // T-0002 est dans la colonne finale : il ne reste pas à faire.
  assert.match(frontmatter(index), /^tickets_restants: 1$/m)
  assert.ok(wikilinks(index).includes('plans/2026-08-05-second-plan'))
  assert.ok(!wikilinks(index).includes('tickets/T-0002-fini'))
})

// --- scan périmé -----------------------------------------------------------

test('un scan échoué est annoncé sur la note de page', () => {
  const root = fixture({ scanOk: false })
  exportVault(root)

  const note = lire(root, 'pages', 'accueil.md')
  assert.match(note, /dernier scan a échoué/)
  assert.match(note, /2026-08-09/)
  assert.match(frontmatter(note), /^capture_perimee: true$/m)
})

// --- cohabitation avec Graphify --------------------------------------------

test('le dossier de Graphify survit à un second export', () => {
  const root = fixture()
  exportVault(root)

  mkdirSync(join(vault(root), GRAPHE), { recursive: true })
  writeFileSync(join(vault(root), GRAPHE, 'index.md'), '# graphe', 'utf8')
  writeFileSync(join(vault(root), GRAPHE, 'graph.canvas'), '{}', 'utf8')

  exportVault(root)

  assert.equal(lire(root, GRAPHE, 'index.md'), '# graphe')
  assert.ok(existsSync(join(vault(root), GRAPHE, 'graph.canvas')))
  assert.ok(wikilinks(lire(root, 'index.md')).includes(`${GRAPHE}/index`))
})

test('sans graphe, l’index donne la commande au lieu d’un lien mort', () => {
  const root = fixture()
  exportVault(root)

  const index = lire(root, 'index.md')
  assert.ok(!wikilinks(index).includes(`${GRAPHE}/index`))
  assert.match(index, /--obsidian-dir/)
})

// --- réexécution -----------------------------------------------------------

test('un ticket supprimé disparaît du coffre au réexport', () => {
  const root = fixture()
  exportVault(root)
  assert.ok(existsSync(join(vault(root), 'tickets', 'T-0002-fini.md')))

  rmSync(join(root, 'cockpit', 'tickets', 'T-0002-fini.md'))

  exportVault(root)
  assert.ok(!existsSync(join(vault(root), 'tickets', 'T-0002-fini.md')))
})

test('deux pages au même titre de document se distinguent par leur route', () => {
  const root = fixture()
  const pages = join(root, 'cockpit', 'pages', 'pages.json')
  const lu = JSON.parse(readFileSync(pages, 'utf8'))
  // Le cas d'une application à page unique : `document.title` partout pareil.
  for (const page of lu.pages) page.title = 'Cockpit'
  writeFileSync(pages, JSON.stringify(lu), 'utf8')

  exportVault(root)

  const liens = lire(root, 'index.md')
  assert.match(liens, /\[\[pages\/accueil\|Accueil\]\]/)
  assert.match(liens, /\[\[pages\/produit\|Produit\]\]/)
})
