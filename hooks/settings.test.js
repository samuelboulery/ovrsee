import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

import {
  DEFAULT_SETTINGS,
  readSettings,
  validateSettings,
  writeSettings,
  mergeSettings,
} from './settings.js'

const tempDir = () => mkdtempSync(join(tmpdir(), 'cockpit-settings-'))

test('DEFAULT_SETTINGS a le schéma complet', () => {
  assert(DEFAULT_SETTINGS.langue === 'fr')
  assert(DEFAULT_SETTINGS.theme === 'auto')
  assert(Array.isArray(DEFAULT_SETTINGS.onglets.actifs))
  assert(Array.isArray(DEFAULT_SETTINGS.onglets.ordre))
  assert(DEFAULT_SETTINGS.terminal.visible === true)
  assert(DEFAULT_SETTINGS.terminal.disposition === 'bottom')
})

test('readSettings avec fichier absent → défaut', () => {
  const dir = tempDir()
  try {
    process.env.COCKPIT_SETTINGS = join(dir, 'inexistant.json')
    const settings = readSettings()
    assert.deepEqual(settings, DEFAULT_SETTINGS)
  } finally {
    delete process.env.COCKPIT_SETTINGS
    rmSync(dir, { recursive: true })
  }
})

test('readSettings avec fichier corrompu → défaut', () => {
  const dir = tempDir()
  try {
    const file = join(dir, 'settings.json')
    writeFileSync(file, '{broken json')
    process.env.COCKPIT_SETTINGS = file
    const settings = readSettings()
    assert.deepEqual(settings, DEFAULT_SETTINGS)
  } finally {
    delete process.env.COCKPIT_SETTINGS
    rmSync(dir, { recursive: true })
  }
})

test('validateSettings avec null → défaut', () => {
  const result = validateSettings(null)
  assert.deepEqual(result, DEFAULT_SETTINGS)
})

test('validateSettings avec non-objet → défaut', () => {
  const result = validateSettings('pas un objet')
  assert.deepEqual(result, DEFAULT_SETTINGS)
})

test('validateSettings avec tableau → défaut', () => {
  const result = validateSettings([])
  assert.deepEqual(result, DEFAULT_SETTINGS)
})

test('validateSettings : langue invalide retombe au défaut', () => {
  const result = validateSettings({ langue: 'de' })
  assert.equal(result.langue, 'fr')
})

test('validateSettings : langue valide acceptée', () => {
  const result = validateSettings({ langue: 'en' })
  assert.equal(result.langue, 'en')
})

test('validateSettings : theme invalide retombe au défaut', () => {
  const result = validateSettings({ theme: 42 })
  assert.equal(result.theme, 'auto')
})

test('validateSettings : theme valide accepté', () => {
  const result = validateSettings({ theme: 'dark' })
  assert.equal(result.theme, 'dark')
})

test('validateSettings : densiteActivite.granularite invalide', () => {
  const result = validateSettings({ densiteActivite: { granularite: 'invalide' } })
  assert.equal(result.densiteActivite.granularite, 'semaine')
})

test('validateSettings : densiteActivite.fenetre valide acceptée', () => {
  const result = validateSettings({ densiteActivite: { fenetre: 'an' } })
  assert.equal(result.densiteActivite.fenetre, 'an')
})

test('validateSettings : onglets.actifs invalides retombent au défaut', () => {
  const result = validateSettings({ onglets: { actifs: ['inexistant'] } })
  assert.deepEqual(result.onglets.actifs, DEFAULT_SETTINGS.onglets.actifs)
})

test('validateSettings : onglets.actifs partiellement invalides conserve les valides', () => {
  const result = validateSettings({ onglets: { actifs: ['apercu', 'inexistant'] } })
  assert.deepEqual(result.onglets.actifs, ['apercu'])
})

test('validateSettings : onglets.ordre invalide retombe au défaut', () => {
  const result = validateSettings({ onglets: { ordre: ['inexistant', 'apercu'] } })
  assert.deepEqual(result.onglets.ordre, DEFAULT_SETTINGS.onglets.ordre)
})

test('validateSettings : onglets.ordre complet valide accepté', () => {
  const ordre = ['stack', 'donnees', 'tableau', 'historique', 'produit', 'navigateur', 'apercu']
  const result = validateSettings({ onglets: { ordre } })
  assert.deepEqual(result.onglets.ordre, ordre)
})

