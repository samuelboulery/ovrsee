#!/usr/bin/env node
/**
 * Installe la capture ovrsee dans un dépôt.
 *
 *   node hooks/install.js [chemin-du-dépôt]
 *
 * Trois choses :
 *
 * 1. le dossier `ovrsee/plans/`, seul endroit que lit `readPlans` ;
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
import { estPrincipal } from './principal.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const START = '# ovrsee-hook-start'
const END = '# ovrsee-hook-end'
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
 * La ligne qui lance `ovrsee-post-commit.js` à chaque commit.
 *
 * Depuis l'application empaquetée, deux pièges se combinent : `process.execPath`
 * est le binaire Ovrsee et non `node` — l'écrire tel quel ferait ouvrir la
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

/** Le bloc ovrsee du `post-commit`, installé ou remplacé sans toucher au reste. */
export function installPostCommit(root, done) {
  return installGitHook(
    root,
    'post-commit',
    'ovrsee-post-commit.js',
    'Rattache le commit au plan actif de ovrsee/.',
    done,
  )
}

/**
 * Le bloc ovrsee du `post-merge`.
 *
 * `post-commit` ne voit que ce qui est committé ici. Un squash-merge fait sur
 * GitHub crée son commit là-bas : il arrive par un `git pull`, et c'est ce
 * hook-ci qui le rattrape — sans quoi le plan reste ouvert avec zéro commit, et
 * `ovrsee:close` refuse de le clore faute de date.
 */
function installPostMerge(root, done) {
  return installGitHook(
    root,
    'post-merge',
    'ovrsee-post-merge.js',
    'Rattrape les commits arrivés par un pull (squash-merge GitHub).',
    done,
  )
}

/**
 * Installe ou remplace le bloc ovrsee d'un hook git, sans toucher au reste du
 * fichier — un dépôt a le droit d'avoir ses propres hooks.
 */
