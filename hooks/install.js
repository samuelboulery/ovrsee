#!/usr/bin/env node
/**
 * Installe la capture cockpit dans un dépôt.
 *
 *   node hooks/install.js [chemin-du-dépôt]
 *
 * Ajoute un bloc délimité à `.git/hooks/post-commit`, en préservant ce qui
 * s'y trouve déjà (Graphify installe son propre bloc au même endroit).
 * Réexécutable sans effet cumulatif.
 *
 * N'écrit PAS dans ~/.claude/settings.json : le hook PostToolUse est affiché
 * à la fin, à ajouter volontairement. Un installeur qui modifie la
 * configuration globale sans le dire est exactement ce qu'on ne veut pas.
 */

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const START = '# cockpit-hook-start'
const END = '# cockpit-hook-end'

const target = resolve(process.argv[2] ?? process.cwd())

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: target,
  encoding: 'utf8',
}).trim()

/**
 * Échappement shell : guillemets simples, avec la séquence de sortie standard
 * pour un guillemet simple interne.
 *
 * Les guillemets doubles ne suffisent pas — sh y interprète toujours `$` et
 * les accents graves. JSON.stringify ne convient pas non plus : c'est un
 * échappement JSON, pas shell, et il laisse passer `$`.
 */
const shq = value => `'${String(value).replaceAll("'", `'\\''`)}'`

const hookPath = join(root, '.git', 'hooks', 'post-commit')
const block = [
  START,
  '# Rattache le commit au plan actif de cockpit/. Installé par: node hooks/install.js',
  `${shq(process.execPath)} ${shq(join(HERE, 'cockpit-post-commit.js'))} || true`,
  END,
].join('\n')

let existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : '#!/bin/sh\n'

const start = existing.indexOf(START)
if (start !== -1) {
  // Remplace le bloc précédent, sans toucher au reste du fichier.
  const end = existing.indexOf(END, start)
  const cut = end === -1 ? existing.length : end + END.length
  existing = existing.slice(0, start) + block + existing.slice(cut)
} else {
  if (!existing.endsWith('\n')) existing += '\n'
  existing += '\n' + block + '\n'
}

writeFileSync(hookPath, existing, 'utf8')
chmodSync(hookPath, 0o755)

console.log(`post-commit : bloc cockpit installé dans ${hookPath}`)
console.log(`
Reste à activer la capture des plans approuvés. À ajouter dans
~/.claude/settings.json, sous "hooks" :

  "PostToolUse": [
    {
      "matcher": "ExitPlanMode",
      "hooks": [
        { "type": "command", "command": "node ${join(HERE, 'cockpit-capture-plan.js')}" }
      ]
    }
  ]
`)
