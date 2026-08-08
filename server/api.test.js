import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolve } from './api.js'
import { shotPath } from '../hooks/snapshot.js'

const url = path => new URL(path, 'http://localhost')

const projectWithShot = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'cockpit', 'pages', 'shots', 'accueil'), { recursive: true })
  writeFileSync(join(dir, 'cockpit', 'pages', 'shots', 'accueil', '2026-08-08-abc.png'), 'png')
  writeFileSync(join(dir, 'secret.txt'), 'ne doit jamais sortir')
  return dir
}

test('une route inconnue rend null pour que l’appelant passe la main', () => {
  assert.equal(resolve(url('/index.html')), null)
  assert.equal(resolve(url('/historique')), null)
})

test('/api/projects place le dépôt courant en tête', () => {
  const dir = projectWithShot()
  const result = resolve(url('/api/projects'), dir)

  assert.ok(result && 'json' in result)
  assert.equal(result.json[0].path, dir)
})

test('/api/project rend le snapshot du projet demandé', () => {
  const dir = projectWithShot()
  const result = resolve(url(`/api/project?path=${encodeURIComponent(dir)}`), dir)

  assert.ok(result && 'json' in result)
  assert.equal(result.json.root, dir)
  assert.deepEqual(result.json.plans, [])
})

test('/api/project refuse un chemin non enregistré plutôt que de lire le disque', () => {
  const dir = projectWithShot()
  const result = resolve(url('/api/project?path=%2Fetc'), dir)

  assert.equal(result.status, 404)
})

test('/api/shot sert une capture du projet', () => {
  const dir = projectWithShot()
  const result = resolve(
    url(`/api/shot?path=${encodeURIComponent(dir)}&file=shots/accueil/2026-08-08-abc.png`),
    dir,
  )

  assert.ok('file' in result)
  assert.match(result.file, /2026-08-08-abc\.png$/)
})

test('/api/shot ne laisse pas sortir du dossier des captures', () => {
  const dir = projectWithShot()
  for (const evasion of ['../../secret.txt', '../../../etc/passwd', '/etc/passwd']) {
    const result = resolve(
      url(`/api/shot?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(evasion)}`),
      dir,
    )
    assert.equal(result.status, 404, `devrait refuser ${evasion}`)
  }
})

test('shotPath refuse la traversée et accepte un chemin légitime', () => {
  const dir = projectWithShot()

  assert.equal(shotPath(dir, '../../secret.txt'), null)
  assert.equal(shotPath(dir, 'shots/inexistant.png'), null)
  assert.ok(shotPath(dir, 'shots/accueil/2026-08-08-abc.png'))
})

// --- écriture du registre ---------------------------------------------------

// Même précaution que dans hooks/plans.test.js : le registre réel est celui de
// la machine, ces tests ne doivent pas y toucher.
const withRegistry = () => {
  process.env.COCKPIT_REGISTRY = join(mkdtempSync(join(tmpdir(), 'cockpit-reg-')), 'projects.json')
}

const post = (body, cwd = null, headers = { 'x-cockpit': '1' }) =>
  resolve(url('/api/projects'), cwd, { method: 'POST', headers, body })

test('POST /api/projects sans l’en-tête X-Cockpit est refusé', () => {
  withRegistry()
  const result = post({ action: 'add', path: '/tmp' }, null, {})

  assert.equal(result.status, 403)
})

test('POST add refuse ce qui n’est pas un dossier réel et absolu', () => {
  withRegistry()

  const fichier = join(projectWithShot(), 'secret.txt')
  for (const mauvais of ['relatif/chemin', '/nexiste/pas/du/tout', fichier, '', null]) {
    assert.equal(post({ action: 'add', path: mauvais }).status, 400, `devrait refuser ${mauvais}`)
  }
})

test('POST add enregistre le dossier et le rend en tête', () => {
  withRegistry()
  const dir = projectWithShot()

  const result = post({ action: 'add', path: dir })
  assert.equal(result.status, undefined)
  assert.equal(result.json.projects[0].path, dir)
})

test('POST remove retire, et refuse un projet jamais enregistré', () => {
  withRegistry()
  const dir = projectWithShot()

  assert.equal(post({ action: 'remove', path: dir }).status, 404)

  post({ action: 'add', path: dir })
  assert.deepEqual(post({ action: 'remove', path: dir }).json.projects, [])
})

test('POST touch remonte un projet connu, ignore un inconnu', () => {
  withRegistry()
  const [ancien, recent] = [projectWithShot(), projectWithShot()]

  post({ action: 'add', path: ancien })
  post({ action: 'add', path: recent })
  assert.equal(post({ action: 'touch', path: '/etc' }).status, 404)

  const result = post({ action: 'touch', path: ancien })
  assert.equal(result.json.projects[0].path, ancien)
})

test('POST refuse une action inconnue plutôt que de deviner', () => {
  withRegistry()
  assert.equal(post({ action: 'drop', path: '/tmp' }).status, 400)
  assert.equal(post(null).status, 400)
})

test('POST init refuse un dossier qui n’est pas un dépôt git', () => {
  withRegistry()
  const dir = projectWithShot()
  post({ action: 'add', path: dir })

  // Hors dépôt git, rattacher les commits aux plans n'a pas de sens : la route
  // le dit au lieu d'installer un hook qui ne servira jamais.
  assert.equal(post({ action: 'init', path: dir }).status, 400)
})