function installGitHook(root, hookName, scriptName, description, done) {
  const hookPath = join(root, '.git', 'hooks', hookName)
  const block = [
    START,
    `# ${description} Installé par: node hooks/install.js`,
    `${commandFor(scriptName)} || true`,
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
      throw new Error(`${hookPath} contient un marqueur ovrsee non refermé (${START} sans ${END})`)
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

  done.push(`${hookName} : bloc ovrsee installé dans ${hookPath}`)
}

/**
 * Les événements qui portent le signal de session.
 *
 * Un seul script les sert tous — il ne fait qu'émettre une séquence, et le
 * découper par événement dupliquerait la table des types de notification pour
 * rien. Même liste à l'enregistrement et à la vérification, sans quoi on
 * installerait ce qu'on ne contrôle pas.
 */
const SIGNAL_EVENTS = ['Stop', 'Notification', 'UserPromptSubmit', 'SessionStart']

/** Une entrée est-elle déjà celle de l'ovrsee ? */
const isOvrsee = (entry, script) => JSON.stringify(entry).includes(script)

/**
 * Le signal de session est-il enregistré ?
 *
 * `ovrsee-notify.js` vit dans `~/.claude/settings.json` et pas dans le dépôt :
 * une machine équipée avant son arrivée n'émet aucun signal, donc aucune
 * notification et une barre de menu qui ne dira jamais qu'une session attend.
 * La panne est parfaitement silencieuse — la barre de menu appelle ceci pour
 * pouvoir la nommer (`electron/tray.js`).
 *
 * Les quatre événements sont exigés : `Stop` seul dirait « c'est à toi » sans
 * jamais signaler une question, l'inverse laisserait l'attente allumée après
 * coup, sans `UserPromptSubmit` l'onglet ne dirait ni qu'il travaille ni sur
 * quoi, et sans `SessionStart` il garderait le nom d'une conversation effacée.
 * Un dépôt équipé avant l'arrivée de l'un d'eux se voit donc déclaré incomplet —
 * c'est voulu : la panne serait sinon parfaitement muette.
 *
 * @param {string} [settingsPath] chemin du fichier, pour les tests
 * @returns {boolean} faux aussi quand le fichier manque ou ne se lit pas
 */
export function signalInstalle(settingsPath = SETTINGS) {
  if (!existsSync(settingsPath)) return false

  let settings
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch {
    // Un fichier illisible n'installe rien : le dire manquant est la réponse
    // utile, et lever depuis le processus principal serait pire.
    return false
  }

  const hooks = settings?.hooks ?? {}
  return SIGNAL_EVENTS.every(event => {
    const entries = hooks[event]
    return Array.isArray(entries) && entries.some(e => isOvrsee(e, 'ovrsee-notify'))
  })
}

/**
 * Enregistre tous les hooks de l'ovrsee dans `~/.claude/settings.json`.
 *
 * `settingsPath` existe pour les tests, comme dans `signalInstalle` : ils
 * doivent pouvoir éprouver l'enregistrement sans réécrire la configuration
 * Claude de la machine.
 *
 * @param {string[]} done journal des actions, rendu à l'appelant
 * @param {string} [settingsPath]
 */
export function installClaudeHooks(done, settingsPath = SETTINGS) {
  if (!existsSync(settingsPath)) {
    done.push(`${settingsPath} absent — hooks Claude Code non installés.`)
    return
  }

  const original = readFileSync(settingsPath, 'utf8')

  let settings
  try {
    settings = JSON.parse(original)
  } catch (err) {
    done.push(`${settingsPath} illisible (${err.message}) — laissé intact.`)
    return
  }

  const hooks = (settings.hooks ??= {})
  const added = []

  const sessionStart = (hooks.SessionStart ??= [])
  if (!sessionStart.some(e => isOvrsee(e, 'ovrsee-session-start'))) {
    sessionStart.push({
      hooks: [
        {
          type: 'command',
          command: commandFor('ovrsee-session-start.js'),
          timeout: 5,
          statusMessage: 'Lecture de l\'ovrsee...',
        },
      ],
    })
    added.push('SessionStart — réinjection de l’état du projet')
  }

  // Une session qui se termine rend son plan et son ticket. Sans ce hook, le
  // pointeur survit à la session et le plan capte le travail suivant.
  const sessionEnd = (hooks.SessionEnd ??= [])
  if (!sessionEnd.some(e => isOvrsee(e, 'ovrsee-session-end'))) {
    sessionEnd.push({
      hooks: [{ type: 'command', command: commandFor('ovrsee-session-end.js'), timeout: 5 }],
    })
    added.push('SessionEnd — la session rend son plan actif')
  }

  const postToolUse = (hooks.PostToolUse ??= [])
  if (!postToolUse.some(e => isOvrsee(e, 'ovrsee-capture-plan'))) {
    postToolUse.push({
      matcher: 'ExitPlanMode',
      hooks: [{ type: 'command', command: commandFor('ovrsee-capture-plan.js') }],
    })
    added.push('PostToolUse/ExitPlanMode — capture des plans approuvés')
  }

  // Le suivi automatique des tickets. Ces trois-là manquaient : ils ne
  // tournaient que sur les machines où quelqu'un les avait ajoutés à la main
  // dans `~/.claude/settings.json`. Une machine fraîchement installée n'avait ni
  // gate ni avancée de tickets, et rien dans le code ne le laissait voir.
  if (!postToolUse.some(e => isOvrsee(e, 'ovrsee-tool-edit.js'))) {
    postToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: commandFor('ovrsee-tool-edit.js') }],
    })
    added.push('PostToolUse/Edit|Write — ticket en cours à la première édition')
  }

  const preToolUse = (hooks.PreToolUse ??= [])
  if (!preToolUse.some(e => isOvrsee(e, 'ovrsee-tool-edit-gate'))) {
    preToolUse.push({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: commandFor('ovrsee-tool-edit-gate.js') }],
    })
    added.push('PreToolUse/Edit|Write — ticket exigé avant d’éditer du code')
  }

  const stop = (hooks.Stop ??= [])
  if (!stop.some(e => isOvrsee(e, 'ovrsee-tool-stop'))) {
    stop.push({
      hooks: [{ type: 'command', command: commandFor('ovrsee-tool-stop.js') }],
    })
    added.push('Stop — ticket en revue quand du code reste non commité')
  }

  // La capture des audits : trois événements, un seul script — il se branche
  // lui-même sur `hook_event_name`. Un audit lancé en commande slash ne passe
  // pas par l'outil `Skill`, d'où `UserPromptSubmit`, et ses constats
  // n'existent qu'au tour qui se termine, d'où `Stop`.
  if (!postToolUse.some(e => isOvrsee(e, 'ovrsee-capture-audit'))) {
    postToolUse.push({
      matcher: 'Skill',
      hooks: [{ type: 'command', command: commandFor('ovrsee-capture-audit.js') }],
    })
    added.push('PostToolUse/Skill — capture des audits')
  }

  const userPromptSubmit = (hooks.UserPromptSubmit ??= [])
  if (!userPromptSubmit.some(e => isOvrsee(e, 'ovrsee-capture-audit'))) {
    userPromptSubmit.push({
      hooks: [{ type: 'command', command: commandFor('ovrsee-capture-audit.js') }],
    })
    added.push('UserPromptSubmit — audit lancé en commande slash')
  }

  if (!stop.some(e => isOvrsee(e, 'ovrsee-capture-audit'))) {
    stop.push({
      hooks: [{ type: 'command', command: commandFor('ovrsee-capture-audit.js') }],
    })
    added.push('Stop — constats de l’audit qui vient de tourner')
  }

  // Le signal de session lu par le panneau terminal. `UserPromptSubmit` et
  // `SessionStart` portent déjà les entrées de `ovrsee-capture-audit` et de
  // `ovrsee-session-start` : les entrées s'ajoutent au tableau, elles ne
  // s'écrasent pas, et deux hooks du même événement peuvent avoir des sorties
  // de formes différentes.
  for (const event of SIGNAL_EVENTS) {
    const entries = (hooks[event] ??= [])
    if (entries.some(e => isOvrsee(e, 'ovrsee-notify'))) continue
    entries.push({
      hooks: [{ type: 'command', command: commandFor('ovrsee-notify.js'), timeout: 5 }],
    })
    added.push(`${event} — signal de session vers le panneau terminal`)
  }

  if (added.length === 0) {
    done.push('Hooks Claude Code : déjà installés.')
    return
  }

  // Sauvegarde avant écriture : ce fichier n'est pas versionné.
  const backup = `${settingsPath}.avant-ovrsee`
  copyFileSync(settingsPath, backup)

  const updated = JSON.stringify(settings, null, 2) + '\n'
  writeFileSync(settingsPath, updated, 'utf8')

  // Relecture : mieux vaut restaurer tout de suite qu'aller découvrir demain
  // une configuration cassée.
  try {
    JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch (err) {
    writeFileSync(settingsPath, original, 'utf8')
    done.push(`Écriture invalide (${err.message}) — configuration restaurée.`)
    return
  }

  done.push(`Hooks Claude Code installés (sauvegarde : ${backup}) :`)
  for (const line of added) done.push(`  + ${line}`)
}

