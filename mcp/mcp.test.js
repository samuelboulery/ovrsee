/**
 * Tests du dispatcher MCP.
 *
 * Utilise node:test + node:assert/strict, tmpdir, OVRSEE_REGISTRY isolé.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { dispatch } from './dispatch.js'

// Isoler le registre du système réel
const withRegistry = () => {
  process.env.OVRSEE_REGISTRY = join(mkdtempSync(join(tmpdir(), 'ovrsee-mcp-')), 'projects.json')
}

// Créer un faux registre avec un projet
const registerProject = (path) => {
  const registryPath = process.env.OVRSEE_REGISTRY
  const projects = [{ path, name: 'test', lastOpened: new Date().toISOString() }]
  writeFileSync(registryPath, JSON.stringify(projects, null, 2) + '\n')
}

// Créer un dossier de projet minimal
const projectDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-proj-'))
  mkdirSync(join(dir, 'ovrsee', 'pages', 'shots'), { recursive: true })
  mkdirSync(join(dir, 'ovrsee', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'ovrsee', 'board.json'), JSON.stringify({
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
  const linkPath = join(tmpdir(), 'ovrsee-link-' + Math.random().toString(36).slice(2))
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
  const ticketsDir = join(dir, 'ovrsee', 'tickets')
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
  const ticketsDir = join(dir, 'ovrsee', 'tickets')
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

test('listTickets rend les plus récents d\'abord, et pas plus que la limite', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  dispatch('createTicket', { path: dir, titre: 'Ancien', colonne: 'backlog' })
  dispatch('createTicket', { path: dir, titre: 'Recent', colonne: 'backlog' })
  // Vieillir le premier : sans cela les deux portent la même date du jour et
  // l'ordre rendu ne prouve rien. Le frontmatter est du JSON entre `---`.
  const fichiers = readdirSync(join(dir, 'ovrsee', 'tickets')).sort()
  const ancien = join(dir, 'ovrsee', 'tickets', fichiers[0])
  writeFileSync(ancien, readFileSync(ancien, 'utf8').replace(/"cree": "[^"]+"/, '"cree": "2020-01-01"'))

  const result = dispatch('listTickets', { path: dir, limit: 1 })

  assert.ok(!result.isError)
  assert.equal(result.content.length, 1)
  assert.equal(result.content[0].titre, 'Recent')
})

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

// --- Tests du fil stdio ----
//
// Les tests ci-dessus n'appellent que `dispatch()`. Ils étaient verts pendant
// que le serveur renvoyait la donnée nue au lieu de l'enveloppe `content` que
// la spec MCP exige — c'est-à-dire pendant qu'aucun client réel ne pouvait s'en
// servir. Ceux-ci parlent au serveur par où un client lui parle.

/**
 * Envoie des demandes JSON-RPC au serveur et rend ses réponses, dans l'ordre.
 *
 * @param {string[]} demandes lignes JSON
 * @param {string} registre chemin d'un registre isolé
 */
function parLeFil(demandes, registre) {
  const out = execFileSync(process.execPath, [join(import.meta.dirname, 'server.js')], {
    input: demandes.join('\n') + '\n',
    env: { ...process.env, OVRSEE_REGISTRY: registre },
    encoding: 'utf8',
  })
  return out.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
}

const demande = (id, method, params) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })

test('le serveur annonce la capacité tools à l\'initialisation', () => {
  withRegistry()

  const [rep] = parLeFil([demande(1, 'initialize', { protocolVersion: '2024-11-05' })], process.env.OVRSEE_REGISTRY)

  assert.equal(rep.id, 1)
  assert.equal(rep.result.protocolVersion, '2024-11-05')
  // Sans ceci, un client conforme n'appelle jamais `tools/list`.
  assert.deepEqual(rep.result.capabilities.tools, {})
})

test('le serveur ne répond pas à une notification', () => {
  withRegistry()

  const reps = parLeFil([
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    demande(2, 'tools/list'),
  ], process.env.OVRSEE_REGISTRY)

  assert.equal(reps.length, 1)
  assert.equal(reps[0].id, 2)
})

test('tools/list annonce des outils avec un schéma d\'entrée', () => {
  withRegistry()

  const [rep] = parLeFil([demande(1, 'tools/list')], process.env.OVRSEE_REGISTRY)

  assert.ok(Array.isArray(rep.result.tools))
  assert.ok(rep.result.tools.every(t => t.name && t.description && t.inputSchema))
  // Retiré : `moveTicket` fait le même geste, vers une colonne qui existe.
  assert.ok(!rep.result.tools.some(t => t.name === 'archiveTicket'))
})

test('tools/call enveloppe le résultat dans content', () => {
  withRegistry()
  const dir = projectDir()
  registerProject(dir)

  const [rep] = parLeFil(
    [demande(1, 'tools/call', { name: 'listProjects', arguments: {} })],
    process.env.OVRSEE_REGISTRY,
  )

  assert.equal(rep.error, undefined)
  assert.ok(Array.isArray(rep.result.content))
  assert.equal(rep.result.content[0].type, 'text')
  assert.equal(JSON.parse(rep.result.content[0].text)[0].path, dir)
})

test('un refus d\'outil est un résultat isError, pas une erreur JSON-RPC', () => {
  withRegistry()

  const [rep] = parLeFil(
    [demande(1, 'tools/call', { name: 'getProjectSummary', arguments: { path: '/tmp/inexistant-12345' } })],
    process.env.OVRSEE_REGISTRY,
  )

  // Une erreur JSON-RPC ferait disparaître le motif du refus côté modèle.
  assert.equal(rep.error, undefined)
  assert.equal(rep.result.isError, true)
  assert.match(rep.result.content[0].text, /Erreur 400/)
})

test('une méthode inconnue reste une erreur JSON-RPC', () => {
  withRegistry()

  const [rep] = parLeFil([demande(1, 'resources/list')], process.env.OVRSEE_REGISTRY)

  assert.equal(rep.error.code, -32601)
})
