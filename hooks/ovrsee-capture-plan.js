#!/usr/bin/env node
/**
 * Hook PostToolUse, matcher `ExitPlanMode` : capture un plan au moment où il
 * est approuvé.
 *
 * C'est le seul contenu périssable du système. Le raisonnement derrière une
 * décision n'existe que dans le fil d'une conversation qui disparaît ; s'il
 * n'est pas écrit ici, il ne se récupère jamais.
 *
 * Contrat (calqué sur pnpm-guard.js) : JSON sur stdin, exit 0 TOUJOURS. Un
 * échec de capture ne doit jamais casser une session de travail.
 *
 *   stdin  {"tool_name":"ExitPlanMode","tool_input":{},"cwd":"/chemin"}
 *          `tool_input.plan` n'est plus garanti — voir `planFrom`.
 *   effets <repo>/ovrsee/plans/<date>-<slug>.md   (status: open)
 *          <repo>/ovrsee/.active/<session>.json
 *          ~/.claude/ovrsee/projects.json
 *   stdout {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}
 *          Jamais `decision: "block"` : le hook signale, il ne fait jamais
 *          échouer l'outil. `additionalContext` pousse Claude à décomposer le
 *          plan en tickets dans le même tour, sans le bloquer.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  serializePlan,
  planFileName,
  writeFileNoFollow,
  closeOpenPlans,
  registerProject,
} from './plans.js'
import { avancerTicketActifEclipse, clearActiveTicket, avancerTicketsClos } from './tickets.js'
import { sessionId, writeActive } from './active.js'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Racine du dépôt git contenant `cwd`, ou null.
 * execFile sans shell : `cwd` vient d'un JSON externe et ne doit jamais être
 * interprété par un shell.
 */
function repoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Là où Claude Code écrit le plan avant de demander son approbation.
 *
 * `OVRSEE_PLAN_DIR` existe pour les tests, comme `OVRSEE_REGISTRY` dans
 * `plans.js` : éprouver le repêchage d'un plan demande d'écrire de faux
 * fichiers de plan, et les écrire dans le vrai dossier polluerait la machine.
 */
const planDir = () => process.env.OVRSEE_PLAN_DIR ?? join(homedir(), '.claude', 'plans')

/** Un plan écrit il y a plus longtemps n'est pas celui qu'on vient d'approuver. */
const FRESH_MS = 10 * 60 * 1000

