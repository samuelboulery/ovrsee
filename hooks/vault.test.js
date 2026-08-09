import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { frontmatterOf, MAX_FILES, parseYaml, readVault, wikilinks } from './vault.js'

/** Un coffre jetable. `notes` est un objet chemin relatif → contenu. */
function coffre(notes) {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-vault-'))
  for (const [chemin, contenu] of Object.entries(notes)) {
    const file = join(root, chemin)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contenu, 'utf8')
  }
  return root
}

/** La note de table qui sert de référence dans la plupart des cas. */
const COMMANDES = `---
type: table
titre: Commandes
columns: [id, client_id, total]
---

Les commandes passées.
`

// --- parseYaml -------------------------------------------------------------

test('parseYaml lit un scalaire nu et un scalaire cité', () => {
  const out = parseYaml('type: table\ntitre: "Commandes: le retour"')

  assert.equal(out.type, 'table')
  // Le point du test : les deux-points du titre ne coupent pas la valeur.
  assert.equal(out.titre, 'Commandes: le retour')
})

test('parseYaml lit une liste en bloc', () => {
  const out = parseYaml('columns:\n  - id\n  - total\ntype: table')

  assert.deepEqual(out.columns, ['id', 'total'])
  // La clé qui suit la liste n'est pas avalée par elle.
  assert.equal(out.type, 'table')
})

test('parseYaml lit une liste inline', () => {
  assert.deepEqual(parseYaml('columns: [id, "client id", total]').columns, [
    'id',
    'client id',
    'total',
  ])
})

test('parseYaml rend null plutôt que de lever sur un bloc illisible', () => {
  assert.equal(parseYaml('pas de deux-points ici'), null)
  assert.equal(parseYaml(''), null)
  assert.equal(parseYaml(undefined), null)
})

test('parseYaml ignore ce qu’il ne sait pas lire plutôt que de le deviner', () => {
  const out = parseYaml('type: table\nnested:\n  a: 1\n  b: 2')

  assert.equal(out.type, 'table')
  // Une valeur imbriquée est hors périmètre : la clé vaut '' et ne prétend rien.
  assert.equal(out.nested, '')
})

test('frontmatterOf ne lit que ce qui est entre les fences', () => {
  assert.equal(frontmatterOf('---\ntype: table\n---\n\ntype: piège\n').type, 'table')
  assert.equal(frontmatterOf('Pas de frontmatter.'), null)
  assert.equal(frontmatterOf('---\ntype: table\n'), null)
})

// --- wikilinks -------------------------------------------------------------

test('wikilinks rend la note visée, quelle que soit la forme du lien', () => {
  const liens = wikilinks('[[a]] et [[b|libellé]] et [[c#section]] et [[a]]')

  // `a` n'apparaît qu'une fois : deux mentions ne sont pas deux liens.
  assert.deepEqual(liens, ['a', 'b', 'c'])
})

test('wikilinks ignore un bloc de code', () => {
  assert.deepEqual(wikilinks('```\n[[pas-un-lien]]\n```\n[[vrai]] et `[[non]]`'), ['vrai'])
})

// --- readVault -------------------------------------------------------------

test('une note type: table devient un nœud de schéma', () => {
  const root = coffre({ 'tables/commandes.md': COMMANDES })
  const graph = readVault(root)

  const node = graph.nodes.find(n => n.id === 'tables/commandes')
  assert.equal(node.file_type, 'table')
  assert.equal(node.label, 'Commandes')
  assert.equal(node.columns, 'id, client_id, total')

  rmSync(root, { recursive: true, force: true })
})

test('une note sans type: table n’en devient pas une', () => {
  const root = coffre({
    'notes/panier.md': '---\ntype: page\n---\n\nRien à voir.\n',
    'notes/nue.md': 'Pas de frontmatter du tout.\n',
  })
  const graph = readVault(root)

  // Les deux notes existent comme nœuds — elles portent un label — mais aucune
  // n'est une table.
  assert.equal(graph.nodes.length, 2)
  assert.deepEqual(
    graph.nodes.filter(n => n.file_type === 'table'),
    [],
  )

  rmSync(root, { recursive: true, force: true })
})

