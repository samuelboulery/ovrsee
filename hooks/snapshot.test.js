import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { snapshot, vaultPath } from './snapshot.js'
import { DEFAULT_SETTINGS, writeSettings } from './settings.js'

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-snap-'))
  mkdirSync(join(dir, 'ovrsee', 'plans'), { recursive: true })
  return dir
}

test('le README du dépôt part avec le snapshot', () => {
  const dir = project()
  writeFileSync(join(dir, 'README.md'), '# Titre\n\nCe que fait le projet.\n')

  assert.match(snapshot(dir).readme, /Ce que fait le projet\./)
})

test('un dépôt sans README rend null, pas une chaîne vide', () => {
  // La distinction porte : l'onglet Aperçu dit « pas de README » plutôt que
  // d'afficher un cadre vide qui ressemblerait à une panne de lecture.
  assert.equal(snapshot(project()).readme, null)
})

test('un README démesuré est coupé, et le dit', () => {
  const dir = project()
  writeFileSync(join(dir, 'README.md'), 'a'.repeat(500_000))

  const { readme } = snapshot(dir)
  assert.ok(readme.length < 500_000)
  assert.match(readme, /coupé à \d+ caractères/)
})

test('les scripts du package.json arrivent tels quels', () => {
  const dir = project()
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { dev: 'vite' } }))

  assert.deepEqual(snapshot(dir).packageJson.scripts, { dev: 'vite' })
})

// --- fichiers illisibles ---------------------------------------------------
//
// Un plan ou un ticket au frontmatter cassé rendait `[]` : le fichier existait
// sur le disque, l'interface affirmait qu'il n'y avait rien. Le crawl, lui,
// inscrit ses échecs — la lecture doit le faire aussi.

test('un plan au frontmatter cassé est signalé au lieu de disparaître', () => {
  const dir = project()
  writeFileSync(join(dir, 'ovrsee', 'plans', '2026-08-09-casse.md'), '---\npas du json\n---\ncorps\n')

  const { plans, illisibles } = snapshot(dir)
  assert.deepEqual(plans, [])
  assert.deepEqual(illisibles, [{ file: 'plans/2026-08-09-casse.md', quoi: 'plan' }])
})

test('un ticket au frontmatter cassé est signalé au lieu de disparaître', () => {
  const dir = project()
  mkdirSync(join(dir, 'ovrsee', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'ovrsee', 'tickets', 'T-0001-casse.md'), '---\n{ cassé\n---\n\ncorps\n')

  const { tickets, illisibles } = snapshot(dir)
  assert.deepEqual(tickets, [])
  assert.deepEqual(illisibles, [{ file: 'tickets/T-0001-casse.md', quoi: 'ticket' }])
})

test('un fichier cassé ne cache pas ceux qui se lisent', () => {
  const dir = project()
  mkdirSync(join(dir, 'ovrsee', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'ovrsee', 'tickets', 'T-0001-casse.md'), '---\n{ cassé\n---\n')
  writeFileSync(
    join(dir, 'ovrsee', 'tickets', 'T-0002-bon.md'),
    '---\n{ "id": "T-0002", "titre": "Bon", "colonne": "backlog" }\n---\n\ncorps\n',
  )

  const { tickets, illisibles } = snapshot(dir)
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0].id, 'T-0002')
  assert.equal(illisibles.length, 1)
})

test('une ligne illisible de scans.jsonl est comptée, pas seulement sautée', () => {
  const dir = project()
  mkdirSync(join(dir, 'ovrsee', 'pages'), { recursive: true })
  writeFileSync(
    join(dir, 'ovrsee', 'pages', 'scans.jsonl'),
    'pas du json\n{"date":"2026-08-09","ok":true,"commit":"abc"}\n',
  )

  const { scans, illisibles } = snapshot(dir)
  assert.equal(scans.length, 1)
  assert.deepEqual(illisibles, [{ file: 'pages/scans.jsonl', quoi: 'scan', lignes: 1 }])
})

test('un projet sain ne signale rien', () => {
  assert.deepEqual(snapshot(project()).illisibles, [])
})

// --- source du graphe ------------------------------------------------------

/** Un `graphify-out/graph.json` minimal mais valide. */
const poserGraphify = dir => {
  mkdirSync(join(dir, 'graphify-out'), { recursive: true })
  writeFileSync(
    join(dir, 'graphify-out', 'graph.json'),
    JSON.stringify({ nodes: [{ id: 'g', label: 'venu de graphify' }], links: [] }),
  )
}

/** Un coffre à une note de table, et le champ de config qui le désigne. */
const poserCoffre = (dir, chemin = 'coffre') => {
  mkdirSync(join(dir, chemin), { recursive: true })
  writeFileSync(
    join(dir, chemin, 'commandes.md'),
    '---\ntype: table\ntitre: Commandes\n---\n\nLes commandes.\n',
  )
  writeFileSync(join(dir, 'ovrsee.config.json'), JSON.stringify({ obsidianVault: chemin }))
}

test('sans coffre déclaré, le graphe vient de Graphify', () => {
  const dir = project()
  poserGraphify(dir)

  const snap = snapshot(dir)
  assert.equal(snap.graphSource, 'graphify')
  assert.equal(snap.graph.nodes[0].label, 'venu de graphify')
})