const readOrNull = path => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** Un chemin de fichier markdown cité dans un texte, forme POSIX ou Windows. */
const CHEMIN_MD = /[A-Za-z]:\/[^\s"']+\.md|\/[^\s"']+\.md/g

/**
 * Ramène un chemin aux barres avant, quelle que soit la plateforme.
 *
 * Les séparateurs répétés sont écrasés en un seul, et c'est le point qui compte :
 * le transcript est du JSON, où un `C:\Users\…` de Windows s'écrit `C:\\Users\\…`.
 * Convertir sans écraser donnait `C://Users//…`, que la comparaison de préfixe
 * rejetait — quatre tests rouges sous Windows, verts partout ailleurs.
 */
const enBarresAvant = chemin => chemin.replace(/[\\/]+/g, '/')

/**
 * Le plan que **cette session** a écrit, d'après son propre transcript.
 *
 * C'est la seule source qui distingue les sessions sans rien leur demander : le
 * transcript nomme le fichier de plan de la session, et lui seul. Le payload en
 * donne le chemin (`transcript_path`), donc ni variable d'environnement ni
 * convention de nom de fichier à deviner.
 *
 * Sécurité : le chemin sort d'un fichier, donc du dehors. On ne retient que ce
 * qui tombe dans le dossier des plans, et jamais un chemin qui en ressort par
 * `..` — sans quoi une conversation contenant un chemin choisi ferait lire au
 * hook n'importe quel `.md` de la machine.
 *
 * ponytail: le transcript est lu en entier. Ça ne coûte qu'une fois par plan
 * approuvé ; si un jour les transcripts pèsent trop, ne lire que la fin.
 */
export function planPathFromTranscript(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return null

  const raw = readOrNull(transcriptPath)
  if (!raw) return null

  // Le transcript est du JSON : ses séparateurs Windows y sont échappés (`\\`).
  // Tout ramener aux barres avant règle l'échappement et la portabilité d'un
  // seul geste, et `readFileSync` accepte les barres avant sous Windows.
  const texte = enBarresAvant(raw)
  const prefixe = enBarresAvant(planDir()) + '/'

  // La dernière citation, pas la première : une session qui replanifie écrit un
  // nouveau fichier, et c'est celui-là qu'on vient d'approuver.
  let dernier = null
  for (const [trouve] of texte.matchAll(CHEMIN_MD)) {
    if (trouve.startsWith(prefixe) && !trouve.includes('/../')) dernier = trouve
  }

  // Rendu dans la forme de la plateforme : c'est un chemin qu'on va lire, et
  // les barres avant qui ont servi à le comparer ne sont qu'un intermédiaire.
  return dernier ? resolve(dernier) : null
}

/**
 * Le texte du plan approuvé, quel que soit l'endroit où il se trouve.
 *
 * Claude Code 2.1.226 retire `plan` et `planFilePath` de l'entrée d'ExitPlanMode
 * avant d'exécuter l'outil — le plan vit maintenant dans un fichier, et le
 * transmettre deux fois n'aurait plus de sens de son point de vue. Du nôtre,
 * la capture s'est arrêtée sans rien dire : six plans approuvés le 8 août 2026,
 * deux fichiers écrits. C'est exactement la panne que ce hook existe pour ne
 * pas avoir — un raisonnement perdu ne se retrouve jamais.
 *
 * Quatre sources, dans cet ordre : le champ s'il est encore là, le chemin s'il
 * est fourni, le transcript de la session, et en dernier ressort le fichier de
 * plan le plus récemment écrit.
 *
 * **Ce dernier repli devine.** Il prend le fichier le plus récent de
 * `~/.claude/plans/`, sans distinction de session ni de projet : le 16 août
 * 2026, une approbation sur ce dépôt y a capturé le plan d'une session voisine
 * travaillant sur un tout autre dépôt, et le pointeur de plan actif a suivi.
 * Planifier dans deux sessions à la fois est le cas nominal, pas le cas rare —
 * la fenêtre de fraîcheur n'y borne donc rien. D'où le passage par le
 * transcript avant lui, et l'avertissement quand on en arrive là.
 */
export function planFrom(payload, now = Date.now(), avertir = () => {}) {
  const inline = payload?.tool_input?.plan
  if (typeof inline === 'string' && inline.trim()) return inline

  const named = payload?.tool_input?.planFilePath
  if (typeof named === 'string' && named.trim()) {
    const body = readOrNull(named)
    if (body?.trim()) return body
  }

  const duTranscript = planPathFromTranscript(payload?.transcript_path)
  if (duTranscript) {
    const body = readOrNull(duTranscript)
    if (body?.trim()) return body
  }

  let best = null
  try {
    for (const name of readdirSync(planDir())) {
      if (!name.endsWith('.md')) continue
      const path = join(planDir(), name)
      const at = statSync(path).mtimeMs
      if (now - at > FRESH_MS) continue
      if (!best || at > best.at) best = { path, at }
    }
  } catch {
    return null // Pas de dossier de plans : rien à repêcher.
  }

  const body = best ? readOrNull(best.path) : null
  if (!body?.trim()) return null

  avertir(
    `plan déduit du fichier le plus récent (${best.path}) — le transcript de la session ` +
      `n'en citait aucun. Vérifier que le plan capturé est bien celui qui vient d'être approuvé.`,
  )
  return body
}

/** Premier titre markdown du plan, à défaut sa première ligne non vide. */
function titleOf(planText) {
  for (const line of planText.split('\n')) {
    const heading = /^#{1,3}\s+(.*\S)/.exec(line)
    if (heading) return heading[1].trim()
    if (line.trim()) return line.trim().slice(0, 120)
  }
  return 'Plan sans titre'
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const planText = planFrom(payload, Date.now(), message =>
    process.stderr.write(`[ovrsee] ${message}\n`),
  )
  if (!planText) return

  const root = repoRoot(payload.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à capturer, sortie silencieuse.

  const ovrseeDir = join(root, 'ovrsee')
  const session = sessionId(payload)

  // Portée de session : on solde son propre plan et ce que plus personne ne
  // pointe, jamais le plan d'une session voisine encore en travail.
  closeOpenPlans(ovrseeDir, message => process.stderr.write(`[ovrsee] ${message}\n`), { session })
  avancerTicketsClos(ovrseeDir)

  const title = titleOf(planText)
  const now = new Date()
  const file = planFileName(title, now)
  const meta = {
    status: 'open',
    title,
    opened: now.toISOString().slice(0, 10),
    closed: null,
    commits: [],
  }

  writeFileNoFollow(join(ovrseeDir, 'plans', file), serializePlan(meta, planText))
  // pousse en revue le ticket ad hoc en cours, avant de l'éclipser
  avancerTicketActifEclipse(ovrseeDir, session)
  // un plan qui démarre éclipse le ticket ad hoc de SA session, pas celui des autres
  clearActiveTicket(ovrseeDir, null, session)
  writeActive(ovrseeDir, session, { plan: file })
  registerProject(root)

  // additionalContext plutôt qu'un simple message : le hook ne doit jamais
  // bloquer l'outil (exit 0 toujours), mais peut pousser Claude à agir dans
  // le même tour sans attendre qu'on le lui demande.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[ovrsee] Plan capturé : ovrsee/plans/${file}. Décompose-le maintenant en tickets via le skill ovrsee-tickets — priorité et charge (xs–xl) pour chacun, champ plan renseigné sur ${file}. Un plan simple peut ne produire qu'un seul ticket : ne pas forcer le découpage.`,
      },
    }),
  )
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour en éprouver une décision (`planFrom`,
 * `titleOf`) lirait stdin et écrirait des fichiers à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais.
    process.stderr.write(`[ovrsee] capture ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