/**
 * Écrit `ovrsee.config.json` — ce qui débloque le crawl, qui refuse de démarrer
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
function writeOvrseeConfig(root, { dev, baseUrl }, done) {
  const path = join(root, 'ovrsee.config.json')
  if (existsSync(path)) {
    done.push('ovrsee.config.json existait déjà — conservé tel quel')
    return
  }

  writeFileNoFollow(path, JSON.stringify({ dev, baseUrl, entryRoutes: ['/'] }, null, 2) + '\n')
  done.push(`ovrsee.config.json écrit (${dev} → ${baseUrl})`)
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
 * commit touche des sources et qu'un `ovrsee.config.json` existe. Committer en
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
  // échouer l'équipement : le commit est un confort, `ovrsee/` est le sujet.
  if (commit) {
    try {
      execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' })
      execFileSync('git', ['commit', '-m', 'chore: point de départ de l\'ovrsee'], {
        cwd: root,
        stdio: 'ignore',
      })
      done.push('premier commit créé')
    } catch (err) {
      done.push(`premier commit impossible : ${err?.message ?? err}`)
    }
  }

  mkdirSync(join(root, 'ovrsee', 'plans'), { recursive: true })
  done.push(`ovrsee/plans/ prêt dans ${root}`)

  mkdirSync(join(root, 'ovrsee', 'tickets'), { recursive: true })
  done.push('ovrsee/tickets/ prêt')

  // Jamais écrasé : un projet qui a réorganisé ses colonnes ne doit pas les
  // perdre en réinstallant les hooks.
  const board = join(root, 'ovrsee', 'board.json')
  if (!existsSync(board)) {
    writeFileNoFollow(board, JSON.stringify({ colonnes: DEFAULT_COLUMNS }, null, 2) + '\n')
    done.push('ovrsee/board.json écrit avec les colonnes par défaut')
  }

  if (config) writeOvrseeConfig(root, config, done)

  installPostCommit(root, done)
  installPostMerge(root, done)
  installClaudeHooks(done)
  done.push(...installSkills(skills))

  return done
}

// Exécution directe seulement : importé, ce fichier n'écrit rien.
if (estPrincipal(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--skills')
  const skills = flag === -1 ? [] : (args[flag + 1] ?? '').split(',').filter(Boolean)
  const target = args.find((a, i) => !a.startsWith('--') && i !== flag + 1) ?? process.cwd()

  for (const line of install(target, { skills })) console.log(line)
}
