import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installClaudeHooks, installPostCommit, signalInstalle } from './install.js'

const START = '# ovrsee-hook-start'
const END = '# ovrsee-hook-end'
const GRAPHIFY_START = '# graphify-hook-start'
const GRAPHIFY_END = '# graphify-hook-end'

/**
 * Crée un répertoire de travail avec un dossier .git/hooks.
 */
function tempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-install-'))
  mkdirSync(join(root, '.git', 'hooks'), { recursive: true })
  return root
}

// --- installation du bloc ovrsee ---

test("le bloc ovrsee s'installe complètement dans un post-commit vide", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  installPostCommit(root, done)

  assert.ok(existsSync(hookPath), 'le fichier post-commit est créé')
  const content = readFileSync(hookPath, 'utf8')
  assert.ok(content.includes(START), 'contient le marqueur de début')
  assert.ok(content.includes(END), 'contient le marqueur de fin')
  assert.match(done.join('\n'), /bloc ovrsee installé/)
})

// Windows n'a pas de bit d'exécution : `chmod` y est un no-op et le mode reste
// 0o600. Le hook y est lancé par git bash, qui ne le regarde pas.
test('le fichier post-commit créé est exécutable', { skip: process.platform === 'win32' }, () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  installPostCommit(root, done)

  const stat = statSync(hookPath)
  // Vérifie que le mode inclut l'exécution pour le propriétaire (0o755)
  assert.equal(stat.mode & 0o700, 0o700, 'le fichier est exécutable')
})

test("remplacer le bloc ovrsee d'un post-commit existant le laisse le reste intact", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Crée un fichier avec un bloc ovrsee déjà installé
  const existing = [
    '#!/bin/sh',
    START,
    '# ancien contenu ovrsee',
    END,
    'echo "autre chose"',
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  assert.ok(content.includes('autre chose'), 'le contenu hors bloc est préservé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc est remplacé')
  // Vérifie que l'ancien contenu ovrsee n'est plus là
  assert.ok(!content.includes('ancien contenu ovrsee'), 'l\'ancien contenu ovrsee est supprimé')
})

test('graphify avant ovrsee : les deux blocs coexistent, seul ovrsee est remplacé', () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Ordre : graphify PUIS ovrsee
  const existing = [
    '#!/bin/sh',
    GRAPHIFY_START,
    'echo "graphify"',
    GRAPHIFY_END,
    START,
    'echo "ovrsee ancien"',
    END,
    'echo "fin"',
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  // Graphify survit
  assert.ok(content.includes(GRAPHIFY_START), 'le bloc graphify est intact')
  assert.ok(content.includes('echo "graphify"'), 'le contenu graphify survit')
  // Ovrsee est remplacé
  assert.ok(!content.includes('ovrsee ancien'), 'l\'ancien ovrsee est remplacé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc ovrsee est présent')
  // Fin survit
  assert.ok(content.includes('fin'), 'le contenu après le bloc survit')
})

test('graphify après ovrsee : les deux blocs coexistent, seul ovrsee est remplacé', () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Ordre : ovrsee PUIS graphify
  const existing = [
    '#!/bin/sh',
    START,
    'echo "ovrsee ancien"',
    END,
    GRAPHIFY_START,
    'echo "graphify"',
    GRAPHIFY_END,
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  // Ovrsee est remplacé mais graphify survit
  assert.ok(!content.includes('ovrsee ancien'), 'l\'ancien ovrsee est remplacé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc ovrsee est présent')
  assert.ok(content.includes(GRAPHIFY_START), 'le bloc graphify survit')
  assert.ok(content.includes('echo "graphify"'), 'le contenu graphify survit')
})

test("un post-commit avec marqueur d'ouverture mais pas de fermeture échoue", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Marqueur START mais pas END
  const existing = [
    '#!/bin/sh',
    START,
    'echo "oups, pas de fin"',
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')
  const contentBefore = readFileSync(hookPath, 'utf8')

  assert.throws(() => installPostCommit(root, done), /ovrsee-hook-end|non refermé/)

  // Vérifie que le fichier est inchangé
  const contentAfter = readFileSync(hookPath, 'utf8')
  assert.equal(contentAfter, contentBefore, 'le fichier n\'a pas été modifié après erreur')
})

test("un marqueur de fermeture sans ouverture n'est pas un problème", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Marqueur END mais pas START
  const existing = [
    '#!/bin/sh',
    'echo "quelque chose"',
    END,
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  // Ne doit pas lancer d'erreur
  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  // Le bloc est ajouté à la fin
  assert.ok(content.includes(START) && content.includes(END), 'le bloc est ajouté')
})

// --- le signal de session est-il enregistré ? ---

/** Écrit un `settings.json` jetable et rend son chemin. */
function tempSettings(contenu) {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-settings-'))
  const path = join(dir, 'settings.json')
  writeFileSync(path, typeof contenu === 'string' ? contenu : JSON.stringify(contenu), 'utf8')
  return path
}

/** Une entrée de hook telle que l'installateur en écrit. */
const entree = script => ({ hooks: [{ type: 'command', command: `node '/x/hooks/${script}'` }] })