test('validateSettings : terminal.visible invalide retombe au défaut', () => {
  const result = validateSettings({ terminal: { visible: 'oui' } })
  assert.equal(result.terminal.visible, true)
})

test('validateSettings : terminal.disposition valide acceptée', () => {
  const result = validateSettings({ terminal: { disposition: 'side' } })
  assert.equal(result.terminal.disposition, 'side')
})

test('validateSettings : terminal.hauteur valide acceptée', () => {
  const result = validateSettings({ terminal: { hauteur: 300 } })
  assert.equal(result.terminal.hauteur, 300)
})

test('validateSettings : terminal.hauteur <= 0 retombe au défaut', () => {
  const result = validateSettings({ terminal: { hauteur: -1 } })
  assert.equal(result.terminal.hauteur, 244)
})

test('validateSettings : bootstrap vide accepté', () => {
  const result = validateSettings({ bootstrap: [] })
  assert.deepEqual(result.bootstrap, [])
})

test('validateSettings : bootstrap avec non-strings retombe au défaut', () => {
  const result = validateSettings({ bootstrap: ['/project-setup', 123] })
  assert.deepEqual(result.bootstrap, DEFAULT_SETTINGS.bootstrap)
})

test('writeSettings écrit et readSettings relit', () => {
  const dir = tempDir()
  try {
    const file = join(dir, 'settings.json')
    process.env.COCKPIT_SETTINGS = file
    const custom = validateSettings({ langue: 'en', theme: 'dark' })
    writeSettings(custom)
    const read = readSettings()
    assert.equal(read.langue, 'en')
    assert.equal(read.theme, 'dark')
  } finally {
    delete process.env.COCKPIT_SETTINGS
    rmSync(dir, { recursive: true })
  }
})

test('mergeSettings : projet ne surcharge pas langue', () => {
  const global = { ...DEFAULT_SETTINGS, langue: 'en' }
  const project = { langue: 'fr' }
  const result = mergeSettings(global, project)
  assert.equal(result.langue, 'en')
})

test('mergeSettings : projet ne surcharge pas theme', () => {
  const global = { ...DEFAULT_SETTINGS, theme: 'dark' }
  const project = { theme: 'light' }
  const result = mergeSettings(global, project)
  assert.equal(result.theme, 'dark')
})

test('mergeSettings : projet ne surcharge pas densiteActivite', () => {
  const global = { ...DEFAULT_SETTINGS, densiteActivite: { granularite: 'mois', fenetre: 'an' } }
  const project = { densiteActivite: { granularite: 'jour', fenetre: 'jour' } }
  const result = mergeSettings(global, project)
  assert.equal(result.densiteActivite.granularite, 'mois')
  assert.equal(result.densiteActivite.fenetre, 'an')
})

test('mergeSettings : projet surcharge onglets.actifs', () => {
  const global = { ...DEFAULT_SETTINGS }
  const project = { onglets: { actifs: ['apercu', 'stack'] } }
  const result = mergeSettings(global, project)
  assert.deepEqual(result.onglets.actifs, ['apercu', 'stack'])
})

test('mergeSettings : projet surcharge terminal.visible', () => {
  const global = { ...DEFAULT_SETTINGS }
  const project = { terminal: { visible: false } }
  const result = mergeSettings(global, project)
  assert.equal(result.terminal.visible, false)
})

test('mergeSettings : projet surcharge packageManager', () => {
  const global = { ...DEFAULT_SETTINGS }
  const project = { packageManager: 'npm' }
  const result = mergeSettings(global, project)
  assert.equal(result.packageManager, 'npm')
})

test('mergeSettings : projet surcharge sourceGraphe', () => {
  const global = { ...DEFAULT_SETTINGS }
  const project = { sourceGraphe: 'obsidian' }
  const result = mergeSettings(global, project)
  assert.equal(result.sourceGraphe, 'obsidian')
})

test('mergeSettings : fusion partielle conserve globale pour non-surchargés', () => {
  const global = { ...DEFAULT_SETTINGS, theme: 'dark' }
  const project = { onglets: { actifs: ['apercu'] } }
  const result = mergeSettings(global, project)
  assert.equal(result.theme, 'dark')
  assert.deepEqual(result.onglets.actifs, ['apercu'])
})
