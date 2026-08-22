#!/usr/bin/env node
/**
 * Hooks Stop, Notification, UserPromptSubmit et SessionStart : signalent au
 * terminal qui entoure la session ce que Claude est en train de faire — au
 * travail, en attente d'une réponse, rendu la main, ou reparti de zéro.
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
 *          {"hook_event_name":"UserPromptSubmit","prompt":"...", ...}
 *          {"hook_event_name":"SessionStart","source":"clear", ...}
 *   stdout {"terminalSequence":"<ESC>]777;ovrsee;stop<BEL>"}
 *          {"terminalSequence":"<ESC>]777;ovrsee;question;<base64><BEL>"}
 *          {"terminalSequence":"<ESC>]777;ovrsee;busy;<base64><BEL>"}
 *          {"terminalSequence":"<ESC>]777;ovrsee;reset<BEL>"}
 *
 * La séquence porte en plus, quand il y en a un, le `message` de la charge
 * utile — « Claude needs your permission to use Bash ». Le popover de la barre
 * de menu (`electron/tray.js`) en a besoin : « une question » ne dit pas
 * laquelle, et on n'autorise pas à l'aveugle. Le champ voyage en base64 parce
 * que c'est du texte libre : un BEL qui s'y glisserait couperait la séquence.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { estPrincipal } from './principal.js'

/**
 * Les types de notification qui appellent une réponse humaine.
 *
 * Les autres (`auth_success`, `elicitation_complete`, `agent_completed`…)
 * décrivent un événement déjà résolu : les signaler ferait sonner l'ovrsee
 * pour rien, et une notification qui sonne pour rien finit ignorée.
 *
 * `idle_prompt` en faisait partie et n'y est plus. Claude Code l'émet quand une
 * session reste sans réponse une minute — donc juste après un `Stop`, dès qu'on
 * est parti ailleurs. La coche « a rendu la main » se changeait alors toute
 * seule en point d'interrogation, et le popover proposait d'autoriser une
 * demande qui n'existait pas. Une session qu'on laisse de côté n'attend rien :
 * c'est l'inverse, c'est elle qu'on fait attendre.
 */
const TYPES_EN_ATTENTE = new Set(['permission_prompt', 'agent_needs_input'])

/** Les démarrages de session qui repartent d'une conversation vide. */
const SOURCES_NEUVES = new Set(['clear', 'startup'])

/**
 * Longueur retenue du détail, en caractères, avant encodage.
 *
 * Une séquence OSC traverse le pty octet par octet : c'est un canal de signal,
 * pas de transfert. Le message des invites de permission tient largement
 * dedans, et ce qui dépasse serait de toute façon illisible sur une ligne de
 * popover.
 */
const MAX_DETAIL = 120

/**
 * Détail à joindre au signal, ou null.
 *
 * Deux événements en portent un : une `Notification` joint son `message`, un
 * `UserPromptSubmit` joint la demande elle-même — c'est elle qui nommera
 * l'onglet. `Stop` dit « c'est à toi », il n'y a rien à préciser.
 *
 * Les deux champs sont du texte libre côté Claude Code : on ne fait que les
 * relayer, et `sequence()` les tronque puis les encode.
 *
 * @param {unknown} payload
 * @returns {string|null}
 */
export function detailPour(payload) {
  if (!payload || typeof payload !== 'object') return null

  const brut =
    payload.hook_event_name === 'Notification'
      ? payload.message
      : payload.hook_event_name === 'UserPromptSubmit'
        ? payload.prompt
        : null
  if (typeof brut !== 'string') return null

  const propre = brut.trim()
  return propre === '' ? null : propre
}

/**
 * Séquence pour un genre donné, et son détail éventuel.
 *
 * OSC 777 est le canal des notifications de terminal (rxvt, puis les autres) :
 * un émulateur qui ne le connaît pas l'ignore silencieusement au lieu
 * d'afficher des caractères parasites. Le terminateur BEL est explicite ici —
 * Claude Code en ajoute un de son côté, et `app/src/attention.ts` tolère les
 * deux.
 *
 * La forme courte, sans détail, est conservée telle quelle : c'est celle que
 * `Stop` émet, et la seule que les versions précédentes savaient lire.
 *
 * @param {'stop'|'question'|'busy'|'reset'} genre
 * @param {string|null} [detail] texte libre, encodé en base64 dans la séquence
 */
export const sequence = (genre, detail = null) => {
  const corps = detail
    ? `${genre};${Buffer.from(detail.slice(0, MAX_DETAIL), 'utf8').toString('base64')}`
    : genre
  return `\u001b]777;ovrsee;${corps}\u0007`
}

/**
 * Genre de signal appelé par une charge utile de hook, ou null s'il n'y a rien
 * à signaler.
 *
 * @param {unknown} payload
 * @returns {'stop'|'question'|'busy'|'reset'|null}
 */
export function genrePour(payload) {
  if (!payload || typeof payload !== 'object') return null

  // Fin de tour : « Claude a fini, c'est à toi ». Claude Code n'a pas
  // d'événement de fin de session — c'est bien ce moment-là qui est utile.
  if (payload.hook_event_name === 'Stop') return 'stop'

  // Départ de tour : la session se met au travail. C'est l'état où elle passe
  // l'essentiel de son temps, et le seul moment où la demande est connue — d'où
  // le nom que l'onglet en tire (`etiquetteDe`, app/src/attention.ts).
  if (payload.hook_event_name === 'UserPromptSubmit') return 'busy'

  // Conversation repartie de zéro : l'onglet ne doit plus annoncer celle
  // d'avant. `resume` et `compact` reprennent la même conversation — leur nom
  // vaut toujours, et le réinitialiser effacerait une information juste.
  if (payload.hook_event_name === 'SessionStart') {
    return SOURCES_NEUVES.has(payload.source) ? 'reset' : null
  }

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

  process.stdout.write(
    JSON.stringify({ terminalSequence: sequence(genre, detailPour(payload)) }),
  )
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook — sans quoi
 * l'importer pour éprouver `genrePour` lirait stdin à chaque `pnpm test`.
 */
if (estPrincipal(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale sur stderr, jamais sur stdout, et on ne bloque pas.
    process.stderr.write(`[ovrsee] signal de session ignoré : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