test('signalInstalle : vrai quand les deux événements portent ovrsee-notify', () => {
  const path = tempSettings({
    hooks: {
      Stop: [entree('ovrsee-tool-stop.js'), entree('ovrsee-notify.js')],
      Notification: [entree('ovrsee-notify.js')],
    },
  })

  assert.equal(signalInstalle(path), true)
})

test('signalInstalle : un seul des deux événements ne suffit pas', () => {
  // `Stop` seul dirait « c'est à toi » sans jamais signaler une question ;
  // `Notification` seul laisserait l'attente allumée après coup.
  const stopSeul = tempSettings({ hooks: { Stop: [entree('ovrsee-notify.js')], Notification: [] } })
  const notifSeule = tempSettings({ hooks: { Notification: [entree('ovrsee-notify.js')] } })

  assert.equal(signalInstalle(stopSeul), false)
  assert.equal(signalInstalle(notifSeule), false)
})

test('signalInstalle : un autre hook ovrsee ne compte pas pour celui-là', () => {
  const path = tempSettings({
    hooks: { Stop: [entree('ovrsee-tool-stop.js')], Notification: [entree('ovrsee-capture-audit.js')] },
  })

  assert.equal(signalInstalle(path), false)
})

test('signalInstalle : un fichier absent ou illisible vaut « non installé »', () => {
  // Rendre faux plutôt que lever : l'appelant est le processus principal
  // d'Electron, et une exception y coûterait plus que l'information.
  assert.equal(signalInstalle(join(tmpdir(), 'ovrsee-absent-jamais-cree.json')), false)
  assert.equal(signalInstalle(tempSettings('{ ceci n’est pas du JSON')), false)
  assert.equal(signalInstalle(tempSettings({})), false, 'aucun hook du tout')
})

// --- enregistrement des hooks Claude Code ----------------------------------

/**
 * Un `settings.json` jetable. Ces cas existent parce que l'oubli qu'ils
 * couvrent était invisible : quatre hooks ne tournaient que sur les machines
 * où quelqu'un les avait ajoutés à la main.
 */
const settingsJetable = (contenu = { hooks: {} }) => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-settings-'))
  const path = join(dir, 'settings.json')
  writeFileSync(path, JSON.stringify(contenu, null, 2), 'utf8')
  return path
}

/** Les scripts ovrsee enregistrés pour un événement donné. */
const scriptsDe = (settings, event) =>
  (settings.hooks?.[event] ?? []).flatMap(e => (e.hooks ?? []).map(h => h.command)).join(' ')

test('installClaudeHooks enregistre les sept hooks de l’ovrsee', () => {
  const path = settingsJetable()

  installClaudeHooks([], path)
  const settings = JSON.parse(readFileSync(path, 'utf8'))

  assert.match(scriptsDe(settings, 'SessionStart'), /ovrsee-session-start\.js/)
  assert.match(scriptsDe(settings, 'SessionEnd'), /ovrsee-session-end\.js/)
  assert.match(scriptsDe(settings, 'PostToolUse'), /ovrsee-capture-plan\.js/)
  assert.match(scriptsDe(settings, 'PostToolUse'), /ovrsee-tool-edit\.js/)
  assert.match(scriptsDe(settings, 'PostToolUse'), /ovrsee-capture-audit\.js/)
  assert.match(scriptsDe(settings, 'PreToolUse'), /ovrsee-tool-edit-gate\.js/)
  assert.match(scriptsDe(settings, 'Stop'), /ovrsee-tool-stop\.js/)
  assert.match(scriptsDe(settings, 'Stop'), /ovrsee-notify\.js/)
  assert.match(scriptsDe(settings, 'Notification'), /ovrsee-notify\.js/)
  assert.match(scriptsDe(settings, 'UserPromptSubmit'), /ovrsee-capture-audit\.js/)
})

test('installClaudeHooks est réexécutable sans empiler les entrées', () => {
  const path = settingsJetable()

  installClaudeHooks([], path)
  const apresUn = JSON.parse(readFileSync(path, 'utf8'))

  const second = []
  installClaudeHooks(second, path)
  const apresDeux = JSON.parse(readFileSync(path, 'utf8'))

  assert.deepEqual(apresDeux.hooks, apresUn.hooks)
  assert.ok(second.some(l => /déjà installés/.test(l)))
})

test('installClaudeHooks garde les entrées qui ne sont pas les siennes', () => {
  const path = settingsJetable({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node /ailleurs/autre-chose.js' }] }] },
  })

  installClaudeHooks([], path)
  const settings = JSON.parse(readFileSync(path, 'utf8'))

  assert.match(scriptsDe(settings, 'Stop'), /autre-chose\.js/)
  assert.match(scriptsDe(settings, 'Stop'), /ovrsee-tool-stop\.js/)
})

test('installClaudeHooks laisse intact un settings.json illisible', () => {
  const path = settingsJetable()
  writeFileSync(path, '{ pas du json', 'utf8')

  const done = []
  installClaudeHooks(done, path)

  assert.equal(readFileSync(path, 'utf8'), '{ pas du json')
  assert.ok(done.some(l => /illisible/.test(l)))
})
