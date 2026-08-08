#!/usr/bin/env node
/**
 * Hook SessionStart : réinjecte l'état du projet au démarrage d'une session.
 *
 * C'est la boucle inverse. Jusqu'ici le cockpit servait à ce que Sam relise
 * son projet ; ici il sert à ce que Claude Code le connaisse déjà — sans qu'on
 * le lui explique, et sans qu'il ait à lire le code pour le deviner.
 *
 * Contrat : rien sur stdin, texte simple sur stdout, exit 0 TOUJOURS. Le texte
 * émis est injecté comme contexte de démarrage.
 *
 * Silence délibéré quand il n'y a rien à dire : un dépôt sans cockpit, ou un
 * cockpit vide, ne doit pas produire une ligne de bruit à chaque session.
 */

import { execFileSync } from 'node:child_process'

import { buildBrief, readCockpit } from './brief.js'

try {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

  const state = readCockpit(root)
  if (state) {
    const brief = buildBrief(state)
    if (brief) process.stdout.write(brief + '\n')
  }
} catch {
  // Hors dépôt git, ou git absent. Rien à dire, et surtout rien à casser.
}
process.exit(0)
