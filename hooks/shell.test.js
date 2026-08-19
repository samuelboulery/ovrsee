/**
 * Comment on lance la commande `dev` d'un projet, par plateforme.
 *
 * Ce test existe parce que la CI tourne sur macOS ET Windows, et que la
 * première version lançait `/bin/zsh -lic` partout : sous Windows, un shell
 * introuvable, donc un `ENOENT` — sur une suite verte en local.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { shellRun } from './shell.js'

test('la commande dev passe par un shell interactif de connexion', { skip: process.platform === 'win32' }, () => {
  const [fichier, args, options] = shellRun('pnpm dev')

  // `-l` seul ne suffit pas : zsh ne source `.zshrc` — où vivent les PATH de
  // pnpm, nvm, mise — que pour un shell interactif. C'est le `i` qui fait
  // marcher le crawl lancé depuis le Finder, pas le `l`.
  assert.deepEqual(args, ['-lic', 'pnpm dev'])
  assert.equal(options.shell, undefined)
  assert.ok(fichier.length > 0)
})

test('sous Windows, le shell par défaut suffit', { skip: process.platform !== 'win32' }, () => {
  const [fichier, args, options] = shellRun('pnpm dev')

  // Windows n'a pas le problème que `-lic` résout : une application graphique
  // y hérite du PATH de l'utilisateur, lu dans le registre.
  assert.equal(fichier, 'pnpm dev')
  assert.equal(args, undefined)
  assert.equal(options.shell, true)
})
