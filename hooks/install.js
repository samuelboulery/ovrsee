#!/usr/bin/env node
/**
 * Installe la capture cockpit dans un dépôt.
 *
 *   node hooks/install.js [chemin-du-dépôt]
 *
 * Deux choses :
 *
 * 1. un bloc délimité dans `.git/hooks/post-commit`, en préservant ce qui s'y
 *    trouve déjà (Graphify installe son propre bloc au même endroit) ;
 * 2. les deux hooks Claude Code dans `~/.claude/settings.json`.
 *
 * Réexécutable sans effet cumulatif : les blocs sont repérés et remplacés,
 * jamais empilés.
 *
 * L'écriture dans la configuration globale est annoncée, sauvegardée avant, et
 * relue après. Les entrées existantes — DetachIsland, caveman — sont
 * conservées : on ajoute au tableau, on ne le remplace jamais.
 */

import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
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
// --- hooks Claude Code ------------------------------------------------------

const SETTINGS = join(homedir(), '.claude', 'settings.json')

/** Une entrée est-elle déjà celle du cockpit ? */
const isCockpit = (entry, script) => JSON.stringify(entry).includes(script)

function installClaudeHooks() {
  if (!existsSync(SETTINGS)) {
    console.log(`\n${SETTINGS} absent — hooks Claude Code non installés.`)
    return
  }

  const original = readFileSync(SETTINGS, 'utf8')

  let settings
  try {
    settings = JSON.parse(original)
  } catch (err) {
    console.error(`\n${SETTINGS} illisible (${err.message}) — laissé intact.`)
    return
  }

  const hooks = (settings.hooks ??= {})
  const added = []

  const sessionStart = (hooks.SessionStart ??= [])
  if (!sessionStart.some(e => isCockpit(e, 'cockpit-session-start'))) {
    sessionStart.push({
      hooks: [
        {
          type: 'command',
          command: `node "${join(HERE, 'cockpit-session-start.js')}"`,
          timeout: 5,
          statusMessage: 'Lecture du cockpit...',
        },
      ],
    })
    added.push('SessionStart — réinjection de l’état du projet')
  }

  const postToolUse = (hooks.PostToolUse ??= [])
  if (!postToolUse.some(e => isCockpit(e, 'cockpit-capture-plan'))) {
    postToolUse.push({
      matcher: 'ExitPlanMode',
      hooks: [{ type: 'command', command: `node "${join(HERE, 'cockpit-capture-plan.js')}"` }],
    })
    added.push('PostToolUse/ExitPlanMode — capture des plans approuvés')
  }

  if (added.length === 0) {
    console.log('\nHooks Claude Code : déjà installés.')
    return
  }

  // Sauvegarde avant écriture : ce fichier n'est pas versionné.
  const backup = `${SETTINGS}.avant-cockpit`
  copyFileSync(SETTINGS, backup)

  const updated = JSON.stringify(settings, null, 2) + '\n'
  writeFileSync(SETTINGS, updated, 'utf8')

  // Relecture : mieux vaut restaurer tout de suite qu'aller découvrir demain
  // une configuration cassée.
  try {
    JSON.parse(readFileSync(SETTINGS, 'utf8'))
  } catch (err) {
    writeFileSync(SETTINGS, original, 'utf8')
    console.error(`\nÉcriture invalide (${err.message}) — configuration restaurée.`)
    return
  }

  console.log(`\nHooks Claude Code installés (sauvegarde : ${backup}) :`)
  for (const line of added) console.log(`  + ${line}`)
}

installClaudeHooks()
