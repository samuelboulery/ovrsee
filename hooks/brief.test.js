import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildBrief, readOvrsee } from './brief.js'
import { serializePlan } from './plans.js'
import { createTicket } from './tickets.js'

const NOW = new Date('2026-08-08T12:00:00Z')

const ovrseeWith = ({ plans = [], pages = null, scans = [] }) => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-'))
  mkdirSync(join(dir, 'ovrsee', 'plans'), { recursive: true })
  mkdirSync(join(dir, 'ovrsee', 'pages'), { recursive: true })

  for (const [file, meta, body] of plans) {
    writeFileSync(join(dir, 'ovrsee', 'plans', file), serializePlan(meta, body ?? ''))
  }
  if (pages) writeFileSync(join(dir, 'ovrsee', 'pages', 'pages.json'), JSON.stringify(pages))
  if (scans.length > 0) {
    writeFileSync(
      join(dir, 'ovrsee', 'pages', 'scans.jsonl'),
      scans.map(s => JSON.stringify(s)).join('\n') + '\n',
    )
  }
  return dir
}

// --- lecture ---------------------------------------------------------------

test('readOvrsee rend null quand le dépôt n’a pas de dossier ovrsee', () => {
  assert.equal(readOvrsee(mkdtempSync(join(tmpdir(), 'vide-'))), null)
})

test('readOvrsee lit plans, pages et scans', () => {
  const dir = ovrseeWith({
    plans: [['2026-08-01-a.md', { status: 'open', title: 'A', opened: '2026-08-01', commits: [] }]],
    pages: { date: '2026-08-08', commit: 'abc1234', pages: [{ route: '/' }] },
    scans: [{ date: '2026-08-08', commit: 'abc1234', ok: true, pages: 1 }],
  })

  const state = readOvrsee(dir)
  assert.equal(state.plans.length, 1)
  assert.equal(state.pageCount, 1)
  assert.equal(state.scan.ok, true)
})

test('readOvrsee survit à un pages.json corrompu plutôt que de tout perdre', () => {
  const dir = ovrseeWith({ plans: [] })
  writeFileSync(join(dir, 'ovrsee', 'pages', 'pages.json'), '{ pas du json')

  const state = readOvrsee(dir)
  assert.equal(state.pageCount, 0)
  assert.deepEqual(state.plans, [])
})

// --- rédaction du brief ----------------------------------------------------

test('le brief annonce le projet, les pages et le dernier scan', () => {
  const brief = buildBrief(
    {
      name: 'herbier',
      plans: [],
      pageCount: 7,
      scan: { date: '2026-08-08', commit: 'd2f1a3', ok: true, pages: 7 },
    },
    NOW,
  )

  assert.match(brief, /herbier/)
  assert.match(brief, /7 page/)
  assert.match(brief, /d2f1a3/)
})

test('le brief liste les plans ouverts — c’est ce qui restait à faire', () => {
  const brief = buildBrief(
    {
      name: 'herbier',
      pageCount: 0,
      scan: null,
      plans: [
        { file: 'a.md', status: 'open', title: 'Export CSV', opened: '2026-07-18', commits: [] },
        { file: 'b.md', status: 'open', title: 'Mode hors ligne', opened: '2026-06-20', commits: [] },
      ],
    },
    NOW,
  )

  assert.match(brief, /2 plan/)
  assert.match(brief, /Export CSV/)
  assert.match(brief, /Mode hors ligne/)
})

test('le brief cite le dernier plan clos et son intention', () => {
  const brief = buildBrief(
    {
      name: 'herbier',
      pageCount: 0,
      scan: null,
      plans: [
        {
          file: 'a.md',
          status: 'closed',
          title: 'Notes libres',
          opened: '2026-07-10',
          closed: '2026-07-18',
          commits: [],
          body: '## Contexte\nLes champs taxonomiques ne suffisaient pas.\n',
        },
      ],
    },
    NOW,
  )

  assert.match(brief, /Notes libres/)
  assert.match(brief, /taxonomiques/)
})

