import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installPostCommit } from './install.js'

const START = '# cockpit-hook-start'
const END = '# cockpit-hook-end'
const GRAPHIFY_START = '# graphify-hook-start'
const GRAPHIFY_END = '# graphify-hook-end'

/**
 * Crée un répertoire de travail avec un dossier .git/hooks.
 */
function tempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cockpit-install-'))
  mkdirSync(join(root, '.git', 'hooks'), { recursive: true })
  return root
}

// --- installation du bloc cockpit ---

test("le bloc cockpit s'installe complètement dans un post-commit vide", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  installPostCommit(root, done)

  assert.ok(existsSync(hookPath), 'le fichier post-commit est créé')
  const content = readFileSync(hookPath, 'utf8')
  assert.ok(content.includes(START), 'contient le marqueur de début')
  assert.ok(content.includes(END), 'contient le marqueur de fin')
  assert.match(done.join('\n'), /bloc cockpit installé/)
})

test('le fichier post-commit créé est exécutable', () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  installPostCommit(root, done)

  const stat = statSync(hookPath)
  // Vérifie que le mode inclut l'exécution pour le propriétaire (0o755)
  assert.equal(stat.mode & 0o700, 0o700, 'le fichier est exécutable')
})

test("remplacer le bloc cockpit d'un post-commit existant le laisse le reste intact", () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Crée un fichier avec un bloc cockpit déjà installé
  const existing = [
    '#!/bin/sh',
    START,
    '# ancien contenu cockpit',
    END,
    'echo "autre chose"',
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  assert.ok(content.includes('autre chose'), 'le contenu hors bloc est préservé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc est remplacé')
  // Vérifie que l'ancien contenu cockpit n'est plus là
  assert.ok(!content.includes('ancien contenu cockpit'), 'l\'ancien contenu cockpit est supprimé')
})

test('graphify avant cockpit : les deux blocs coexistent, seul cockpit est remplacé', () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Ordre : graphify PUIS cockpit
  const existing = [
    '#!/bin/sh',
    GRAPHIFY_START,
    'echo "graphify"',
    GRAPHIFY_END,
    START,
    'echo "cockpit ancien"',
    END,
    'echo "fin"',
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  // Graphify survit
  assert.ok(content.includes(GRAPHIFY_START), 'le bloc graphify est intact')
  assert.ok(content.includes('echo "graphify"'), 'le contenu graphify survit')
  // Cockpit est remplacé
  assert.ok(!content.includes('cockpit ancien'), 'l\'ancien cockpit est remplacé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc cockpit est présent')
  // Fin survit
  assert.ok(content.includes('fin'), 'le contenu après le bloc survit')
})

test('graphify après cockpit : les deux blocs coexistent, seul cockpit est remplacé', () => {
  const root = tempRepo()
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const done = []

  // Ordre : cockpit PUIS graphify
  const existing = [
    '#!/bin/sh',
    START,
    'echo "cockpit ancien"',
    END,
    GRAPHIFY_START,
    'echo "graphify"',
    GRAPHIFY_END,
  ].join('\n')
  writeFileSync(hookPath, existing, 'utf8')

  installPostCommit(root, done)

  const content = readFileSync(hookPath, 'utf8')
  // Cockpit est remplacé mais graphify survit
  assert.ok(!content.includes('cockpit ancien'), 'l\'ancien cockpit est remplacé')
  assert.ok(content.includes(START) && content.includes(END), 'le bloc cockpit est présent')
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

  assert.throws(() => installPostCommit(root, done), /cockpit-hook-end|non refermé/)

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
