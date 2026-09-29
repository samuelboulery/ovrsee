/**
 * Comment on lance la commande `dev` d'un projet, par plateforme.
 *
 * Ce test existe parce que la CI tourne sur macOS ET Windows, et que la
 * première version lançait `/bin/zsh -lic` partout : sous Windows, un shell
 * introuvable, donc un `ENOENT` — sur une suite verte en local.
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import { loginShell, loginShellArgs, shellRun } from './shell.js'

test('la commande dev passe par un shell interactif de connexion', { skip: process.platform === 'win32' }, () => {
  const [fichier, args, options] = shellRun('pnpm dev')

  // `-l` seul ne suffit pas : zsh ne source `.zshrc` — où vivent les PATH de
  // pnpm, nvm, mise — que pour un shell interactif. C'est le `i` qui fait
  // marcher le crawl lancé depuis le Finder, pas le `l`.
  assert.deepEqual(args, ['-lic', 'pnpm dev'])
  assert.equal(options.shell, undefined)
  assert.ok(fichier.length > 0)

  // Son propre groupe de processus : c'est ce que `killTree` vise pour
  // emporter aussi l'enfant que `pnpm dev` laisse derrière lui.
  assert.equal(options.detached, true)
})

test('sous Windows, le shell par défaut suffit', { skip: process.platform !== 'win32' }, () => {
  const [fichier, args, options] = shellRun('pnpm dev')

  // Windows n'a pas le problème que `-lic` résout : une application graphique
  // y hérite du PATH de l'utilisateur, lu dans le registre.
  assert.equal(fichier, 'pnpm dev')
  assert.equal(args, undefined)
  assert.equal(options.shell, true)

  // Et surtout pas détaché. `shell: true` fait du fils un `cmd.exe` : détaché,
  // il prend sa propre console et ce qu'il lance y écrit — les tuyaux de
  // l'appelant restent vides, et l'échec de `dev` devient un silence. Windows
  // n'a pas de groupes de processus, donc rien n'est perdu : `killTree` y
  // descend l'arbre par `taskkill /T`.
  assert.equal(options.detached, false)
})

/**
 * Le shell du terminal intégré, l'autre appelant.
 *
 * Ce test existe parce que `shellRun` avait été rendu portable et `loginShell`
 * pas : sous Windows, `SHELL` n'existe pas, le repli `/bin/zsh` sortait tel
 * quel, et le panneau terminal s'ouvrait sur « impossible d'ouvrir un shell
 * (/bin/zsh) : File not found ». `-l`, codé en dur côté `electron/pty.js`,
 * était le second piège du même trajet.
 */
test('le shell de connexion existe sur la plateforme courante', () => {
  const shell = loginShell()

  assert.ok(shell.length > 0)
  if (process.platform === 'win32') {
    assert.match(shell, /cmd\.exe$/i)
    // `-l` est un drapeau POSIX : `cmd.exe` le prendrait pour un fichier.
    assert.deepEqual(loginShellArgs(), [])
  } else {
    assert.ok(existsSync(shell), `${shell} devrait exister`)
    assert.deepEqual(loginShellArgs(), ['-l'])
  }
})

/**
 * La preuve par le comportement du test ci-dessus : ce n'est pas une
 * préférence de style, c'est Windows qui perd la sortie d'un `cmd.exe`
 * détaché. Le test tourne sur les deux plateformes — sur POSIX il vérifie
 * simplement que la commande `dev` est lisible, ce qu'elle doit être partout.
 *
 * `node --version` et pas `echo` : c'est un PETIT-fils qu'il faut, comme
 * `pnpm dev` l'est. `echo` est une primitive de `cmd.exe` lui-même, dont la
 * sortie passe par le tuyau même détaché — le test serait vert sur le bug.
 */
test("la sortie de la commande dev est lisible par l'appelant", async () => {
  const [fichier, args, options] = shellRun('node --version')
  const enfant = spawn(fichier, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let trace = ''
  enfant.stdout.setEncoding('utf8')
  enfant.stdout.on('data', morceau => {
    trace += morceau
  })

  // `close` et non `exit` : c'est lui qui attend que les tuyaux aient rendu
  // leurs derniers octets.
  await once(enfant, 'close')

  assert.match(trace, /^v\d+\./)
})