test('Graphify l’emporte sur un coffre déclaré', () => {
  const dir = project()
  poserGraphify(dir)
  poserCoffre(dir)

  // Le point du test, et il vient du cadrage (§3) : la vue base de données
  // n'est pas reconstruite parce que Graphify la fait mieux et à jour à chaque
  // commit. Une note écrite à la main ne peut pas la recouvrir.
  const snap = snapshot(dir)
  assert.equal(snap.graphSource, 'graphify')
  assert.equal(snap.graph.nodes[0].label, 'venu de graphify')
})

test("le coffre sert quand Graphify n’a rien produit", () => {
  const dir = project()
  poserCoffre(dir)

  const snap = snapshot(dir)
  assert.equal(snap.graphSource, 'obsidian')
  assert.equal(snap.graph.nodes[0].label, 'Commandes')
})

test('un coffre déclaré mais illisible rend null, sans Graphify pour le sauver', () => {
  const dir = project()
  writeFileSync(
    join(dir, 'ovrsee.config.json'),
    JSON.stringify({ obsidianVault: 'coffre-absent' }),
  )

  const snap = snapshot(dir)
  assert.equal(snap.graph, null)
  assert.equal(snap.graphSource, null)
})

test('sans source du tout, le graphe est null et le dit', () => {
  const snap = snapshot(project())
  assert.equal(snap.graph, null)
  assert.equal(snap.graphSource, null)
})

test('un chemin de coffre en ~ est développé, pas collé au dépôt', () => {
  // Sans cela, `join()` ferait `<repo>/~/Coffres`, et l'onglet dirait « coffre
  // illisible » en désignant un chemin que personne n'a écrit.
  assert.equal(vaultPath('/repo', '~/Coffres/x'), join(homedir(), 'Coffres', 'x'))
  assert.equal(vaultPath('/repo', '~'), homedir())
  assert.equal(vaultPath('/repo', '/ailleurs/coffre'), '/ailleurs/coffre')
  assert.equal(vaultPath('/repo', 'coffre'), join('/repo', 'coffre'))
})

// --- Résolution à trois niveaux de sourceGraphe ---

test('snapshot inclut sourceRequested, sourceMissing et sourceDate', () => {
  const snap = snapshot(project())
  assert(typeof snap.sourceRequested === 'string')
  assert(typeof snap.sourceMissing === 'boolean')
  assert(snap.sourceDate === null || typeof snap.sourceDate === 'string')
})

test('sourceRequested = "auto" et sourceMissing = false quand Graphify existe', () => {
  const dir = project()
  poserGraphify(dir)

  const snap = snapshot(dir)
  assert.equal(snap.sourceRequested, 'auto')
  assert.equal(snap.sourceMissing, false)
  assert.equal(snap.graphSource, 'graphify')
})

test('sourceRequested = "auto" et sourceMissing = false quand le coffre existe', () => {
  const dir = project()
  poserCoffre(dir)

  const snap = snapshot(dir)
  assert.equal(snap.sourceRequested, 'auto')
  assert.equal(snap.sourceMissing, false)
  assert.equal(snap.graphSource, 'obsidian')
})

test('sourceDate donne la date du graphe Graphify', () => {
  const dir = project()
  poserGraphify(dir)

  const snap = snapshot(dir)
  // La date est au format YYYY-MM-DD
  assert.match(snap.sourceDate, /\d{4}-\d{2}-\d{2}/)
})

test('sourceDate donne la date la plus récente du coffre', () => {
  const dir = project()
  poserCoffre(dir)

  const snap = snapshot(dir)
  // La date est au format YYYY-MM-DD
  assert.match(snap.sourceDate, /\d{4}-\d{2}-\d{2}/)
})

test("sourceDate est null quand il n'y a pas de source", () => {
  const snap = snapshot(project())
  assert.equal(snap.sourceDate, null)
})

test('choix explicite de Graphify avec sourceMissing quand absent', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'ovrsee-snap-src-'))
  const dir = project()
  const settingsFile = join(tempDir, 'settings.json')
  try {
    // Config projet demande Graphify explicitement
    writeFileSync(
      join(dir, 'ovrsee.config.json'),
      JSON.stringify({ sourceGraphe: 'graphify' }),
    )
    // Pas de Graphify, pas de coffre
    process.env.OVRSEE_SETTINGS = settingsFile
    writeSettings(DEFAULT_SETTINGS)

    const snap = snapshot(dir)
    assert.equal(snap.sourceRequested, 'graphify')
    assert.equal(snap.sourceMissing, true)
    assert.equal(snap.graph, null)
  } finally {
    delete process.env.OVRSEE_SETTINGS
    rmSync(tempDir, { recursive: true })
  }
})

test("choix explicite d'Obsidian avec sourceMissing quand absent", () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'ovrsee-snap-src-'))
  const dir = project()
  const settingsFile = join(tempDir, 'settings.json')
  try {
    // Config projet demande Obsidian explicitement, mais pas configuré
    writeFileSync(
      join(dir, 'ovrsee.config.json'),
      JSON.stringify({ sourceGraphe: 'obsidian' }),
    )
    // Pas de Graphify
    process.env.OVRSEE_SETTINGS = settingsFile
    writeSettings(DEFAULT_SETTINGS)

    const snap = snapshot(dir)
    assert.equal(snap.sourceRequested, 'obsidian')
    assert.equal(snap.sourceMissing, true)
    assert.equal(snap.graph, null)
  } finally {
    delete process.env.OVRSEE_SETTINGS
    rmSync(tempDir, { recursive: true })
  }
})