test('un scan échoué est annoncé, jamais tu', () => {
  const brief = buildBrief(
    {
      name: 'herbier',
      pageCount: 7,
      plans: [],
      scan: { date: '2026-08-08', commit: 'd2f1a3', ok: false, error: 'port occupé' },
    },
    NOW,
  )

  assert.match(brief, /échoué/i)
  assert.match(brief, /port occupé/)
  assert.match(brief, /plus anciennes/, 'il y a 7 captures à périmer, donc l’avertissement vaut')
})

test('un scan échoué sans aucune capture n’avertit pas d’une fraîcheur inexistante', () => {
  const brief = buildBrief(
    {
      name: 'jamais-crawle',
      pageCount: 0,
      plans: [],
      scan: { date: '2026-08-08', commit: 'abc', ok: false, error: 'configuration absente' },
    },
    NOW,
  )

  assert.match(brief, /échoué/i)
  assert.doesNotMatch(
    brief,
    /plus anciennes/,
    'sans carte, parler de captures dépassées ferait croire à une carte périmée',
  )
})

test('le brief reste court : une session ne doit pas commencer par un mur de texte', () => {
  const plans = Array.from({ length: 40 }, (_, i) => ({
    file: `${i}.md`,
    status: 'open',
    title: `Plan numéro ${i} avec un titre délibérément long pour gonfler la sortie`,
    opened: '2026-07-01',
    commits: [],
  }))

  const brief = buildBrief({ name: 'gros', pageCount: 50, plans, scan: null }, NOW)

  assert.ok(brief.split('\n').length <= 16, `trop de lignes : ${brief.split('\n').length}`)
  assert.ok(brief.length <= 1600, `trop de caractères : ${brief.length}`)
  assert.match(brief, /40 plan/, 'le total est dit même si la liste est tronquée')
})

test('un ovrsee vide rend une chaîne vide plutôt qu’un brief creux', () => {
  assert.equal(buildBrief({ name: 'neuf', pageCount: 0, plans: [], scan: null }, NOW), '')
})

// --- tickets ---------------------------------------------------------------

test('readOvrsee lit le tableau du projet', () => {
  const dir = ovrseeWith({ plans: [] })
  createTicket(join(dir, 'ovrsee'), { titre: 'Un ticket', priorite: 'haute' })

  const state = readOvrsee(dir)
  assert.equal(state.tickets.length, 1)
  assert.equal(state.tickets[0].titre, 'Un ticket')
  assert.equal(state.board[0].id, 'backlog')
})

test('le brief annonce les tickets restants, pas ceux de la dernière colonne', () => {
  const brief = buildBrief(
    {
      name: 'projet',
      plans: [],
      pageCount: 0,
      scan: null,
      board: [
        { id: 'backlog', titre: 'Backlog' },
        { id: 'fait', titre: 'Fait' },
      ],
      tickets: [
        { file: 'T-0001-a.md', id: 'T-0001', titre: 'À faire', colonne: 'backlog', priorite: 'haute' },
        { file: 'T-0002-b.md', id: 'T-0002', titre: 'Déjà fait', colonne: 'fait', priorite: 'basse' },
      ],
    },
    NOW,
  )

  assert.match(brief, /1 ticket\(s\) à faire/)
  assert.match(brief, /T-0001 \[haute\] À faire — Backlog/)
  assert.doesNotMatch(brief, /Déjà fait/)
})

test('un ovrsee sans plan ni page mais avec un ticket a quelque chose à dire', () => {
  const brief = buildBrief(
    {
      name: 'projet',
      plans: [],
      pageCount: 0,
      scan: null,
      board: [{ id: 'backlog', titre: 'Backlog' }],
      tickets: [{ file: 'T-0001-a.md', id: 'T-0001', titre: 'Seul', colonne: 'backlog', priorite: 'moyenne' }],
    },
    NOW,
  )

  assert.match(brief, /T-0001/)
})
