import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { detectPackageManager } from './detect-package-manager.js'

// Les tests écrivent des fichiers temporaires pour tester la détection

test('detectPackageManager détecte pnpm', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
  assert.equal(detectPackageManager(dir), 'pnpm')
})

test('detectPackageManager détecte npm', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'package-lock.json'), '')
  assert.equal(detectPackageManager(dir), 'npm')
})

test('detectPackageManager détecte yarn', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'yarn.lock'), '')
  assert.equal(detectPackageManager(dir), 'yarn')
})

test('detectPackageManager détecte bun', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'bun.lockb'), '')
  assert.equal(detectPackageManager(dir), 'bun')
})

test('detectPackageManager retourne le défaut en cas de doute (aucun lockfile)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  assert.equal(detectPackageManager(dir), 'pnpm')
  assert.equal(detectPackageManager(dir, 'npm'), 'npm')
})

test('detectPackageManager retourne le défaut en cas de plusieurs lockfiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
  writeFileSync(join(dir, 'package-lock.json'), '')
  assert.equal(detectPackageManager(dir), 'pnpm') // défaut
  assert.equal(detectPackageManager(dir, 'yarn'), 'yarn')
})
