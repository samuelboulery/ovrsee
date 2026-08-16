import assert from 'node:assert/strict'
import test from 'node:test'

import type { Snapshot } from './data'
import {
  PEREMPTION_MS,
  compteEnAttente,
  composer,
  estDecidable,
  estPerime,
  resumeProjet,
  type MenuBarAttention,
  type MenuBarOuverte,
} from './menubar'

const T0 = 1_700_000_000_000

const ouverte = (over: Partial<MenuBarOuverte> = {}): MenuBarOuverte => ({
  sessionKey: '/p/un#claude',
  ptyId: 'pty-1',
  projet: '/p/un',
  nom: 'un',
  ...over,
})

const attention = (over: Partial<MenuBarAttention> = {}): MenuBarAttention => ({
  kind: 'question',
  detail: null,
  at: T0,
  ...over,
})

const cles = (sessions: readonly { sessionKey: string }[]) => sessions.map(s => s.sessionKey)

test('menubar : une session ouverte sans signal apparaît quand même', () => {
  // Le défaut du premier jet : elle était invisible, et le popover annonçait
  // « aucune session » pendant qu'elle tournait.
  const [session] = composer([ouverte()], {})

  assert.equal(session.sessionKey, '/p/un#claude')
  assert.equal(session.attention, null)
  assert.equal(estDecidable(session, T0), false, 'rien à décider tant que rien n’est demandé')
})

test('menubar : un signal se raccroche à sa session', () => {
  const [session] = composer([ouverte()], {
    '/p/un#claude': attention({ detail: 'permission to use Bash' }),
  })

  assert.equal(session.attention?.detail, 'permission to use Bash')
  assert.equal(estDecidable(session, T0), true)
})

test('menubar : un signal sans session ouverte n’existe pas', () => {
  // `ouvertes` décide seule de ce qui existe. Une session fermée emporte son
  // attente : sans quoi sa carte resterait cliquable sur un pty mort.
  assert.deepEqual(composer([], { '/p/un#claude': attention() }), [])
})

test('menubar : les attentes passent devant, puis les plus récentes', () => {
  const sessions = composer(
    [
      ouverte({ sessionKey: '/p/muet#claude', ptyId: 'pty-3', nom: 'muet' }),
      ouverte({ sessionKey: '/p/vieux#claude', ptyId: 'pty-1', nom: 'vieux' }),
      ouverte({ sessionKey: '/p/recent#claude', ptyId: 'pty-2', nom: 'recent' }),
      ouverte({ sessionKey: '/p/fini#claude', ptyId: 'pty-4', nom: 'fini' }),
    ],
    {
      '/p/vieux#claude': attention({ at: T0 }),
      '/p/recent#claude': attention({ at: T0 + 1000 }),
      '/p/fini#claude': attention({ kind: 'stop', at: T0 + 5000 }),
    },
  )

  assert.deepEqual(cles(sessions), [
    '/p/recent#claude',
    '/p/vieux#claude',
    '/p/fini#claude',
    '/p/muet#claude',
  ])
})

test('menubar : deux sessions muettes gardent le même ordre d’un rendu à l’autre', () => {
  // Sans clé stable, elles danseraient à chaque publication.
  const entree = [
    ouverte({ sessionKey: '/p/zeta#claude', ptyId: 'pty-2', nom: 'zeta' }),
    ouverte({ sessionKey: '/p/alpha#claude', ptyId: 'pty-1', nom: 'alpha' }),
  ]

  assert.deepEqual(cles(composer(entree, {})), ['/p/alpha#claude', '/p/zeta#claude'])
  assert.deepEqual(cles(composer([...entree].reverse(), {})), ['/p/alpha#claude', '/p/zeta#claude'])
})

test('menubar : une attente périme, un stop n’est jamais décidable', () => {
  const [attend] = composer([ouverte()], { '/p/un#claude': attention() })

  assert.equal(estPerime(attend, T0 + PEREMPTION_MS - 1), false)
  assert.equal(estPerime(attend, T0 + PEREMPTION_MS + 1), true)
  assert.equal(
    estDecidable(attend, T0 + PEREMPTION_MS + 1),
    false,
    'périmée : on n’autorise pas une demande qu’on n’a pas lue',
  )

  const [fini] = composer([ouverte()], { '/p/un#claude': attention({ kind: 'stop' }) })
  assert.equal(estDecidable(fini, T0), false, 'un « c’est à toi » n’appelle pas de décision')
  assert.equal(estPerime(composer([ouverte()], {})[0], T0), false, 'une muette ne périme pas')
})

