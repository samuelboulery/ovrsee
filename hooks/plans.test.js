import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  parsePlan,
  serializePlan,
  readPlans,
  backlog,
  history,
  density,
  slugify,
  planFileName,
  writeFileNoFollow,
  isSafePlanFileName,
  updatePlanMeta,
  closeOpenPlans,
  readRegistry,
  registerProject,
  unregisterProject,
  touchProject,
} from './plans.js'

import { projects } from './snapshot.js'

// --- parsePlan -------------------------------------------------------------

test('parsePlan lit le frontmatter et rend le corps intact', () => {
  const src = [
    '---',
    '{',
    '  "status": "open",',
    '  "title": "Notes libres sur la fiche plante",',
    '  "opened": "2026-08-08",',
    '  "closed": null,',
    '  "commits": []',
    '}',
    '---',
    '',
    '## Intention',
    'Les champs taxonomiques ne suffisaient pas.',
    '',
  ].join('\n')

  const plan = parsePlan(src)
  assert.equal(plan.meta.status, 'open')
  assert.equal(plan.meta.title, 'Notes libres sur la fiche plante')
  assert.deepEqual(plan.meta.commits, [])
  assert.match(plan.body, /^## Intention/)
  assert.match(plan.body, /taxonomiques/)
})

test('parsePlan rend null sur un fichier sans frontmatter', () => {
  assert.equal(parsePlan('# Un plan sans en-tête\n\ndu texte'), null)
})

test('parsePlan rend null sur un frontmatter illisible plutôt que de jeter', () => {
  assert.equal(parsePlan('---\n{ pas du json\n---\n\ncorps'), null)
  assert.equal(parsePlan('---\n{"status":"open"}\nfrontmatter jamais refermé'), null)
})

test('parsePlan rejette un frontmatter qui n’est pas un objet', () => {
  assert.equal(parsePlan('---\n["open"]\n---\n\ncorps'), null)
  assert.equal(parsePlan('---\nnull\n---\n\ncorps'), null)
})

// --- serializePlan ---------------------------------------------------------

test('serializePlan puis parsePlan restitue la valeur d’origine', () => {
  const meta = {
    status: 'closed',
    title: 'Filtre par famille',
    opened: '2026-07-02',
    closed: '2026-07-04',
    commits: [{ sha: '8ba0e7', date: '2026-07-04', files: ['src/lib/filters.ts'] }],
  }
  const body = '## Intention\nAu-delà de 80 planches, la grille devient inutilisable.\n'

  const plan = parsePlan(serializePlan(meta, body))
  assert.deepEqual(plan.meta, meta)
  assert.equal(plan.body, body)
})

test('serializePlan écrit une clé par ligne pour garder les diffs git lisibles', () => {
  const out = serializePlan({ status: 'open', title: 'X', commits: [] }, 'corps\n')
  const front = out.split('---')[1]
  assert.match(front, /\n  "status": "open",/)
  assert.match(front, /\n  "title": "X",/)
})

// --- readPlans -------------------------------------------------------------

test('readPlans lit le dossier, trie du plus récent au plus ancien et ignore le bruit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const plansDir = join(dir, 'plans')
  mkdirSync(plansDir)

  writeFileSync(
    join(plansDir, '2026-07-02-filtre.md'),
    serializePlan({ status: 'closed', title: 'Filtre', opened: '2026-07-02' }, 'a\n'),
  )
  writeFileSync(
    join(plansDir, '2026-08-08-notes.md'),
    serializePlan({ status: 'open', title: 'Notes', opened: '2026-08-08' }, 'b\n'),
  )
  writeFileSync(join(plansDir, 'README.txt'), 'pas un plan')
  writeFileSync(join(plansDir, 'casse.md'), 'pas de frontmatter du tout')

  const plans = readPlans(dir)
  assert.equal(plans.length, 2)
  assert.equal(plans[0].meta.title, 'Notes')
  assert.equal(plans[1].meta.title, 'Filtre')
  assert.equal(plans[0].file, '2026-08-08-notes.md')
})

test('readPlans rend un tableau vide si le dossier n’existe pas', () => {
  assert.deepEqual(readPlans(join(tmpdir(), 'cockpit-inexistant-' + process.pid)), [])
})

test('readPlans rend un tableau vide si le dossier existe mais est vide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'plans'))
  assert.deepEqual(readPlans(dir), [])
})

// --- updatePlanMeta : seul chemin d'écriture d'un plan existant ------------

