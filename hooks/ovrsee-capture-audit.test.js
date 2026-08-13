import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { skillFromSlashCommand, logAudit } from './ovrsee-capture-audit.js'

/** Un dépôt jetable avec `ovrsee/` déjà créé. */
const repo = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-capture-audit-'))
  mkdirSync(join(root, 'ovrsee'), { recursive: true })
  return root
}

// --- skillFromSlashCommand -----------------------------------------------

test('skillFromSlashCommand reconnaît la forme courte des 4 audits', () => {
  assert.equal(skillFromSlashCommand('/code-review'), 'code-review:code-review')
  assert.equal(skillFromSlashCommand('/ponytail-audit'), 'ponytail:ponytail-audit')
  assert.equal(skillFromSlashCommand('/ponytail-review'), 'ponytail:ponytail-review')
  assert.equal(skillFromSlashCommand('/security-review'), 'security-review')
})

test('skillFromSlashCommand reconnaît aussi la forme qualifiée plugin:skill', () => {
  assert.equal(skillFromSlashCommand('/code-review:code-review'), 'code-review:code-review')
  assert.equal(skillFromSlashCommand('/ponytail:ponytail-audit'), 'ponytail:ponytail-audit')
  assert.equal(skillFromSlashCommand('/ponytail:ponytail-review'), 'ponytail:ponytail-review')
})

test('skillFromSlashCommand ignore les args après un espace', () => {
  assert.equal(skillFromSlashCommand('/ponytail-audit --deep'), 'ponytail:ponytail-audit')
})

test('skillFromSlashCommand retourne null pour une commande non-audit', () => {
  assert.equal(skillFromSlashCommand('/status'), null)
})

test('skillFromSlashCommand retourne null pour un texte qui ne commence pas par /', () => {
  assert.equal(skillFromSlashCommand('ponytail-audit'), null)
})

// --- logAudit --------------------------------------------------------------

test('logAudit écrit une ligne JSON dans ovrsee/audits.jsonl', () => {
  const root = repo()
  logAudit(root, 'ponytail:ponytail-audit')

  const path = join(root, 'ovrsee', 'audits.jsonl')
  const line = readFileSync(path, 'utf8').trim()
  const parsed = JSON.parse(line)
  assert.equal(parsed.skill, 'ponytail:ponytail-audit')
  assert.equal(typeof parsed.date, 'string')
})

test('logAudit ne fait rien si ovrsee/ est absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-capture-audit-non-equipe-'))
  assert.equal(logAudit(root, 'security-review'), false)
  assert.equal(existsSync(join(root, 'ovrsee', 'audits.jsonl')), false)
})
