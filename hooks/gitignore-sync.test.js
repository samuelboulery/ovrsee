import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { syncGitignore } from './gitignore-sync.js'

const fixture = (contenu = 'node_modules/\n') => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-gitignore-'))
  writeFileSync(join(root, '.gitignore'), contenu, 'utf8')
  return root
}

test('ajoute le bloc shots quand gitignoreShots est actif', () => {
  const root = fixture()
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: false })
  const contenu = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.match(contenu, /ovrsee\/pages\/shots\//)
  assert.doesNotMatch(contenu, /ovrsee\/plans\//)
})

test('ajoute le bloc plans/tickets quand gitignorePlans est actif', () => {
  const root = fixture()
  syncGitignore(root, { gitignoreShots: false, gitignorePlans: true })
  const contenu = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.doesNotMatch(contenu, /ovrsee\/pages\/shots\//)
  assert.match(contenu, /ovrsee\/plans\//)
  assert.match(contenu, /ovrsee\/tickets\//)
})

test('retire un bloc quand le réglage repasse à faux', () => {
  const root = fixture()
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: true })
  syncGitignore(root, { gitignoreShots: false, gitignorePlans: true })
  const contenu = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.doesNotMatch(contenu, /ovrsee\/pages\/shots\//)
  assert.match(contenu, /ovrsee\/plans\//)
})

test('idempotent : deux passages identiques ne changent rien', () => {
  const root = fixture()
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: true })
  const apresPremier = readFileSync(join(root, '.gitignore'), 'utf8')
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: true })
  const apresSecond = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.equal(apresSecond, apresPremier)
})

test('ne touche pas au reste du fichier', () => {
  const root = fixture('node_modules/\ndist/\n')
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: false })
  const contenu = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.match(contenu, /node_modules\//)
  assert.match(contenu, /dist\//)
})

test('gère un .gitignore absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-gitignore-'))
  syncGitignore(root, { gitignoreShots: true, gitignorePlans: false })
  const contenu = readFileSync(join(root, '.gitignore'), 'utf8')
  assert.match(contenu, /ovrsee\/pages\/shots\//)
})