test('updatePlanMeta réécrit la meta et laisse le corps intact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'plans'))
  const body = '## Intention\nUn corps qui ne doit pas bouger.\n'
  writeFileSync(
    join(dir, 'plans', 'p.md'),
    serializePlan({ status: 'open', title: 'P', commits: [] }, body),
  )

  const ok = updatePlanMeta(dir, 'p.md', meta => ({ ...meta, status: 'closed', closed: '2026-08-08' }))
  assert.equal(ok, true)

  const plan = parsePlan(readFileSync(join(dir, 'plans', 'p.md'), 'utf8'))
  assert.equal(plan.meta.status, 'closed')
  assert.equal(plan.meta.closed, '2026-08-08')
  assert.equal(plan.meta.title, 'P', 'les clés non touchées survivent')
  assert.equal(plan.body, body)
})

test('updatePlanMeta n’écrit rien quand la transformation renonce', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'plans'))
  const avant = serializePlan({ status: 'open', title: 'P' }, 'corps\n')
  writeFileSync(join(dir, 'plans', 'p.md'), avant)

  assert.equal(updatePlanMeta(dir, 'p.md', () => null), false)
  assert.equal(readFileSync(join(dir, 'plans', 'p.md'), 'utf8'), avant)
})

test('updatePlanMeta rend false sur un plan absent ou illisible', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'plans'))
  writeFileSync(join(dir, 'plans', 'casse.md'), 'pas de frontmatter')

  assert.equal(updatePlanMeta(dir, 'absent.md', m => m), false)
  assert.equal(updatePlanMeta(dir, 'casse.md', m => m), false)
})

// --- dérivations : rien n’est stocké, tout se calcule ----------------------

const P = (status, title, opened, closed, commits = []) => ({
  file: `${opened}-${slugify(title)}.md`,
  meta: { status, title, opened, closed, commits },
  body: '',
})

const SAMPLE = [
  P('open', 'Export CSV', '2026-07-18', null),
  P('closed', 'Notes libres', '2026-07-10', '2026-07-18', [
    { sha: 'd2f1a3', date: '2026-07-18', files: ['src/pages/Plant.tsx'] },
  ]),
  P('open', 'Mode hors ligne', '2026-06-20', null),
  P('closed', 'Lien magique', '2026-06-15', '2026-06-21', [
    { sha: '41c9dd', date: '2026-06-21', files: ['src/auth/magic.ts'] },
  ]),
]

test('backlog = les plans ouverts, du plus récent au plus ancien', () => {
  assert.deepEqual(
    backlog(SAMPLE).map(p => p.meta.title),
    ['Export CSV', 'Mode hors ligne'],
  )
})

test('history = les plans clos, triés par date de clôture décroissante', () => {
  assert.deepEqual(
    history(SAMPLE).map(p => p.meta.title),
    ['Notes libres', 'Lien magique'],
  )
})

test('history trie sur la clôture, pas sur l’ouverture', () => {
  const plans = [
    P('closed', 'Ouvert tôt, clos tard', '2026-01-01', '2026-08-01', []),
    P('closed', 'Ouvert tard, clos tôt', '2026-07-01', '2026-07-02', []),
  ]
  assert.deepEqual(
    history(plans).map(p => p.meta.title),
    ['Ouvert tôt, clos tard', 'Ouvert tard, clos tôt'],
  )
})

test('density compte les commits par semaine, du plus ancien au plus récent', () => {
  const d = density(SAMPLE, { weeks: 6, now: new Date('2026-07-20T00:00:00Z') })
  assert.equal(d.length, 6)
  assert.equal(
    d.reduce((a, b) => a + b, 0),
    2,
    'les deux commits de l’échantillon tombent dans la fenêtre',
  )
  assert.equal(d.at(-1), 1, 'le commit du 18 juil. tombe dans la semaine courante')
})

test('density ignore les commits hors fenêtre au lieu de les empiler sur le premier seau', () => {
  const vieux = [P('closed', 'Antique', '2020-01-01', '2020-01-02', [
    { sha: 'aaa', date: '2020-01-02', files: [] },
  ])]
  const d = density(vieux, { weeks: 4, now: new Date('2026-07-20T00:00:00Z') })
  assert.deepEqual(d, [0, 0, 0, 0])
})

test('density rend une fenêtre de zéros quand il n’y a aucun plan', () => {
  assert.deepEqual(density([], { weeks: 3, now: new Date('2026-07-20T00:00:00Z') }), [0, 0, 0])
})

// --- nommage ---------------------------------------------------------------

