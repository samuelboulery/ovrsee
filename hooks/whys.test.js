import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { packageOf, readWhys, whysInSource } from './whys.js'

const projet = () => mkdtempSync(join(tmpdir(), 'cockpit-why-'))

test('packageOf isole le nom du paquet', () => {
  assert.equal(packageOf('node-pty'), 'node-pty')
  assert.equal(packageOf('@xterm/xterm/css/xterm.css'), '@xterm/xterm')
  assert.equal(packageOf('react-dom/server'), 'react-dom')
})

test('packageOf ignore ce qui n’est pas une dépendance déclarée', () => {
  assert.equal(packageOf('./data'), null)
  assert.equal(packageOf('../style'), null)
  assert.equal(packageOf('/abs/path'), null)
  assert.equal(packageOf('node:fs'), null)
  assert.equal(packageOf(''), null)
  assert.equal(packageOf(undefined), null)
})

test('un WHY juste au-dessus de l’import est la raison du paquet', () => {
  const whys = whysInSource(
    ['// WHY: le seul pty qui compile en arm64.', "import { spawn } from 'node-pty'"].join('\n'),
  )
  assert.equal(whys.get('node-pty'), 'le seul pty qui compile en arm64.')
})

test('un WHY sur deux lignes garde sa suite', () => {
  const whys = whysInSource(
    [
      '// WHY: xterm plutôt qu’un rendu maison :',
      '// c’est le terminal de VS Code, pas une imitation.',
      "import { Terminal } from '@xterm/xterm'",
    ].join('\n'),
  )
  assert.equal(
    whys.get('@xterm/xterm'),
    'xterm plutôt qu’un rendu maison : c’est le terminal de VS Code, pas une imitation.',
  )
})

test('un WHY en commentaire de bloc compte aussi', () => {
  const whys = whysInSource(['/* WHY: rendu côté serveur pour les tests. */', "import 'react-dom/server'"].join('\n'))
  assert.equal(whys.get('react-dom'), 'rendu côté serveur pour les tests.')
})

test('un WHY dièse compte aussi — c’est celui que l’interface annonce', () => {
  const whys = whysInSource(['# WHY: parce que.', "import x from 'truc'"].join('\n'))
  assert.equal(whys.get('truc'), 'parce que.')
})

test('un WHY séparé de l’import par une ligne vide compte encore', () => {
  const whys = whysInSource(['// WHY: aéré.', '', "import x from 'truc'"].join('\n'))
  assert.equal(whys.get('truc'), 'aéré.')
})

// Le cœur du ticket : une mention ne vaut pas une justification.

test('un WHY ailleurs dans le fichier ne justifie rien', () => {
  const whys = whysInSource(
    [
      '// WHY: cette fonction existe pour une autre raison.',
      'function truc() {}',
      '',
      'const x = 1',
      '',
      "import { spawn } from 'node-pty'",
    ].join('\n'),
  )
  assert.equal(whys.has('node-pty'), false)
})

test('un import sans commentaire n’a pas de raison', () => {
  const whys = whysInSource("import { spawn } from 'node-pty'")
  assert.equal(whys.has('node-pty'), false)
})

test('un commentaire ordinaire au-dessus de l’import ne compte pas', () => {
  const whys = whysInSource(['// on ouvre un pty ici', "import 'node-pty'"].join('\n'))
  assert.equal(whys.has('node-pty'), false)
})

test('readWhys parcourt le dépôt et saute node_modules', () => {
  const dir = projet()
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'node_modules', 'piege'), { recursive: true })

  writeFileSync(
    join(dir, 'src', 'a.ts'),
    ['// WHY: pour le terminal intégré.', "import { Terminal } from '@xterm/xterm'"].join('\n'),
  )
  writeFileSync(
    join(dir, 'node_modules', 'piege', 'index.js'),
    ['// WHY: raison d’un paquet tiers.', "import 'react'"].join('\n'),
  )

  const whys = readWhys(dir)
  assert.equal(whys['@xterm/xterm'], 'pour le terminal intégré.')
  assert.equal('react' in whys, false)
})

test('readWhys sur un dossier vide ou absent rend un objet vide', () => {
  assert.deepEqual(readWhys(projet()), {})
  assert.deepEqual(readWhys(join(projet(), 'nexiste-pas')), {})
})
