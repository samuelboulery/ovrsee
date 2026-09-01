import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { realpathSync } from 'node:fs'

import { repoRoot } from './entree.js'

/** Une URL, pas un chemin relatif : sous Windows, `import()` n'accepte que la première. */
const MODULE = JSON.stringify(new URL('./entree.js', import.meta.url).href)

const depotNeuf = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovrsee-entree-')))
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}

test('repoRoot rend la racine du dépôt qui contient cwd', () => {
  const root = depotNeuf()
  const sous = join(root, 'a', 'b')
  mkdirSync(sous, { recursive: true })
  assert.equal(repoRoot(sous), root)
})

test('repoRoot rend null hors dépôt git', () => {
  // `tmpdir()` lui-même : hors de tout dépôt, sur macOS comme sur Linux.
  const dehors = realpathSync(mkdtempSync(join(tmpdir(), 'ovrsee-sans-git-')))
  assert.equal(repoRoot(dehors), null)
})

test('repoRoot rend null sur un dossier inexistant, sans lever', () => {
  assert.equal(repoRoot(join(tmpdir(), 'ovrsee-absent-' + Date.now())), null)
})

test('readStdin rend une chaîne vide quand stdin est fermé', () => {
  // Le sous-processus a `stdin` sur `/dev/null` fermé : c'est le cas d'un hook
  // lancé à la main. Il doit répondre '' et sortir 0, pas lever.
  const out = execFileSync(
    process.execPath,
    ['-e', `import(${MODULE}).then(m => process.stdout.write(JSON.stringify(m.readStdin())))`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(out, '""')
})

test('readStdin rend ce qui a été écrit sur stdin', () => {
  const out = execFileSync(
    process.execPath,
    ['-e', `import(${MODULE}).then(m => process.stdout.write(m.readStdin()))`],
    { encoding: 'utf8', input: '{"session_id":"abc"}' },
  )
  assert.equal(out, '{"session_id":"abc"}')
})
