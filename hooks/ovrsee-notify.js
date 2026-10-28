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
 * **Trois voies, choisies ici** (T-0306) — la séquence ne sert que dans le
 * terminal de l'app, et une session lancée dans iTerm doit notifier aussi :
 *
 * | Session                          | Voie                                    |
 * |----------------------------------|-----------------------------------------|
 * | terminal de l'app (`OVRSEE_TERMINAL=1`, posé par `electron/pty.js`) | séquence OSC → rendu → `electron/notifications.js` |
 * | autre terminal, app vivante (`menubar.pid`) | fichier `~/.claude/ovrsee/inbox/<id>.json`, lu par le principal |
 * | autre terminal, app quittée (macOS) | `osascript display notification` — jamais muet |
 *
 * Les deux dernières n'écrivent rien dans le dépôt observé : `inbox/` et
 * `menubar.pid` sont des fichiers de poste, sous `~/.claude/ovrsee/`, comme
 * `settings.json`. Le fichier ne porte que de quoi *afficher* — le principal ne
 * l'interprète jamais comme une commande (`validerInbox`).
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

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { t } from './i18n.js'
import { writeFileNoFollow } from './plans.js'
import { estPrincipal } from './principal.js'
import { readSettings } from './settings.js'

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
 * Séquence pour un genre donné, et sa charge éventuelle.
 *
 * OSC 777 est le canal des notifications de terminal (rxvt, puis les autres) :
 * un émulateur qui ne le connaît pas l'ignore silencieusement au lieu
 * d'afficher des caractères parasites. Le terminateur BEL est explicite ici —
 * Claude Code en ajoute un de son côté, et `app/src/attention.ts` tolère les
 * deux.
 *
 * La forme courte, sans charge, est conservée telle quelle : c'est la seule
 * que les toutes premières versions savaient lire.
 *
 * La charge est soit du texte brut (la demande d'un `busy`, forme historique),
 * soit un objet `{ texte, duree }` sérialisé en JSON — le contenu riche d'une
 * notification (T-0306). `app/src/attention.ts` lit les deux.
 *
 * @param {'stop'|'question'|'busy'|'reset'} genre
 * @param {string|{texte: string|null, duree: number|null}|null} [charge]
 */
export const sequence = (genre, charge = null) => {
  const texte =
    charge === null || typeof charge === 'string'
      ? charge?.slice(0, MAX_DETAIL) || null
      : JSON.stringify({ texte: charge.texte?.slice(0, MAX_DETAIL) ?? null, duree: charge.duree ?? null })
  const corps = texte ? `${genre};${Buffer.from(texte, 'utf8').toString('base64')}` : genre
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
  //
  // Sauf si du travail de fond est encore en vol — sous-agents, workflow,
  // shell en arrière-plan (issue 125) : la session n'a pas fini, elle attend
  // d'être réveillée, et le réveil ne passe pas par `UserPromptSubmit`. Elle
  // reste donc « busy » jusqu'au `Stop` qui trouve `background_tasks` vide.
  if (payload.hook_event_name === 'Stop') {
    const enVol = Array.isArray(payload.background_tasks) && payload.background_tasks.length > 0
    return enVol ? 'busy' : 'stop'
  }

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

/* ————————————————————————————————————————————————————————————————
 * Contenu riche : dernière phrase et durée du tour (T-0306)
 * ———————————————————————————————————————————————————————————————— */

/**
 * Fenêtre lue à la fin du transcript, en octets.
 *
 * ponytail: lecture de queue bornée — un tour qui écrit plus de 2 Mo entre la
 * demande et la fin ne retrouve pas sa demande ; la durée retombe alors sur le
 * plus vieil horodatage de la fenêtre, qui la minore (le seuil reste juste).
 * Remonter le fichier par blocs si ça se voit.
 */
const QUEUE = 2 * 1024 * 1024

/** Texte des blocs `text` d'un contenu de message, ou null. */
function texteDe(contenu) {
  if (typeof contenu === 'string') return contenu
  if (!Array.isArray(contenu)) return null
  const textes = contenu.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text)
  return textes.length > 0 ? textes.join('\n') : null
}

/** Une ligne `user` du transcript est-elle une vraie demande, pas un résultat d'outil ? */
function estDemande(entree) {
  if (entree?.type !== 'user' || entree.isMeta) return false
  const contenu = entree.message?.content
  if (Array.isArray(contenu) && contenu.some(b => b?.type === 'tool_result')) return false
  return texteDe(contenu) !== null
}

/**
 * Début du tour et dernier message de Claude, tirés de la fin du transcript.
 *
 * Rend des null plutôt que de lever : le transcript est un fichier de Claude
 * Code, son format peut bouger, et la notification reste utile sans lui.
 *
 * @param {string|undefined} chemin `transcript_path` de la charge utile
 * @returns {{debut: number|null, dernier: string|null}}
 */
export function lireTour(chemin) {
  if (typeof chemin !== 'string' || chemin === '') return { debut: null, dernier: null }
  let brut
  try {
    const fd = openSync(chemin, 'r')
    try {
      const taille = fstatSync(fd).size
      const depart = Math.max(0, taille - QUEUE)
      const tampon = Buffer.alloc(taille - depart)
      readSync(fd, tampon, 0, tampon.length, depart)
      brut = tampon.toString('utf8')
      // Une lecture partie au milieu d'une ligne : la première est coupée.
      if (depart > 0) brut = brut.slice(brut.indexOf('\n') + 1)
    } finally {
      closeSync(fd)
    }
  } catch {
    return { debut: null, dernier: null }
  }

  let debut = null
  let plusVieux = null
  let dernier = null
  for (const ligne of brut.split('\n')) {
    if (!ligne.trim()) continue
    let entree
    try {
      entree = JSON.parse(ligne)
    } catch {
      continue
    }
    const quand = Date.parse(entree?.timestamp)
    if (Number.isFinite(quand) && plusVieux === null) plusVieux = quand
    if (estDemande(entree) && Number.isFinite(quand)) debut = quand
    if (entree?.type === 'assistant') dernier = texteDe(entree.message?.content) ?? dernier
  }
  return { debut: debut ?? plusVieux, dernier }
}

/**
 * La dernière phrase d'un message, débarrassée du markdown qui s'y lit mal.
 *
 * Le bloc de code d'abord : sa dernière « phrase » serait une ligne de code.
 *
 * @param {unknown} texte
 * @returns {string|null}
 */
export function dernierePhrase(texte) {
  if (typeof texte !== 'string') return null
  const propre = texte
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (propre === '') return null
  const phrases = propre.split(/(?<=[.!?…])\s+/).filter(p => p.trim() !== '')
  const derniere = phrases.at(-1) ?? propre
  return derniere.length > MAX_DETAIL ? `${derniere.slice(0, MAX_DETAIL - 1).trimEnd()}…` : derniere
}

/** « 42 s », « 3 min 12 », « 1 h 05 » — repris du mod `notif` de claude-config. */
export function formatDuree(ms) {
  const pad = n => String(n).padStart(2, '0')
  const s = Math.round(Math.max(0, ms) / 1000)
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)}`
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))}`
}

