import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
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

// --- /api/tickets ----------------------------------------------------------

const postTicket = (body, headers = { 'x-cockpit': '1' }) =>
  resolve(url('/api/tickets'), null, { method: 'POST', headers, body })

/** Un projet enregistré, prêt à recevoir des tickets. */
const projetEnregistre = () => {
  withRegistry()
  const dir = projectWithShot()
  post({ action: 'add', path: dir })
  return dir
}

test('POST /api/tickets sans l’en-tête X-Cockpit est refusé', () => {
  const dir = projetEnregistre()
  assert.equal(postTicket({ action: 'create', path: dir, titre: 'X' }, {}).status, 403)
})

test('/api/tickets refuse un projet hors registre', () => {
  projetEnregistre()
  assert.equal(postTicket({ action: 'create', path: '/etc', titre: 'X' }).status, 404)
  assert.equal(resolve(url('/api/tickets?path=%2Fetc'), null).status, 404)
})

test('/api/tickets crée puis déplace un ticket', () => {
  const dir = projetEnregistre()

  const cree = postTicket({ action: 'create', path: dir, titre: 'Premier' })
  assert.equal(cree.json.tickets.length, 1)
  assert.equal(cree.json.tickets[0].colonne, 'backlog')
  assert.equal(cree.json.board[0].id, 'backlog')

  const file = cree.json.tickets[0].file
  const bouge = postTicket({ action: 'move', path: dir, file, colonne: 'pret' })
  assert.equal(bouge.json.tickets[0].colonne, 'pret')
})

test('/api/tickets remonte les refus du modèle en 400', () => {
  const dir = projetEnregistre()

  assert.equal(postTicket({ action: 'create', path: dir, titre: '  ' }).status, 400)
  assert.equal(postTicket({ action: 'create', path: dir, titre: 'X', colonne: 'nulle-part' }).status, 400)
  assert.equal(postTicket({ action: 'move', path: dir, file: '../plans/x.md', colonne: 'pret' }).status, 400)
  assert.equal(postTicket({ action: 'bidon', path: dir }).status, 400)
})

test('/api/tickets rend 404 sur un fichier de ticket qui n’existe pas', () => {
  const dir = projetEnregistre()
  assert.equal(postTicket({ action: 'move', path: dir, file: 'T-9999-absent.md', colonne: 'pret' }).status, 404)
  assert.equal(postTicket({ action: 'delete', path: dir, file: 'T-9999-absent.md' }).status, 404)
})

test('/api/tickets supprime un ticket', () => {
  const dir = projetEnregistre()
  const file = postTicket({ action: 'create', path: dir, titre: 'Jetable' }).json.tickets[0].file

  assert.deepEqual(postTicket({ action: 'delete', path: dir, file }).json.tickets, [])
})

test('/api/tickets édite les colonnes du tableau', () => {
  const dir = projetEnregistre()

  const ajoutee = postTicket({ action: 'column-add', path: dir, titre: 'Bloqué', apres: 'pret' })
  assert.deepEqual(
    ajoutee.json.board.map(c => c.id),
    ['backlog', 'a-specifier', 'pret', 'bloque', 'en-cours', 'revue', 'fait'],
  )

  const renommee = postTicket({ action: 'column-rename', path: dir, id: 'bloque', titre: 'En attente' })
  assert.equal(renommee.json.board.find(c => c.id === 'bloque').titre, 'En attente')

  const decalee = postTicket({ action: 'column-reorder', path: dir, id: 'bloque', index: 0 })
  assert.equal(decalee.json.board[0].id, 'bloque')

  const retiree = postTicket({ action: 'column-remove', path: dir, id: 'bloque' })
  assert.equal(retiree.json.board.some(c => c.id === 'bloque'), false)
})

test('/api/tickets reloge les tickets d’une colonne retirée', () => {
  const dir = projetEnregistre()
  const file = postTicket({ action: 'create', path: dir, titre: 'Déménage', colonne: 'revue' }).json
    .tickets[0].file

  // Sans destination, on refuse plutôt que de laisser un ticket citer une
  // colonne disparue.
  assert.equal(postTicket({ action: 'column-remove', path: dir, id: 'revue' }).status, 400)

  const apres = postTicket({ action: 'column-remove', path: dir, id: 'revue', vers: 'fait' })
  assert.equal(apres.json.tickets.find(t => t.file === file).colonne, 'fait')
})

// --- /api/skills -----------------------------------------------------------

const postSkills = (body, headers = { 'x-cockpit': '1' }) =>
  resolve(url('/api/skills'), null, { method: 'POST', headers, body })

test('GET /api/skills rend le catalogue', () => {
  process.env.COCKPIT_SKILLS_DIR = mkdtempSync(join(tmpdir(), 'cockpit-skills-api-'))
  const result = resolve(url('/api/skills'))

  assert.ok(result && 'json' in result)
  assert.ok(result.json.some(s => s.nom === 'cockpit-tickets'))
  assert.equal(result.json.every(s => typeof s.installe === 'boolean'), true)
})