test('menubar : le compte n’allume l’icône que pour ce qui est décidable', () => {
  const sessions = composer(
    [
      ouverte({ sessionKey: '/p/un#claude' }),
      ouverte({ sessionKey: '/p/deux#claude', ptyId: 'pty-2', nom: 'deux' }),
      ouverte({ sessionKey: '/p/trois#claude', ptyId: 'pty-3', nom: 'trois' }),
    ],
    {
      '/p/un#claude': attention(),
      '/p/deux#claude': attention({ kind: 'stop' }),
      '/p/trois#claude': attention({ at: T0 - PEREMPTION_MS - 1 }),
    },
  )

  assert.equal(compteEnAttente(sessions, T0), 1)
  assert.equal(compteEnAttente([], T0), 0)
})

// --- le résumé de projet ---------------------------------------------------

const snapshot = (patch: Record<string, unknown> = {}): Snapshot =>
  ({
    root: '/Users/sam/code/ovrsee',
    packageJson: null,
    plans: [],
    activePlans: [],
    tickets: [],
    board: [],
    scans: [],
    gitStatus: { branch: 'main', dirty: { staged: 1, unstaged: 2, untracked: 3, files: [] }, branches: [], lastFetch: null },
    ...patch,
  }) as unknown as Snapshot

test('menubar : sans instantané, pas de résumé', () => {
  assert.equal(resumeProjet(null), null)
  assert.equal(resumeProjet(snapshot({ root: '' })), null)
})

test('menubar : le résumé nomme le plan actif et compte ce qui reste', () => {
  const plans = [
    { file: 'a.md', status: 'open', title: 'Le plan actif', opened: '2026-08-14', closed: null, commits: [], body: '' },
    { file: 'b.md', status: 'open', title: 'Un autre', opened: '2026-08-01', closed: null, commits: [], body: '' },
  ]
  const resume = resumeProjet(snapshot({ plans, activePlans: ['a.md'] }))

  assert.equal(resume?.nom, 'ovrsee', 'le nom du dossier à défaut de package.json')
  assert.equal(resume?.planActif, 'Le plan actif')
  assert.equal(resume?.branche, 'main')
  assert.equal(resume?.fichiersModifies, 6, 'staged + unstaged + untracked')
})

test('menubar : sans plan actif désigné, le plan ouvert le plus récent fait foi', () => {
  const plans = [
    { file: 'vieux.md', status: 'open', title: 'Vieux', opened: '2026-08-01', closed: null, commits: [], body: '' },
    { file: 'neuf.md', status: 'open', title: 'Neuf', opened: '2026-08-14', closed: null, commits: [], body: '' },
  ]

  assert.equal(resumeProjet(snapshot({ plans }))?.planActif, 'Neuf')
  assert.equal(resumeProjet(snapshot())?.planActif, null, 'aucun plan ouvert, aucun titre')
})

test('menubar : un scan en échec ne compte pas comme dernier scan', () => {
  // Il ne dit rien de l'état des pages ; l'afficher comme tel mentirait.
  const rate = [{ date: '2026-08-14', commit: 'abc', ok: false }]
  const reussi = [{ date: '2026-08-13', commit: 'abc', ok: true, pages: 7 }]

  assert.equal(resumeProjet(snapshot({ scans: rate }))?.dernierScan, null)
  assert.equal(resumeProjet(snapshot({ scans: reussi }))?.dernierScan, '2026-08-13')
})

test('menubar : le nom du paquet prime sur celui du dossier', () => {
  assert.equal(resumeProjet(snapshot({ packageJson: { name: 'mon-paquet' } }))?.nom, 'mon-paquet')
})

test('menubar : un instantané dégradé ne fait pas lever', () => {
  // Même exigence que le reste de `data.ts` : un champ manquant rend un écran
  // vide, jamais une exception.
  const nu = { root: '/p/nu' } as unknown as Snapshot
  const resume = resumeProjet(nu)

  assert.equal(resume?.branche, null)
  assert.equal(resume?.fichiersModifies, 0)
  assert.equal(resume?.ticketsRestants, 0)
  assert.equal(resume?.dernierScan, null)
})