/**
 * Faut-il notifier ? Une question toujours ; une fin de tour seulement au-delà
 * du seuil réglé — sous lui, on regardait la réponse arriver.
 *
 * Une durée inconnue notifie : mieux vaut une notification de trop qu'un tour
 * long passé sous silence parce que le transcript a changé de forme.
 *
 * @param {'stop'|'question'} genre
 * @param {number|null} dureeMs
 * @param {{finDeTourApresMin: number}} reglages `settings.notifications`
 */
export function aNotifier(genre, dureeMs, reglages) {
  if (genre === 'question') return true
  if (genre !== 'stop') return false
  if (typeof dureeMs !== 'number' || !Number.isFinite(dureeMs)) return true
  return dureeMs >= reglages.finDeTourApresMin * 60_000
}

/**
 * Titre, sous-titre et corps d'une notification, pour les trois voies.
 *
 * @param {{genre: 'stop'|'question', projet: string, texte: string|null, dureeMs: number|null}} n
 * @param {'fr'|'en'} langue
 */
export function contenuNotification({ genre, projet, texte, dureeMs }, langue) {
  const sousTitre = t(genre === 'question' ? 'terminal.notify_question' : 'terminal.notify_stop', langue)
  const duree = genre === 'stop' && typeof dureeMs === 'number' ? formatDuree(dureeMs) : null
  const corps = [texte, duree].filter(Boolean).join(' · ')
  return {
    title: projet || 'Ovrsee',
    subtitle: sousTitre,
    body: corps || (genre === 'question' ? t('terminal.attention_question', langue) : sousTitre),
  }
}

