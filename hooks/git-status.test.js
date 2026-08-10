import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { gitStatus } from './git-status.js'

const sh = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

const initRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-status-'))
  sh(dir, ['init', '-b', 'main', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Test'])
  return dir
}

const commit = (dir, file, message) => {
  writeFileSync(join(dir, file), `${message}\n`)
  sh(dir, ['add', file])
  sh(dir, ['commit', '-q', '-m', message])
}

test('gitStatus hors dépôt git rend un état vide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'not-a-repo-'))
  assert.deepEqual(gitStatus(dir), {
    branch: null,
    dirty: { staged: 0, unstaged: 0, untracked: 0, files: [] },
    branches: [],
    lastFetch: null,
  })
})

test('gitStatus lit la branche courante et une branche sans remote', () => {
  const dir = initRepo()
  commit(dir, 'a.txt', 'premier commit')

  const status = gitStatus(dir)
  assert.equal(status.branch, 'main')
  assert.deepEqual(status.dirty, { staged: 0, unstaged: 0, untracked: 0, files: [] })
  assert.deepEqual(status.branches, [{ name: 'main', upstream: null, ahead: 0, behind: 0 }])
  assert.equal(status.lastFetch, null)
})

test('gitStatus compte les fichiers indexés, modifiés et non suivis séparément', () => {
  const dir = initRepo()
  commit(dir, 'a.txt', 'premier commit')

  writeFileSync(join(dir, 'a.txt'), 'modifié\n')
  writeFileSync(join(dir, 'nouveau.txt'), 'nouveau\n')
  writeFileSync(join(dir, 'b.txt'), 'à indexer\n')
  sh(dir, ['add', 'b.txt'])

  const status = gitStatus(dir)
  assert.deepEqual(status.dirty, {
    staged: 1,
    unstaged: 1,
    untracked: 1,
    files: ['a.txt', 'b.txt', 'nouveau.txt'],
  })
})

test('gitStatus rend ahead/behind pour une branche suivie', () => {
  const remote = mkdtempSync(join(tmpdir(), 'git-status-remote-'))
  sh(remote, ['init', '-b', 'main', '-q', '--bare'])

  const a = initRepo()
  sh(a, ['remote', 'add', 'origin', remote])
  commit(a, 'a.txt', 'premier commit')
  sh(a, ['push', '-q', '-u', 'origin', 'main'])

  const b = mkdtempSync(join(tmpdir(), 'git-status-clone-'))
  sh(b, ['clone', '-q', remote, '.'])
  sh(b, ['config', 'user.email', 'test@example.com'])
  sh(b, ['config', 'user.name', 'Test'])

  // A avance sans pousser : ahead vu depuis A.
  commit(a, 'a.txt', 'second commit')
  let status = gitStatus(a)
  assert.deepEqual(status.branches, [{ name: 'main', upstream: 'origin/main', ahead: 1, behind: 0 }])

  // A pousse, puis B fetch (sans merge) : B est en retard sur origin/main.
  sh(a, ['push', '-q'])
  sh(b, ['fetch', '-q'])
  status = gitStatus(b)
  assert.deepEqual(status.branches, [{ name: 'main', upstream: 'origin/main', ahead: 0, behind: 1 }])
  assert.notEqual(status.lastFetch, null)
})
