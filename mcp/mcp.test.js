/**
 * Tests du dispatcher MCP.
 *
 * Utilise node:test + node:assert/strict, tmpdir, COCKPIT_REGISTRY isolé.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { dispatch } from './dispatch.js'

// Isoler le registre du système réel
const withRegistry = () => {
  process.env.COCKPIT_REGISTRY = join(mkdtempSync(join(tmpdir(), 'cockpit-mcp-')), 'projects.json')
}

// Créer un faux registre avec un projet
const registerProject = (path) => {
  const registryPath = process.env.COCKPIT_REGISTRY
  const projects = [{ path, name: 'test', lastOpened: new Date().toISOString() }]
  writeFileSync(registryPath, JSON.stringify(projects, null, 2) + '\n')
}

// Créer un dossier de projet minimal
const projectDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-proj-'))
  mkdirSync(join(dir, 'cockpit', 'pages', 'shots'), { recursive: true })
  mkdirSync(join(dir, 'cockpit', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'cockpit', 'board.json'), JSON.stringify({
    colonnes: [{ id: 'backlog', titre: 'Backlog' }, { id: 'terminé', titre: 'Terminé' }],
  }) + '\n')
  return dir
}

// --- Tests listProjects ----

test('listProjects retourne la liste des projets enregistrés', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('listProjects', {})

  assert.ok(!result.isError)
  assert.ok(Array.isArray(result.content))
  assert.equal(result.content.length, 1)
  assert.equal(result.content[0].path, dir)
  assert.equal(result.content[0].name, 'test')
})

test('listProjects retourne une liste vide si le registre est vide', () => {
  withRegistry()

  const result = dispatch('listProjects', {})

  assert.ok(!result.isError)
  assert.deepEqual(result.content, [])
})

// --- Tests getProjectSummary ----

test('getProjectSummary retourne un résumé valide', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('getProjectSummary', { path: dir })

  assert.ok(!result.isError)
  assert.ok(result.content.path)
  assert.ok(typeof result.content.name === 'string')
  assert.ok(typeof result.content.equipped === 'boolean')
  assert.ok(typeof result.content.planCount === 'number')
})

test('getProjectSummary refuse un chemin non enregistré', () => {
  withRegistry()
  const dir = projectDir()
  // Ne pas enregistrer le projet

  const result = dispatch('getProjectSummary', { path: dir })

  assert.ok(result.isError)
  assert.equal(result.code, 404)
})

test('getProjectSummary refuse un chemin inexistant', () => {
  withRegistry()

  const result = dispatch('getProjectSummary', { path: '/tmp/inexistant-12345' })

  assert.ok(result.isError)
  assert.equal(result.code, 400)
})

test('getProjectSummary refuse un lien symbolique', () => {
  withRegistry()
  const dir = projectDir()
  const linkPath = join(tmpdir(), 'cockpit-link-' + Math.random().toString(36).slice(2))
  symlinkSync(dir, linkPath)
  registerProject(linkPath)

  const result = dispatch('getProjectSummary', { path: linkPath })

  assert.ok(result.isError)
  assert.equal(result.code, 400)
})

// --- Tests getBoard ----

test('getBoard retourne la structure des colonnes', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('getBoard', { path: dir })

  assert.ok(!result.isError)
  assert.ok(Array.isArray(result.content?.colonnes))
  assert.equal(result.content.colonnes[0].id, 'backlog')
})

// --- Tests createTicket ----

test('createTicket crée un ticket avec titre valide', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('createTicket', {
    path: dir,
    titre: 'Test ticket',
    colonne: 'backlog',
  })

  assert.ok(!result.isError)
  assert.ok(result.content.success)
  // Vérifier que le fichier a été créé (le format est T-XXXX-titre-en-minuscules.md)
  const ticketsDir = join(dir, 'cockpit', 'tickets')
  const files = readdirSync(ticketsDir)
  assert.ok(files.length > 0)
  assert.ok(files.some(f => f.match(/^T-\d+-test-ticket\.md$/)))
})

test('createTicket refuse un titre vide', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('createTicket', {
    path: dir,
    titre: '',
  })

  assert.ok(result.isError)
  assert.equal(result.code, 400)
})

test('createTicket refuse un chemin non enregistré', () => {
  withRegistry()
  const dir = projectDir()
  // Ne pas enregistrer

  const result = dispatch('createTicket', {
    path: dir,
    titre: 'Test',
  })

  assert.ok(result.isError)
  assert.equal(result.code, 404)
})

// --- Tests moveTicket ----

test('moveTicket déplace un ticket vers une colonne', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  // Créer un ticket d'abord
  dispatch('createTicket', { path: dir, titre: 'Ticket 1', colonne: 'backlog' })

  // Trouver le fichier créé
  const ticketsDir = join(dir, 'cockpit', 'tickets')
  const file = readdirSync(ticketsDir)[0]

  const result = dispatch('moveTicket', {
    path: dir,
    file,
    colonne: 'terminé',
  })

  assert.ok(!result.isError)
  assert.ok(result.content.success)
  assert.ok(Array.isArray(result.content.board?.colonnes))
})

test('moveTicket refuse un ticket inexistant', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('moveTicket', {
    path: dir,
    file: 'inexistant.md',
    colonne: 'terminé',
  })

  assert.ok(result.isError)
  assert.equal(result.code, 404)
})

// --- Tests archiveTicket ----

test('archiveTicket archive un ticket (déplace vers terminé)', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  // Créer un ticket
  dispatch('createTicket', { path: dir, titre: 'Archive me', colonne: 'backlog' })

  // Trouver le fichier
  const ticketsDir = join(dir, 'cockpit', 'tickets')
  const file = readdirSync(ticketsDir)[0]

  const result = dispatch('archiveTicket', {
    path: dir,
    file,
  })

  assert.ok(!result.isError)
  assert.ok(result.content.success)
})

// --- Tests chemin absolu/vide ----

test('dispatch refuse un chemin vide', () => {
  withRegistry()

  const result = dispatch('getProjectSummary', { path: '' })

  assert.ok(result.isError)
  assert.equal(result.code, 400)
})

test('dispatch refuse un chemin relatif', () => {
  withRegistry()

  const result = dispatch('getProjectSummary', { path: './relative' })

  assert.ok(result.isError)
  assert.equal(result.code, 400)
})

// --- Tests listTickets ----

test('listTickets retourne les N derniers tickets', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  // Créer un ticket
  dispatch('createTicket', { path: dir, titre: 'Ticket 1' })

  const result = dispatch('listTickets', { path: dir, limit: 10 })

  assert.ok(!result.isError)
  assert.ok(Array.isArray(result.content))
})

// --- Tests getPlans ----

test('getPlans retourne les N derniers plans', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const result = dispatch('getPlans', { path: dir, limit: 10 })

  assert.ok(!result.isError)
  assert.ok(Array.isArray(result.content))
})

// --- Tests outil inconnu ----

test('dispatch retourne une erreur pour un outil inconnu', () => {
  withRegistry()

  const result = dispatch('unknownTool', {})

  assert.ok(result.isError)
  assert.equal(result.code, 400)
  assert.match(result.message, /inconnu/)
})
