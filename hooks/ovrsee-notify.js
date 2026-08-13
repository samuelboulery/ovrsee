#!/usr/bin/env node
/**
 * Hooks Stop et Notification : signalent au terminal qui entoure la session
 * que Claude vient de rendre la main.
 *
 * Le signal est une séquence OSC écrite dans le terminal de la session, via le
 * champ `terminalSequence` de la sortie du hook. L'ovrsee possède ce terminal
 * (`electron/pty.js`) et lit déjà chacun de ses octets : la séquence arrive
 * donc dans `app/src/useTerminal.ts`, qui la retire du flux et déclenche une
 * notification système — voir `app/src/attention.ts`.
 *
 * Pourquoi une séquence et pas un fichier : rien ne doit être ajouté au dépôt
 * observé, c'est l'invariant du cadrage. Et la séquence règle la portée toute
 * seule — la même session lancée hors de l'ovrsee envoie sa séquence à son
 * propre terminal (iTerm, VS Code), qui l'ignore.
 *
 * `terminalSequence` est le seul transport possible : un hook n'a pas de
 * terminal de contrôle, `/dev/tty` y répond `ENXIO`.
 *
 * Contrat (calqué sur les autres hooks ovrsee) : JSON sur stdin, exit 0
 * TOUJOURS, et sur stdout **rien d'autre** que le JSON attendu — un
 * `console.log` égaré casserait le tour.
 *
 *   stdin  {"hook_event_name":"Stop", ...}
 *          {"hook_event_name":"Notification","notification_type":"permission_prompt", ...}
 *   stdout {"terminalSequence":"<ESC>]777;ovrsee;stop<BEL>"}
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Les types de notification qui appellent une réponse humaine.
 *
 * Les autres (`auth_success`, `elicitation_complete`, `agent_completed`…)
 * décrivent un événement déjà résolu : les signaler ferait sonner l'ovrsee
 * pour rien, et une notification qui sonne pour rien finit ignorée.
 */
const TYPES_EN_ATTENTE = new Set(['permission_prompt', 'idle_prompt', 'agent_needs_input'])

/**
 * Séquence pour un genre donné.
 *
 * OSC 777 est le canal des notifications de terminal (rxvt, puis les autres) :
 * un émulateur qui ne le connaît pas l'ignore silencieusement au lieu
 * d'afficher des caractères parasites. Le terminateur BEL est explicite ici —
 * Claude Code en ajoute un de son côté, et `app/src/attention.ts` tolère les
 * deux.
 *
 * @param {'stop'|'question'} genre
 */
export const sequence = genre => `\u001b]777;ovrsee;${genre}\u0007`

/**
 * Genre de signal appelé par une charge utile de hook, ou null s'il n'y a rien
 * à signaler.
 *
 * @param {unknown} payload
 * @returns {'stop'|'question'|null}
 */
export function genrePour(payload) {
  if (!payload || typeof payload !== 'object') return null

  // Fin de tour : « Claude a fini, c'est à toi ». Claude Code n'a pas
  // d'événement de fin de session — c'est bien ce moment-là qui est utile.
  if (payload.hook_event_name === 'Stop') return 'stop'

  if (payload.hook_event_name === 'Notification') {
    return TYPES_EN_ATTENTE.has(payload.notification_type) ? 'question' : null
  }

  return null
}

/**
 * Le dossier est-il, ou contient-il en amont, un projet équipé ?
 *
 * L'installateur enregistre les hooks dans `~/.claude/settings.json` : ils
 * tournent donc dans **toutes** les sessions Claude de la machine. Sans cette
 * garde, l'ovrsee écrirait une séquence d'échappement dans le terminal de
 * projets qui n'ont rien à voir avec lui.
 *
 * Remontée de dossier en dossier plutôt qu'un `git rev-parse` : ce hook se
 * déclenche à chaque fin de tour, et lancer un sous-processus à chaque fois
 * pour une question à laquelle `existsSync` répond serait payer cher une
 * réponse gratuite.
 *
 * @param {string} cwd
 */
export function projetEquipe(cwd) {
  let dir = resolve(cwd)
  for (;;) {
    if (existsSync(join(dir, 'ovrsee'))) return true
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

function main() {
  let raw = ''
  try {
    raw = readFileSync(0, 'utf8')
  } catch {
    return
  }
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const genre = genrePour(payload)
  if (!genre) return

  if (!projetEquipe(payload?.cwd || process.cwd())) return

  process.stdout.write(JSON.stringify({ terminalSequence: sequence(genre) }))
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook — sans quoi
 * l'importer pour éprouver `genrePour` lirait stdin à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale sur stderr, jamais sur stdout, et on ne bloque pas.
    process.stderr.write(`[ovrsee] signal de session ignoré : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
