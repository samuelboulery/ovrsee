#!/usr/bin/env node
/**
 * Hook git `post-merge` : rattraper ce qui arrive de l'extérieur.
 *
 * Il tourne après un `git pull` ou un `git merge` — c'est-à-dire au moment
 * précis où un commit né sur les serveurs de GitHub, squash-mergé depuis une
 * pull request, touche cette machine pour la première fois. Le hook
 * `post-commit` ne l'a jamais vu : il n'a pas été committé ici.
 *
 * Il n'écrit que sur les plans ouverts, et seulement d'après les tickets cités
 * dans le message. Sans plan ouvert, il ne lance même pas git.
 *
 * Silencieux quand il n'y a rien à faire, et jamais bloquant : un rattrapage
 * raté ne doit pas faire échouer un `git pull`.
 */

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { reconcile } from './reconcile.js'

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    const ovrseeDir = join(root, 'ovrsee')
    if (existsSync(ovrseeDir)) {
      reconcile(ovrseeDir, root, message => process.stderr.write(message))
    }
  } catch {
    // Un `git pull` ne doit jamais échouer à cause de l'ovrsee.
  }
}
