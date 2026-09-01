import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { repoRoot } from './entree.js'

/** Une URL, pas un chemin relatif : sous Windows, `import()` n'accepte que la première. */
const MODULE = JSON.stringify(new URL('./entree.js', import.meta.url).href)

const depotNeuf = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-entree-'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}

test('repoRoot rend, depuis un sous-dossier, une racine sur laquelle on recolle', () => {
  const root = depotNeuf()
  writeFileSync(join(root, 'marqueur.txt'), 'x', 'utf8')
  const sous = join(root, 'a', 'b')
  mkdirSync(sous, { recursive: true })

  const rendu = repoRoot(sous)

  // Pas d'égalité de chaînes, et ce n'est pas de la complaisance : sous Windows
  // `git rev-parse` rend des barres avant et le nom long du dossier
  // (`runneradmin`) là où `mkdtemp` rend le nom court 8.3 (`RUNNER~1`). Les deux
  // désignent le même dossier. Ce dont un appelant a besoin, c'est d'un chemin
  // sur lequel `join()` retombe sur le dépôt — c'est donc ça qu'on vérifie.
  assert.ok(rendu, 'une racine est rendue')
  assert.ok(existsSync(join(rendu, 'marqueur.txt')), `racine inutilisable : ${rendu}`)
  assert.ok(existsSync(join(rendu, '.git')), `la racine ne porte pas le dépôt : ${rendu}`)
})

test('repoRoot rend null hors dépôt git', () => {
  // `tmpdir()` lui-même : hors de tout dépôt, sur les trois plateformes.
  assert.equal(repoRoot(mkdtempSync(join(tmpdir(), 'ovrsee-sans-git-'))), null)
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
