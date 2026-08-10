#!/usr/bin/env node
/**
 * Installe la capture cockpit dans un dépôt.
 *
 *   node hooks/install.js [chemin-du-dépôt]
 *
 * Trois choses :
 *
 * 1. le dossier `cockpit/plans/`, seul endroit que lit `readPlans` ;
 * 2. un bloc délimité dans `.git/hooks/post-commit`, en préservant ce qui s'y
 *    trouve déjà (Graphify installe son propre bloc au même endroit) ;
 * 3. les deux hooks Claude Code dans `~/.claude/settings.json`.
 *
 * Réexécutable sans effet cumulatif : les blocs sont repérés et remplacés,
 * jamais empilés.
 *
 * L'écriture dans la configuration globale est annoncée, sauvegardée avant, et
 * relue après. Les entrées existantes — DetachIsland, caveman — sont
 * conservées : on ajoute au tableau, on ne le remplace jamais.
 *
 * Module *et* script : l'interface appelle `install()` pour équiper un projet
 * qu'on vient d'ouvrir, sans lancer de processus. Une seconde implémentation
 * de l'installation finirait par diverger de celle-ci.
 */

import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeFileNoFollow } from './plans.js'
import { installSkills } from './skills.js'
import { DEFAULT_COLUMNS } from './tickets.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const START = '# cockpit-hook-start'
const END = '# cockpit-hook-end'
const SETTINGS = join(homedir(), '.claude', 'settings.json')

/**
 * Échappement shell : guillemets simples, avec la séquence de sortie standard
 * pour un guillemet simple interne.
 *
 * Les guillemets doubles ne suffisent pas — sh y interprète toujours `$` et
 * les accents graves. JSON.stringify ne convient pas non plus : c'est un
 * échappement JSON, pas shell, et il laisse passer `$`.
 */