/** Le son réglé pour ce genre, ou null pour « aucun ». */
export function sonPour(genre, reglages) {
  const son = genre === 'question' ? reglages.sonQuestion : reglages.sonFin
  return son && son !== 'aucun' ? son : null
}

/* ————————————————————————————————————————————————————————————————
 * Les voies hors de l'app : inbox et osascript
 * ———————————————————————————————————————————————————————————————— */

const dossierOvrsee = () => join(homedir(), '.claude', 'ovrsee')

/** Tenu par le principal tant qu'il vit — voir `electron/notifications.js`. */
export const pidPath = () => process.env.OVRSEE_MENUBAR_PID ?? join(dossierOvrsee(), 'menubar.pid')

export const inboxDir = () => process.env.OVRSEE_INBOX ?? join(dossierOvrsee(), 'inbox')

/**
 * Le processus nommé par le fichier pid vit-il ?
 *
 * `kill(pid, 0)` ne tue rien, il teste. `EPERM` veut dire « il existe, mais
 * pas à toi » — vivant quand même.
 *
 * ponytail: un pid recyclé par un autre processus après un plantage d'Ovrsee
 * passe pour vivant ; la notification part alors dans une inbox que personne
 * ne lit. Vérifier le nom du processus si ça arrive.
 *
 * @param {string} fichier
 */
export function pidVivant(fichier) {
  let pid
  try {
    pid = Number.parseInt(readFileSync(fichier, 'utf8').trim(), 10)
  } catch {
    return false
  }
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err?.code === 'EPERM'
  }
}

/**
 * La voie de cette session.
 *
 * @param {Record<string, string|undefined>} env
 * @param {string} fichierPid
 * @param {string} [plateforme]
 * @returns {'osc'|'inbox'|'osascript'|null}
 */
export function voiePour(env, fichierPid, plateforme = process.platform) {
  if (env.OVRSEE_TERMINAL === '1') return 'osc'
  if (pidVivant(fichierPid)) return 'inbox'
  return plateforme === 'darwin' ? 'osascript' : null
}

/** Bornes d'un fichier inbox, contrôlées des deux côtés. */
const MAX_INBOX = 8 * 1024
const MAX_PROJET = 200
const MAX_TEXTE = 500
const BUNDLE = /^[A-Za-z0-9.-]{1,100}$/
const SESSION = /^[A-Za-z0-9-]{1,100}$/

/**
 * Valide le contenu d'un fichier inbox, ou rend null.
 *
 * N'importe quel processus du compte peut écrire dans `inbox/` : rien de ce
 * fichier n'est cru. Il ne peut que faire *afficher* une notification — genre
 * fermé, textes bornés, et l'app à activer au clic n'est qu'un identifiant de
 * bundle, que le principal confronte encore à sa propre liste.
 *
 * @param {string} brut
 */
export function validerInbox(brut) {
  if (typeof brut !== 'string' || brut.length > MAX_INBOX) return null
  let n
  try {
    n = JSON.parse(brut)
  } catch {
    return null
  }
  if (!n || typeof n !== 'object' || Array.isArray(n)) return null
  if (n.genre !== 'stop' && n.genre !== 'question') return null
  if (typeof n.projet !== 'string' || n.projet.length > MAX_PROJET) return null
  if (n.texte !== null && (typeof n.texte !== 'string' || n.texte.length > MAX_TEXTE)) return null
  const dureeOk = n.dureeMs === null || (typeof n.dureeMs === 'number' && Number.isFinite(n.dureeMs) && n.dureeMs >= 0)
  if (!dureeOk) return null
  const terminal = typeof n.terminal === 'string' && BUNDLE.test(n.terminal) ? n.terminal : null
  // La session sert de clé : une session qui renotifie remplace sa notification.
  const session = typeof n.session === 'string' && SESSION.test(n.session) ? n.session : null
  return { genre: n.genre, projet: n.projet, texte: n.texte, dureeMs: n.dureeMs, terminal, session }
}

