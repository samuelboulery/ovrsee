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

test('detectPackageManager lit packageManager avant les lockfiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ packageManager: 'yarn@4.1.0' }))
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
  assert.equal(detectPackageManager(dir), 'yarn')
})

test('detectPackageManager : packageManager sans lockfile, dépôt fraîchement cloné', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ packageManager: 'pnpm@10.12.1+sha512.abcdef' }),
  )
  assert.equal(detectPackageManager(dir), 'pnpm')
})

test('detectPackageManager : packageManager inconnu ou mal formé retombe sur le reniflage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ packageManager: 'deno@2' }))
  writeFileSync(join(dir, 'bun.lockb'), '')
  assert.equal(detectPackageManager(dir), 'bun')
})

test('detectPackageManager : un package.json illisible ne lève pas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-'))
  writeFileSync(join(dir, 'package.json'), '{ pas du json')
  writeFileSync(join(dir, 'yarn.lock'), '')
  assert.equal(detectPackageManager(dir), 'yarn')
})