test('un wikilink vers une table produit le lien entrant, sans confiance', () => {
  const root = coffre({
    'tables/commandes.md': COMMANDES,
    'pages/panier.md': '---\ntype: page\n---\n\nLit [[tables/commandes]].\n',
  })
  const graph = readVault(root)

  // Pas de `confidence` : EXTRACTED / INFERRED / AMBIGUOUS dit ce que le
  // parseur de Graphify a tiré du code. Un wikilink manuscrit n'est aucun des
  // trois, et lui prendre son étiquette la plus sûre serait un emprunt.
  assert.deepEqual(graph.links, [
    { source: 'pages/panier', target: 'tables/commandes', relation: 'mentions' },
  ])

  rmSync(root, { recursive: true, force: true })
})

test('une table porte la date que son auteur a écrite', () => {
  const root = coffre({
    'a.md': '---\ntype: table\nmaj: 2026-03-12\n---\n',
    'b.md': '---\ntype: table\nupdated: 2026-04-01\n---\n',
    'c.md': '---\ntype: table\ndate: 2026-05-02\n---\n',
  })
  const dates = Object.fromEntries(readVault(root).nodes.map(n => [n.id, n.declared]))

  assert.deepEqual(dates, { a: '2026-03-12', b: '2026-04-01', c: '2026-05-02' })

  rmSync(root, { recursive: true, force: true })
})

test('une table sans date porte null, une note ordinaire ne porte rien', () => {
  const root = coffre({
    'sans-date.md': '---\ntype: table\n---\n',
    'ordinaire.md': '---\ntype: page\n---\n',
  })
  const nodes = Object.fromEntries(readVault(root).nodes.map(n => [n.id, n]))

  // La distinction porte : `null` dit « déclarée, non datée », `undefined` dit
  // « pas une déclaration du tout ». L'interface s'en sert pour choisir entre
  // afficher une date et afficher une confiance.
  assert.equal(nodes['sans-date'].declared, null)
  assert.equal('declared' in nodes.ordinaire, false)

  rmSync(root, { recursive: true, force: true })
})

test('un wikilink abrégé se résout si le nom est unique dans le coffre', () => {
  const root = coffre({
    'tables/commandes.md': COMMANDES,
    'pages/panier.md': 'Lit [[commandes]].\n',
  })

  assert.equal(readVault(root).links[0]?.target, 'tables/commandes')

  rmSync(root, { recursive: true, force: true })
})

test('un nom ambigu ne se résout vers rien — deviner produirait un lien faux', () => {
  const root = coffre({
    'a/commandes.md': COMMANDES,
    'b/commandes.md': COMMANDES,
    'pages/panier.md': 'Lit [[commandes]].\n',
  })

  assert.deepEqual(readVault(root).links, [])

  rmSync(root, { recursive: true, force: true })
})

test('un lien vers une note ordinaire est jeté — personne ne l’affiche', () => {
  const root = coffre({
    'pages/panier.md': 'Lit [[pages/accueil]].\n',
    'pages/accueil.md': "L'accueil.\n",
  })

  assert.deepEqual(readVault(root).links, [])

  rmSync(root, { recursive: true, force: true })
})

test('un coffre absent ou vide rend null, pas un graphe vide', () => {
  assert.equal(readVault(join(tmpdir(), 'coffre-qui-n-existe-pas')), null)
  assert.equal(readVault(''), null)
  assert.equal(readVault(null), null)

  const vide = coffre({ 'lisez-moi.txt': 'pas une note' })
  assert.equal(readVault(vide), null)
  rmSync(vide, { recursive: true, force: true })
})

test('les dossiers de service et les liens symboliques ne sont pas lus', () => {
  const root = coffre({
    'tables/commandes.md': COMMANDES,
    '.obsidian/workspace.md': '---\ntype: table\n---\n',
  })
  const dehors = coffre({ 'secret.md': '---\ntype: table\n---\n' })
  symlinkSync(dehors, join(root, 'evasion'))

  const ids = readVault(root).nodes.map(n => n.id)
  assert.deepEqual(ids, ['tables/commandes'])

  rmSync(root, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})

test('le parcours est borné à MAX_FILES', () => {
  const notes = {}
  for (let i = 0; i < MAX_FILES + 10; i += 1) {
    notes[`n${String(i).padStart(5, '0')}.md`] = `# ${i}\n`
  }
  const root = coffre(notes)

  assert.equal(readVault(root).nodes.length, MAX_FILES)

  rmSync(root, { recursive: true, force: true })
})
