import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildBrief, readCockpit } from './brief.js'
import { serializePlan } from './plans.js'

const NOW = new Date('2026-08-08T12:00:00Z')

const cockpitWith = ({ plans = [], pages = null, scans = [] }) => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'cockpit', 'plans'), { recursive: true })
  mkdirSync(join(dir, 'cockpit', 'pages'), { recursive: true })

  for (const [file, meta, body] of plans) {
    writeFileSync(join(dir, 'cockpit', 'plans', file), serializePlan(meta, body ?? ''))
  }
  if (pages) writeFileSync(join(dir, 'cockpit', 'pages', 'pages.json'), JSON.stringify(pages))
  if (scans.length > 0) {
    writeFileSync(
      join(dir, 'cockpit', 'pages', 'scans.jsonl'),
      scans.map(s => JSON.stringify(s)).join('\n') + '\n',
    )
  }
  return dir
}

// --- lecture ---------------------------------------------------------------

test('readCockpit rend null quand le dépôt n’a pas de dossier cockpit', () => {
  assert.equal(readCockpit(mkdtempSync(join(tmpdir(), 'vide-'))), null)
})

test('readCockpit lit plans, pages et scans', () => {
  const dir = cockpitWith({
    plans: [['2026-08-01-a.md', { status: 'open', title: 'A', opened: '2026-08-01', commits: [] }]],
    pages: { date: '2026-08-08', commit: 'abc1234', pages: [{ route: '/' }] },
    scans: [{ date: '2026-08-08', commit: 'abc1234', ok: true, pages: 1 }],
  })

  const state = readCockpit(dir)
  assert.equal(state.plans.length, 1)
  assert.equal(state.pageCount, 1)
  assert.equal(state.scan.ok, true)
})

test('readCockpit survit à un pages.json corrompu plutôt que de tout perdre', () => {
  const dir = cockpitWith({ plans: [] })
  writeFileSync(join(dir, 'cockpit', 'pages', 'pages.json'), '{ pas du json')

  const state = readCockpit(dir)
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

test('un cockpit vide rend une chaîne vide plutôt qu’un brief creux', () => {
  assert.equal(buildBrief({ name: 'neuf', pageCount: 0, plans: [], scan: null }, NOW), '')
})
