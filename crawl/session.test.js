import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { migrerSession, sessionPath } from './session.js'

process.env.OVRSEE_AUTH_DIR = mkdtempSync(join(tmpdir(), 'ovrsee-auth-'))

/** Un dépôt git dont `.gitignore` ignore `.auth.json`. */
const depot = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-session-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  writeFileSync(join(dir, '.gitignore'), '.auth.json\n')
  return dir
}

test('la session vit hors du dépôt, une par projet (T-0275)', () => {
  const a = depot()
  const b = depot()
  assert.equal(dirname(sessionPath(a)), process.env.OVRSEE_AUTH_DIR)
  assert.notEqual(sessionPath(a), sessionPath(b))
  assert.equal(sessionPath(a), sessionPath(a + '/'), 'même projet, même fichier')
})

test('l’ancienne session du dépôt est déplacée une fois, en 0600', () => {
  const dir = depot()
  writeFileSync(join(dir, '.auth.json'), '{"cookies":[]}')
  assert.equal(migrerSession(dir, { auth: { storageState: '.auth.json' } }), true)
  assert.equal(readFileSync(sessionPath(dir), 'utf8'), '{"cookies":[]}')
  if (process.platform !== 'win32') assert.equal(statSync(sessionPath(dir)).mode & 0o777, 0o600)
  assert.equal(migrerSession(dir, { auth: { storageState: '.auth.json' } }), false, 'déjà fait')
})

test('la migration ne lit ni un lien, ni un chemin hors du dépôt, ni un fichier versionné', () => {
  const dehors = mkdtempSync(join(tmpdir(), 'ovrsee-dehors-'))
  writeFileSync(join(dehors, 'secret'), 'SECRET')

  const lien = depot()
  symlinkSync(join(dehors, 'secret'), join(lien, '.auth.json'))
  assert.equal(migrerSession(lien, { auth: { storageState: '.auth.json' } }), false)

  const sortie = depot()
  assert.equal(migrerSession(sortie, { auth: { storageState: '../../' + join(dehors, 'secret') } }), false)

  const suivi = depot()
  writeFileSync(join(suivi, 'session.json'), '{}')
  assert.equal(migrerSession(suivi, { auth: { storageState: 'session.json' } }), false, 'non ignoré par git')

  // Un lien qui reste dans le dépôt, mais vers un fichier versionné : `.env`
  // d'une archive, que le `.gitignore` du même auteur déclare ignoré.
  const interne = depot()
  writeFileSync(join(interne, '.env'), 'SECRET=1')
  symlinkSync('.env', join(interne, '.auth.json'))
  assert.equal(migrerSession(interne, { auth: { storageState: '.auth.json' } }), false, 'lien interne')

  for (const dir of [lien, sortie, suivi, interne]) assert.equal(existsSync(sessionPath(dir)), false)
})

test('un dossier de sessions lié ailleurs est refusé', () => {
  const ailleurs = mkdtempSync(join(tmpdir(), 'ovrsee-ailleurs-'))
  const base = mkdtempSync(join(tmpdir(), 'ovrsee-base-'))
  const lie = join(base, 'auth')
  symlinkSync(ailleurs, lie)
  const avant = process.env.OVRSEE_AUTH_DIR
  process.env.OVRSEE_AUTH_DIR = lie
  try {
    const dir = depot()
    writeFileSync(join(dir, '.auth.json'), '{}')
    assert.throws(() => migrerSession(dir, { auth: { storageState: '.auth.json' } }), /lien symbolique/)
  } finally {
    process.env.OVRSEE_AUTH_DIR = avant
  }
  mkdirSync(join(ailleurs, 'x'))
})