/** Dépose la notification pour le principal. Écriture atomique : il ne lit que `*.json`. */
export function ecrireInbox(notification, dossier = inboxDir()) {
  // 0600 sous un dossier 0700 : le contenu cite le projet et la dernière phrase.
  writeFileNoFollow(join(dossier, `${randomUUID()}.json`), JSON.stringify(notification), { mode: 0o600 })
}

/**
 * Le filet : une notification macOS sans Ovrsee.
 *
 * Les textes passent en `argv`, jamais dans le script : un guillemet dans la
 * dernière phrase de Claude ne doit pas devenir de l'AppleScript. Détaché et
 * relâché — le hook rend la main sans attendre le Centre de notifications.
 */
function osascript({ title, subtitle, body }, son) {
  const script = [
    'on run argv',
    `display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)${son ? ' sound name (item 4 of argv)' : ''}`,
    'end run',
  ]
  const args = script.flatMap(l => ['-e', l])
  // `--` : une dernière phrase qui commence par `-` (une liste markdown, ou
  // `-e…` sous injection) serait sinon lue comme une option d'osascript.
  spawn('osascript', [...args, '--', body, title, subtitle, son ?? ''], { detached: true, stdio: 'ignore' }).unref()
}

/* ————————————————————————————————————————————————————————————————
 * Le hook
 * ———————————————————————————————————————————————————————————————— */

/** Le contenu riche d'un genre : la question dit laquelle, la fin de tour dit quoi et combien. */
function richesse(genre, payload) {
  if (genre === 'question') return { texte: detailPour(payload), dureeMs: null }
  const tour = lireTour(payload.transcript_path)
  const dernier = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : tour.dernier
  // Une durée négative est une horloge qui a bougé : inconnue, pas nulle.
  const duree = tour.debut === null ? null : Date.now() - tour.debut
  return { texte: dernierePhrase(dernier), dureeMs: duree !== null && duree >= 0 ? duree : null }
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

  const voie = voiePour(process.env, pidPath())
  const cwd = payload?.cwd || process.cwd()

  if (voie === 'osc') {
    // La garde de projet ne vaut que pour la séquence : c'est elle qui
    // atterrirait dans le terminal d'un projet étranger.
    if (!projetEquipe(cwd)) return
    // Le rendu tranche seuil et premier plan (`notif:show`) : la séquence part
    // toujours, c'est aussi l'état de l'onglet et de la barre de menus.
    const charge =
      genre === 'stop' || genre === 'question'
        ? (({ texte, dureeMs }) => ({ texte, duree: dureeMs }))(richesse(genre, payload))
        : detailPour(payload)
    process.stdout.write(JSON.stringify({ terminalSequence: sequence(genre, charge) }))
    return
  }

  // Hors de l'app, seuls ces deux-là appellent l'humain : `busy` et `reset`
  // ne décrivent qu'un onglet qui n'existe pas ici.
  if (genre !== 'stop' && genre !== 'question') return
  if (!voie) return

  const reglages = readSettings()
  const { texte, dureeMs } = richesse(genre, payload)
  if (!aNotifier(genre, dureeMs, reglages.notifications)) return

  const projet = basename(resolve(cwd))
  if (voie === 'inbox') {
    ecrireInbox({
      genre,
      projet,
      texte,
      dureeMs,
      terminal: process.env.__CFBundleIdentifier ?? null,
      session: typeof payload.session_id === 'string' ? payload.session_id : null,
    })
    return
  }
  osascript(contenuNotification({ genre, projet, texte, dureeMs }, reglages.langue), sonPour(genre, reglages.notifications))
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