test('slugify translittère les accents et ne garde que des caractères de chemin sûrs', () => {
  assert.equal(slugify('Notes libres sur la fiche plante'), 'notes-libres-sur-la-fiche-plante')
  assert.equal(slugify('Détail de l’écran « Export »'), 'detail-de-l-ecran-export')
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd')
  assert.equal(slugify('a/b\\c:d*e?f'), 'a-b-c-d-e-f')
})

test('slugify borne la longueur et ne finit jamais par un tiret', () => {
  const s = slugify('mot '.repeat(60))
  assert.ok(s.length <= 60, `longueur ${s.length}`)
  assert.ok(!s.endsWith('-'))
})

test('slugify rend un repli non vide plutôt qu’une chaîne vide', () => {
  assert.equal(slugify('///'), 'plan')
  assert.equal(slugify(''), 'plan')
})

test('planFileName préfixe par la date pour que le tri alphabétique soit chronologique', () => {
  assert.equal(
    planFileName('Notes libres sur la fiche plante', new Date('2026-08-08T12:00:00Z')),
    '2026-08-08-notes-libres-sur-la-fiche-plante.md',
  )
})

// --- écriture refusant les liens symboliques -------------------------------
// Scénario visé : un dépôt hostile versionne `cockpit/plans` comme lien vers
// ~/.ssh. Le lien est en place dès le git clone.

test('writeFileNoFollow écrit normalement et crée le dossier au besoin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const path = join(dir, 'plans', 'a.md')

  writeFileNoFollow(path, 'contenu')
  assert.equal(readFileSync(path, 'utf8'), 'contenu')
})

test('writeFileNoFollow refuse d’écrire quand le dossier cible est un lien symbolique', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const victime = join(dir, 'victime')
  mkdirSync(victime)
  symlinkSync(victime, join(dir, 'plans'))

  assert.throws(
    () => writeFileNoFollow(join(dir, 'plans', 'a.md'), 'charge'),
    /lien symbolique/,
  )
  assert.deepEqual(readdirSync(victime), [], 'rien n’a été écrit dans la cible du lien')
})

test('writeFileNoFollow refuse d’écrire quand le fichier cible est un lien symbolique', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const victime = join(dir, 'victime.md')
  writeFileSync(victime, 'original')
  symlinkSync(victime, join(dir, 'a.md'))

  assert.throws(() => writeFileNoFollow(join(dir, 'a.md'), 'charge'), /lien symbolique/)
  assert.equal(readFileSync(victime, 'utf8'), 'original', 'la cible du lien est intacte')
})

test('writeFileNoFollow ne laisse pas de fichier temporaire derrière lui', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  writeFileNoFollow(join(dir, 'a.md'), 'contenu')
  assert.deepEqual(readdirSync(dir), ['a.md'])
})

// --- clôture, règle partagée par le hook et le CLI -------------------------

const cockpitWithPlans = entries => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'plans'), { recursive: true })
  for (const [file, meta] of entries) {
    writeFileSync(join(dir, 'plans', file), serializePlan(meta, 'corps\n'))
  }
  return dir
}

test('closeOpenPlans clôt un plan ouvert portant un commit, à la date du dernier', () => {
  const dir = cockpitWithPlans([
    [
      'a.md',
      {
        status: 'open',
        title: 'A',
        opened: '2026-07-01',
        commits: [
          { sha: 'aaa', date: '2026-07-02', files: [] },
          { sha: 'bbb', date: '2026-07-09', files: [] },
        ],
      },
    ],
  ])

  assert.deepEqual(closeOpenPlans(dir), ['a.md'])
  const plan = readPlans(dir)[0]
  assert.equal(plan.meta.status, 'closed')
  assert.equal(plan.meta.closed, '2026-07-09', 'la clôture porte la date du DERNIER commit')
})

test('closeOpenPlans laisse ouvert un plan sans commit — c’est du backlog, pas du travail fait', () => {
  const dir = cockpitWithPlans([['a.md', { status: 'open', title: 'A', opened: '2026-07-01', commits: [] }]])

  assert.deepEqual(closeOpenPlans(dir), [])
  assert.equal(readPlans(dir)[0].meta.status, 'open')
})

test('closeOpenPlans ne retouche pas un plan déjà clos', () => {
  const dir = cockpitWithPlans([
    [
      'a.md',
      {
        status: 'closed',
        title: 'A',
        opened: '2026-07-01',
        closed: '2026-07-02',
        commits: [{ sha: 'aaa', date: '2026-07-09', files: [] }],
      },
    ],
  ])

  assert.deepEqual(closeOpenPlans(dir), [])
  assert.equal(readPlans(dir)[0].meta.closed, '2026-07-02', 'la date d’origine est préservée')
})