const shq = value => `'${String(value).replaceAll("'", `'\\''`)}'`

/**
 * La ligne qui lance `cockpit-post-commit.js` à chaque commit.
 *
 * Depuis l'application empaquetée, deux pièges se combinent : `process.execPath`
 * est le binaire Cockpit et non `node` — l'écrire tel quel ferait ouvrir la
 * fenêtre à chaque commit — et le script est resté dans `app.asar`, que `node`
 * ne sait pas lire. `ELECTRON_RUN_AS_NODE=1` résout les deux d'un coup : le même
 * binaire se comporte alors en node, et lui seul sait ouvrir l'archive.
 */
function commandFor(scriptName) {
  const script = shq(join(HERE, scriptName))
  const runtime = shq(process.execPath)

  return process.versions.electron
    ? `ELECTRON_RUN_AS_NODE=1 ${runtime} ${script}`
    : `${runtime} ${script}`
}

/** Le bloc cockpit du `post-commit`, installé ou remplacé sans toucher au reste. */
export function installPostCommit(root, done) {
  const hookPath = join(root, '.git', 'hooks', 'post-commit')
  const block = [
    START,
    '# Rattache le commit au plan actif de cockpit/. Installé par: node hooks/install.js',
    `${commandFor('cockpit-post-commit.js')} || true`,
    END,
  ].join('\n')

  let existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : '#!/bin/sh\n'

  const start = existing.indexOf(START)
  if (start !== -1) {
    // Remplace le bloc précédent, sans toucher au reste du fichier.
    const end = existing.indexOf(END, start)
    // Si le marqueur de début existe mais pas le marqueur de fin, le fichier
    // est endommagé : refuser de modifier plutôt que d'effacer la suite.
    if (end === -1) {
      throw new Error(`${hookPath} contient un marqueur cockpit non refermé (${START} sans ${END})`)
    }
    const cut = end + END.length
    existing = existing.slice(0, start) + block + existing.slice(cut)
  } else {
    if (!existing.endsWith('\n')) existing += '\n'
    existing += '\n' + block + '\n'
  }

  // Écriture atomique : temp puis rename, puis chmod
  writeFileNoFollow(hookPath, existing)
  chmodSync(hookPath, 0o755)

  done.push(`post-commit : bloc cockpit installé dans ${hookPath}`)
}

/** Une entrée est-elle déjà celle du cockpit ? */
const isCockpit = (entry, script) => JSON.stringify(entry).includes(script)

function installClaudeHooks(done) {
  if (!existsSync(SETTINGS)) {
    done.push(`${SETTINGS} absent — hooks Claude Code non installés.`)
    return
  }

  const original = readFileSync(SETTINGS, 'utf8')

  let settings
  try {
    settings = JSON.parse(original)
  } catch (err) {
    done.push(`${SETTINGS} illisible (${err.message}) — laissé intact.`)
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
          command: commandFor('cockpit-session-start.js'),
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
      hooks: [{ type: 'command', command: commandFor('cockpit-capture-plan.js') }],
    })
    added.push('PostToolUse/ExitPlanMode — capture des plans approuvés')
  }

  if (added.length === 0) {
    done.push('Hooks Claude Code : déjà installés.')
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
    done.push(`Écriture invalide (${err.message}) — configuration restaurée.`)
    return
  }

  done.push(`Hooks Claude Code installés (sauvegarde : ${backup}) :`)
  for (const line of added) done.push(`  + ${line}`)
}

/**
 * Écrit `cockpit.config.json` — ce qui débloque le crawl, qui refuse de démarrer
 * sans lui (`crawl/index.js`).
 *
 * **Jamais écrasé.** Le fichier ne sert pas qu'au crawl : `mergeSettings` y lit
 * aussi les surcharges de préférences du projet. L'écraser pour deux champs en
 * emporterait d'autres, sans rapport. Et `install` doit rester réexécutable.
 *
 * Les trois champs sont écrits en clair même quand ils valent les défauts du
 * crawler : un fichier vide, « parce que ça vaut les défauts », n'apprendrait
 * rien à qui l'ouvre. Le reste — `maxPages`, `viewport`, `auth` — reste implicite.
 */
function writeCockpitConfig(root, { dev, baseUrl }, done) {
  const path = join(root, 'cockpit.config.json')
  if (existsSync(path)) {
    done.push('cockpit.config.json existait déjà — conservé tel quel')
    return
  }

  writeFileNoFollow(path, JSON.stringify({ dev, baseUrl, entryRoutes: ['/'] }, null, 2) + '\n')
  done.push(`cockpit.config.json écrit (${dev} → ${baseUrl})`)
}

/**
 * Équipe un dépôt. Rend la liste de ce qui a été fait, ligne par ligne — c'est
 * ce que le CLI affiche et ce que l'interface montre après un « Initialiser ».
 *
 * Les skills demandés s'installent en dernier : ils vont dans `~/.claude/`, pas
 * dans le dépôt, et rater cette étape ne doit pas laisser le projet à moitié
 * équipé.
 *
 * **L'ordre du premier commit n'est pas cosmétique.** Il passe avant la pose du
 * hook post-commit et l'écriture de la configuration, parce que ce hook lance un
 * crawl détaché — le serveur de développement du projet observé — dès qu'un
 * commit touche des sources et qu'un `cockpit.config.json` existe. Committer en
 * dernier ferait démarrer ce serveur dans la seconde qui suit le clic, sur un
 * projet dont les dépendances ne sont peut-être même pas installées.
 *
 * @param {string} target dossier quelconque à l'intérieur du dépôt
 * @param {{
 *   skills?: string[],
 *   gitInit?: boolean,
 *   commit?: boolean,
 *   config?: {dev: string, baseUrl: string} | null,
 * }} options
 * @returns {string[]}
 * @throws si `target` n'est pas dans un dépôt git et qu'on n'a pas demandé de
 *   l'y transformer : le rattachement des commits aux plans n'a alors aucun
 *   sens, et le dire vaut mieux qu'installer à moitié.
 */
export function install(target, { skills = [], gitInit = false, commit = false, config = null } = {}) {
  const done = []
  const cwd = resolve(target)

  if (gitInit) {
    execFileSync('git', ['init'], { cwd, stdio: 'ignore' })
    done.push('dépôt git créé')
  }

  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
  }).trim()

  // Un échec ici — identité git absente, rien à committer — n'a pas à faire
  // échouer l'équipement : le commit est un confort, `cockpit/` est le sujet.
  if (commit) {
    try {
      execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' })
      execFileSync('git', ['commit', '-m', 'chore: point de départ du cockpit'], {
        cwd: root,
        stdio: 'ignore',
      })
      done.push('premier commit créé')
    } catch (err) {
      done.push(`premier commit impossible : ${err?.message ?? err}`)
    }
  }

  mkdirSync(join(root, 'cockpit', 'plans'), { recursive: true })
  done.push(`cockpit/plans/ prêt dans ${root}`)

  mkdirSync(join(root, 'cockpit', 'tickets'), { recursive: true })
  done.push('cockpit/tickets/ prêt')

  // Jamais écrasé : un projet qui a réorganisé ses colonnes ne doit pas les
  // perdre en réinstallant les hooks.
  const board = join(root, 'cockpit', 'board.json')
  if (!existsSync(board)) {
    writeFileNoFollow(board, JSON.stringify({ colonnes: DEFAULT_COLUMNS }, null, 2) + '\n')
    done.push('cockpit/board.json écrit avec les colonnes par défaut')
  }

  if (config) writeCockpitConfig(root, config, done)

  installPostCommit(root, done)
  installClaudeHooks(done)
  done.push(...installSkills(skills))

  return done
}

// Exécution directe seulement : importé, ce fichier n'écrit rien.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--skills')
  const skills = flag === -1 ? [] : (args[flag + 1] ?? '').split(',').filter(Boolean)
  const target = args.find((a, i) => !a.startsWith('--') && i !== flag + 1) ?? process.cwd()

  for (const line of install(target, { skills })) console.log(line)
}