test('POST /api/skills sans l’en-tête X-Cockpit est refusé', () => {
  assert.equal(postSkills({ noms: ['cockpit'] }, {}).status, 403)
})

test('POST /api/skills installe et rend le catalogue à jour', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-skills-api-'))
  process.env.COCKPIT_SKILLS_DIR = dir

  const result = postSkills({ noms: ['cockpit-tickets'] })

  assert.match(result.json.done.join('\n'), /installé/)
  assert.equal(result.json.skills.find(s => s.nom === 'cockpit-tickets').aJour, true)
})

test('POST /api/skills ignore un nom hors catalogue sans rien écrire', () => {
  process.env.COCKPIT_SKILLS_DIR = mkdtempSync(join(tmpdir(), 'cockpit-skills-api-'))
  const result = postSkills({ noms: ['../evasion'] })

  assert.match(result.json.done.join('\n'), /inconnu du catalogue/)
})

// --- /api/projects : export Obsidian ---------------------------------------

test('POST /api/projects export-obsidian écrit le coffre', () => {
  const dir = projetEnregistre()
  const result = post({ action: 'export-obsidian', path: dir })

  assert.ok(result.json.done.some(l => /index\.md écrit/.test(l)))
  assert.ok(existsSync(join(dir, 'cockpit', 'obsidian', 'index.md')))
})

test('POST /api/projects export-obsidian refuse un projet inconnu', () => {
  assert.equal(post({ action: 'export-obsidian', path: '/etc' }).status, 404)
})

// --- préférences --------------------------------------------------------

test('GET /api/settings sans projet rend le profil global', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  const result = resolve(url('/api/settings'), dir)

  assert.ok(result && 'json' in result)
  assert.equal(result.status, undefined)
  assert.equal(result.json.langue, 'fr')
  assert.equal(result.json.theme, 'auto')

  delete process.env.COCKPIT_SETTINGS
})

test('GET /api/settings refuse un projet inconnu', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  const result = resolve(url('/api/settings?path=%2Fetc'), dir)

  assert.equal(result.status, 404)
  assert.equal(result.json.error, 'inconnu')

  delete process.env.COCKPIT_SETTINGS
})

test('GET /api/settings fusionne global + projet', () => {
  const dir = projectWithShot()
  const settingsDir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(settingsDir, 'settings.json')

  // Créer un cockpit.config.json du projet
  writeFileSync(join(dir, 'cockpit.config.json'), JSON.stringify({ onglets: { actifs: ['apercu'] } }))

  const result = resolve(
    url(`/api/settings?path=${encodeURIComponent(dir)}`),
    dir,
  )

  assert.ok(result && 'json' in result)
  assert.deepEqual(result.json.onglets.actifs, ['apercu'])
  assert.equal(result.json.langue, 'fr')

  delete process.env.COCKPIT_SETTINGS
})

test('POST /api/settings vérifie X-Cockpit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  const result = resolve(
    url('/api/settings'),
    dir,
    { method: 'POST', headers: {}, body: { langue: 'en' } },
  )

  assert.equal(result.status, 403)
  assert.equal(result.json.error, 'en-tête X-Cockpit manquant')

  delete process.env.COCKPIT_SETTINGS
})

test('POST /api/settings valide et écrit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  const result = resolve(
    url('/api/settings'),
    dir,
    { method: 'POST', headers: { 'x-cockpit': '1' }, body: { langue: 'en', theme: 'dark' } },
  )

  assert.ok(result && 'json' in result)
  assert.equal(result.json.langue, 'en')
  assert.equal(result.json.theme, 'dark')

  delete process.env.COCKPIT_SETTINGS
})

test('POST /api/settings rejette les valeurs invalides', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  const result = resolve(
    url('/api/settings'),
    dir,
    { method: 'POST', headers: { 'x-cockpit': '1' }, body: { langue: 'de', theme: 42 } },
  )

  assert.ok(result && 'json' in result)
  assert.equal(result.json.langue, 'fr')
  assert.equal(result.json.theme, 'auto')

  delete process.env.COCKPIT_SETTINGS
})

test('POST /api/settings partiel préserve les champs non transmis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  process.env.COCKPIT_SETTINGS = join(dir, 'settings.json')

  // Écrire d'abord un état avec langue en anglais
  let result = resolve(
    url('/api/settings'),
    dir,
    { method: 'POST', headers: { 'x-cockpit': '1' }, body: { langue: 'en' } },
  )
  assert.equal(result.json.langue, 'en')

  // POST partiel : juste theme
  result = resolve(
    url('/api/settings'),
    dir,
    { method: 'POST', headers: { 'x-cockpit': '1' }, body: { theme: 'dark' } },
  )

  // Vérifier que langue n'a pas changé, que theme a changé, onglets intacts
  assert.equal(result.json.langue, 'en')
  assert.equal(result.json.theme, 'dark')
  assert.deepEqual(result.json.onglets.actifs, ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'])

  delete process.env.COCKPIT_SETTINGS
})
