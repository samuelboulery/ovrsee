#!/usr/bin/env node
/**
 * Rend `spawn-helper` de node-pty exécutable.
 *
 * Les binaires précompilés de node-pty arrivent en `-rw-r--r--` : le bit
 * d'exécution ne survit pas à l'extraction du paquet. Sur macOS, node-pty
 * passe par ce petit programme d'aide pour ouvrir un pseudo-terminal ; sans le
 * bit, tout `spawn` échoue sur un « posix_spawnp failed » qui ne dit rien de
 * la cause réelle.
 *
 * Exécuté en `postinstall` du dépôt : les scripts du projet lui-même ne sont
 * pas bloqués par pnpm, seuls ceux des dépendances le sont.
 */

import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Cherche les `spawn-helper` sous node_modules, en suivant le store pnpm. */
function findHelpers(dir, found = [], depth = 0) {
  if (depth > 8) return found

  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      findHelpers(path, found, depth + 1)
    } else if (entry.name === 'spawn-helper') {
      found.push(path)
    }
  }
  return found
}

const modules = join(root, 'node_modules')
if (!existsSync(modules)) process.exit(0)

let fixed = 0
for (const helper of findHelpers(modules)) {
  // 0o111 = bits d'exécution. On n'ajoute rien d'autre.
  const mode = statSync(helper).mode
  if ((mode & 0o111) === 0o111) continue

  chmodSync(helper, mode | 0o111)
  fixed += 1
}

if (fixed > 0) console.log(`spawn-helper rendu exécutable (${fixed} fichier(s))`)