test('closeOpenPlans signale et laisse ouvert un plan dont le dernier commit n’a pas de date', () => {
  const dir = cockpitWithPlans([
    ['a.md', { status: 'open', title: 'A', opened: '2026-07-01', commits: [{ sha: 'aaa', files: [] }] }],
  ])

  const messages = []
  assert.deepEqual(closeOpenPlans(dir, m => messages.push(m)), [])
  assert.equal(readPlans(dir)[0].meta.status, 'open')
  assert.match(messages.join(' '), /sans date/)
})

// --- validation du pointeur .active-plan -----------------------------------

test('isSafePlanFileName accepte un nom produit par planFileName', () => {
  assert.ok(isSafePlanFileName(planFileName('Notes libres')))
})

test('isSafePlanFileName rejette tout ce qui peut sortir du dossier plans', () => {
  for (const mauvais of [
    '../../etc/passwd',
    '../secret.md',
    'sous/dossier.md',
    'sous\\dossier.md',
    'a\0b.md',
    '..',
    '.active-plan',
    'sans-extension',
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(isSafePlanFileName(mauvais), false, `devrait rejeter ${JSON.stringify(mauvais)}`)
  }
})

// --- registre des projets ---------------------------------------------------

// Le registre est un vrai fichier dans le dossier personnel : un test qui
// écrirait dedans effacerait la liste de projets de la machine. On le détourne.
const withRegistry = () => {
  process.env.COCKPIT_REGISTRY = join(mkdtempSync(join(tmpdir(), 'cockpit-reg-')), 'projects.json')
  return process.env.COCKPIT_REGISTRY
}

test('registerProject ajoute une fois, avec une date d’ouverture', () => {
  withRegistry()

  assert.equal(registerProject('/tmp/un-projet'), true)
  assert.equal(registerProject('/tmp/un-projet'), false, 'pas de doublon')

  const [entry] = readRegistry()
  assert.equal(entry.path, '/tmp/un-projet')
  assert.equal(entry.name, 'un-projet')
  assert.match(entry.lastOpened, /^\d{4}-\d{2}-\d{2}T/)
})

test('unregisterProject retire le projet et rien d’autre', () => {
  withRegistry()
  registerProject('/tmp/a')
  registerProject('/tmp/b')

  assert.equal(unregisterProject('/tmp/a'), true)
  assert.equal(unregisterProject('/tmp/a'), false, 'un projet absent n’est pas une erreur')
  assert.deepEqual(
    readRegistry().map(p => p.path),
    ['/tmp/b'],
  )
})

test('touchProject date un projet connu, ignore un inconnu', () => {
  withRegistry()
  registerProject('/tmp/a', new Date('2026-01-01T00:00:00Z'))

  assert.equal(touchProject('/tmp/inconnu'), false)
  assert.equal(readRegistry().length, 1, 'un inconnu n’entre pas dans la liste par la petite porte')

  assert.equal(touchProject('/tmp/a', new Date('2026-08-08T10:00:00Z')), true)
  assert.equal(readRegistry()[0].lastOpened, '2026-08-08T10:00:00.000Z')
})

test('projects() classe du dernier ouvert au plus ancien, les sans-date en fin', () => {
  const registry = withRegistry()
  writeFileSync(
    registry,
    JSON.stringify([
      { path: '/tmp/vieux', name: 'vieux', lastOpened: '2026-01-01T00:00:00.000Z' },
      { path: '/tmp/jamais-date', name: 'jamais-date' },
      { path: '/tmp/recent', name: 'recent', lastOpened: '2026-08-08T00:00:00.000Z' },
      { path: '/tmp/jamais-date-2', name: 'jamais-date-2' },
    ]),
  )

  // `null` : pas de dépôt courant, comme dans l'application empaquetée.
  assert.deepEqual(
    projects(null).map(p => p.path),
    ['/tmp/recent', '/tmp/vieux', '/tmp/jamais-date', '/tmp/jamais-date-2'],
  )
})

test('projects() ajoute le dépôt courant en tête seulement s’il est inconnu', () => {
  withRegistry()

  const dir = mkdtempSync(join(tmpdir(), 'cockpit-cwd-'))
  mkdirSync(join(dir, 'cockpit'), { recursive: true })

  assert.equal(projects(dir)[0].path, dir, 'inconnu : en tête, sinon premier lancement vide')

  registerProject('/tmp/autre', new Date('2030-01-01T00:00:00Z'))
  registerProject(dir, new Date('2020-01-01T00:00:00Z'))
  assert.deepEqual(
    projects(dir).map(p => p.path),
    ['/tmp/autre', dir],
    'enregistré : c’est l’usage qui classe',
  )
})
