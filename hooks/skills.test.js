import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CATALOGUE, bundledPath, installSkills, readSkills, skillsDir } from './skills.js'

/**
 * Un `~/.claude/skills/` jetable.
 *
 * Sans cette variable, chaque exécution de la suite écraserait les skills de la
 * machine — un test qui casse l'outil qu'il vérifie.
 */
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-skills-'))
  process.env.COCKPIT_SKILLS_DIR = dir
  return dir
}

const bundled = CATALOGUE.filter(s => s.source === 'bundled').map(s => s.nom)
const externe = CATALOGUE.find(s => s.source === 'externe')?.nom

// --- catalogue -------------------------------------------------------------

test('chaque skill livré existe réellement dans le dépôt', () => {
  for (const nom of bundled) {
    assert.ok(existsSync(bundledPath(nom)), `${nom} : SKILL.md absent de skills/`)
  }
})

test('le catalogue propose le skill de ticketing', () => {
  assert.ok(bundled.includes('cockpit-tickets'))
})

// --- bundledPath : liste blanche -------------------------------------------

test('un nom hors catalogue est refusé', () => {
  assert.throws(() => bundledPath('inconnu'), /skill inconnu/)
})

test('un nom de traversée est refusé — il ne figure pas au catalogue', () => {
  for (const nom of ['../../../etc/passwd', 'cockpit/../..', '/etc/passwd', '..']) {
    assert.throws(() => bundledPath(nom), /skill inconnu/)
  }
})

test('un skill externe n’est pas installable', () => {
  assert.throws(() => bundledPath(externe), /skill inconnu/)
})

// --- readSkills ------------------------------------------------------------

test('readSkills distingue absent, installé et périmé', () => {
  const dir = fixture()
  const nom = bundled[0]

  assert.equal(readSkills().find(s => s.nom === nom).installe, false)

  mkdirSync(join(dir, nom), { recursive: true })
  writeFileSync(join(dir, nom, 'SKILL.md'), 'contenu périmé', 'utf8')

  const perime = readSkills().find(s => s.nom === nom)
  assert.equal(perime.installe, true)
  assert.equal(perime.aJour, false)

  installSkills([nom])

  const frais = readSkills().find(s => s.nom === nom)
  assert.equal(frais.installe, true)
  assert.equal(frais.aJour, true)
})

test('un skill externe est détecté, jamais comparé', () => {
  const dir = fixture()
  assert.equal(readSkills().find(s => s.nom === externe).installe, false)

  mkdirSync(join(dir, externe), { recursive: true })
  writeFileSync(join(dir, externe, 'SKILL.md'), 'venu d’ailleurs', 'utf8')

  const vu = readSkills().find(s => s.nom === externe)
  assert.equal(vu.installe, true)
  assert.equal(vu.aJour, true)
})

// --- installSkills ---------------------------------------------------------

test('installSkills écrit le contenu du dépôt', () => {
  const dir = fixture()
  const nom = bundled[0]

  const done = installSkills([nom])

  assert.equal(
    readFileSync(join(dir, nom, 'SKILL.md'), 'utf8'),
    readFileSync(bundledPath(nom), 'utf8'),
  )
  assert.match(done.join('\n'), /installé/)
})

test('installSkills est réexécutable sans doublon', () => {
  const dir = fixture()
  const nom = bundled[0]

  installSkills([nom])
  const done = installSkills([nom])

  assert.equal(done.length, 1)
  assert.match(done[0], /mis à jour/)
  assert.equal(
    readFileSync(join(dir, nom, 'SKILL.md'), 'utf8'),
    readFileSync(bundledPath(nom), 'utf8'),
  )
})

test('un nom hors catalogue n’écrit rien et n’interrompt pas le lot', () => {
  const dir = fixture()
  const done = installSkills(['../evasion', bundled[0]])

  assert.match(done[0], /inconnu du catalogue/)
  assert.ok(existsSync(join(dir, bundled[0], 'SKILL.md')))
  // Rien n'est sorti du dossier des skills.
  assert.ok(!existsSync(join(dir, '..', 'evasion')))
})

test('un skill externe rend la commande, sans rien écrire', () => {
  const dir = fixture()
  const done = installSkills([externe])

  assert.match(done[0], /à installer vous-même/)
  assert.ok(!existsSync(join(dir, externe)))
})

test('installSkills sans argument ne fait rien', () => {
  fixture()
  assert.deepEqual(installSkills(undefined), [])
  assert.deepEqual(installSkills([]), [])
})

test('skillsDir suit la variable d’environnement', () => {
  const dir = fixture()
  assert.equal(skillsDir(), dir)
})
