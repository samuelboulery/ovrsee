#!/usr/bin/env node
/**
 * Hook git post-commit : rattache le commit au plan actif, puis déclenche le
 * crawl en arrière-plan — mais seulement si le commit a touché du code.
 *
 * Ce qui relie l'historique à la carte des pages, ce sont les fichiers : un
 * plan touche des fichiers, et ces fichiers appartiennent à des pages.
 *
 * Exit 0 TOUJOURS. Un hook post-commit qui échoue ne doit ni faire échouer un
 * commit déjà écrit, ni faire attendre l'utilisateur.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachCommitToPlan, isSafePlanFileName } from './plans.js'
import { activePlans, readActive, sessionId } from './active.js'
import { avancerTicketsClos, colonneFinale, EN_COURS, readBoard, readTickets, moveTicket } from './tickets.js'
import { readSettings, mergeSettings } from './settings.js'
import { syncGitignore } from './gitignore-sync.js'
import { readJson } from './snapshot.js'

const HERE = dirname(fileURLToPath(import.meta.url))

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * Sorties reconstruites à chaque commit. Ce ne sont pas des sources : les
 * garder ferait apparaître tous les plans comme touchant toutes les pages, et
 * la relation plan → fichiers → page ne voudrait plus rien dire.
 */
const DERIVED = ['ovrsee/', 'graphify-out/']

/** Fichiers sources du dernier commit. */
function changedFiles(root) {
  try {
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], root)
      .split('\n')
      .filter(f => f && !DERIVED.some(prefix => f.startsWith(prefix)))
  } catch {
    return []
  }
}

/**
 * Ce commit vaut-il un crawl ?
 *
 * `changedFiles()` a déjà retiré `ovrsee/` et `graphify-out/` : une liste vide
 * veut donc dire « ce commit n'a touché que des sorties ». Photographier une
 * application qui n'a pas bougé produit une fournée de captures, laquelle
 * demande un commit, lequel relance un crawl — l'arbre de travail ne redevient
 * alors jamais propre. Constaté le 9 août 2026 : trois commits d'affilée, vingt
 * et une captures, zéro pixel de différence.
 *
 * Une lecture git en échec rend aussi une liste vide, et ne déclenche donc rien.
 * C'est voulu : si on ne sait pas ce qui a changé, on ne dépense pas plusieurs
 * minutes de navigateur là-dessus, et le prochain commit de code le fera.
 *
 * @param {string[]} sources fichiers sources du dernier commit
 */
export const crawlUtile = sources => Array.isArray(sources) && sources.length > 0

/**
 * Le plan auquel ce commit appartient, et d'où on le tient.
 *
 * Le hook git ne reçoit aucun payload : il ne sait pas quelle session a
 * commité. Tant qu'un seul plan pouvait être actif, la question ne se posait
 * pas — le pointeur unique répondait toujours, y compris de travers, et c'est
 * ainsi que des commits se retrouvaient inscrits sous l'intention d'une session
 * voisine.
 *
 * Quatre étages, du plus sûr au plus hasardeux :
 *
 * 1. **Un ticket cité dans le message.** `fix: ... (T-0124)` est la convention
 *    déjà suivie par ce dépôt, et la seule qui marche depuis un terminal
 *    extérieur à Claude Code.
 * 2. **La session.** `CLAUDE_CODE_SESSION_ID` est exporté dans l'environnement
 *    de l'outil Bash, donc hérité par ce hook quand le `git commit` vient d'une
 *    session Claude.
 * 3. **L'unique plan actif**, s'il n'y en a qu'un : rien à confondre.
 * 4. **Rien.** Un commit non rattaché se corrige ; un commit rattaché à la
 *    mauvaise intention ne se voit pas.
 *
 * @returns {{file: string, source: 'ticket'|'session'|'unique'}|null}
 */
export function planPourCommit(ovrseeDir, message, session, tickets) {
  const cites = new Set(String(message ?? '').match(/T-\d{4}/g) ?? [])
  for (const ticket of tickets) {
    if (cites.has(ticket.meta.id) && isSafePlanFileName(ticket.meta.plan)) {
      return { file: ticket.meta.plan, source: 'ticket' }
    }
  }

  const duSession = readActive(ovrseeDir, session).plan
  if (session && isSafePlanFileName(duSession)) return { file: duSession, source: 'session' }

  const actifs = activePlans(ovrseeDir)
  if (actifs.length === 1 && isSafePlanFileName(actifs[0])) {
    return { file: actifs[0], source: 'unique' }
  }

  return null
}

function attachCommit(ovrseeDir, root, sources, message, session, tickets) {
  const choisi = planPourCommit(ovrseeDir, message, session, tickets)
  if (!choisi) {
    const actifs = activePlans(ovrseeDir)
    if (actifs.length > 1) {
      process.stderr.write(
        `[ovrsee] commit non rattaché : ${actifs.length} plans actifs et aucun ticket cité ` +
          `dans le message. Citer « T-XXXX » dans le message pour trancher.\n`,
      )
    }
    return null
  }

  const commit = {
    sha: git(['rev-parse', '--short', 'HEAD'], root),
    date: git(['log', '-1', '--format=%cs'], root),
    files: sources,
  }

  // La règle — plan clos, sha déjà là — vit dans plans.js : elle décide de ce
  // que l'historique raconte, et enfouie ici elle ne se vérifierait qu'en
  // committant pour de vrai.
  return attachCommitToPlan(ovrseeDir, choisi.file, commit) ? choisi : null
}

/**
 * Avance vers la colonne finale les tickets liés à ce plan, s'ils n'y sont
 * pas déjà — par ordre du board, pas par un statut dédié.
 *
 * Un commit est le signal qu'un travail est passé la relecture : que le
 * ticket vienne de « revue » (cas nominal, `ovrsee-tool-stop.js` l'y a mis) ou
 * soit resté en « en cours » (board sans colonne `revue`), le commit le
 * pousse en une fois vers la finale. `en-cours` lui-même est atteint plus tôt,
 * à la première édition sous le plan actif (`ovrsee-tool-edit.js`) — ce hook
 * n'a donc plus à s'en charger.
 *
 * Idempotent à dessein : appelé à chaque commit du plan, pas seulement au
 * dernier. Un ticket déjà en finale n'est jamais retouché — l'avancée
 * manuelle d'un ticket reste toujours plus vraie que cette règle automatique.
 *
 * Silencieuse si le board n'a qu'une seule colonne (`colonneFinale` rend déjà
 * `null`) : un board reconfiguré sans colonne terminale ne doit jamais faire
 * échouer un commit.
 *
 * `devine` coupe le repli du ticket unique : quand le plan lui-même n'a été que
 * déduit (l'unique plan actif, faute de mieux), en déduire aussi le ticket
 * enchaînerait deux paris, et solderait un ticket que personne n'a désigné.
 *
 * Rend les identifiants des tickets réellement déplacés. `reconcile()` s'en sert
 * pour dire au `git pull` ce qu'il vient de solder : ce mouvement-là part du
 * texte d'un message de commit venu d'un remote, et un tableau qui bouge tout
 * seul doit au moins le dire.
 *
 * @returns {string[]} identifiants des tickets passés en colonne finale
 */
export function avancerTicketsDuPlan(ovrseeDir, planFile, message = '', devine = false) {
  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  if (!finale) return []

  // Sans colonne `en-cours`, rien ne distingue un ticket en vol d'un ticket
  // jamais commencé. Ne rien fermer est alors le défaut sûr : un tableau qui
  // garde un ticket de trop se corrige d'un geste, un tableau vidé tout seul
  // ne se remarque pas.
  const iEnCours = colonnes.findIndex(c => c.id === EN_COURS)
  if (iEnCours === -1) return []

  const rangDe = new Map(colonnes.map((c, i) => [c.id, i]))
  const liesAuPlan = readTickets(ovrseeDir, colonnes).filter(t => t.meta.plan === planFile)

  // « En vol » : le travail a commencé. Un commit clôt ce qu'on a fait, pas ce
  // qu'on a prévu — un ticket resté en backlog ou en prêt n'est jamais soldé.
  const enVol = liesAuPlan.filter(
    t => t.meta.colonne !== finale && (rangDe.get(t.meta.colonne) ?? -1) >= iEnCours,
  )

  const cites = new Set(message.match(/T-\d{4}/g) ?? [])

  // L'attribution, dans l'ordre de fiabilité. Citer le ticket dans le message
  // tranche — c'est la convention déjà suivie par ce dépôt. À défaut, on ne
  // devine que si le plan n'a qu'un seul ticket en vol : au-delà, rien ne dit
  // lequel ce commit fait avancer, et fermer les autres est une perte
  // silencieuse.
  const aFermer =
    cites.size > 0
      ? enVol.filter(t => cites.has(t.meta.id))
      : !devine && enVol.length === 1
        ? enVol
        : []

  const soldes = []
  for (const ticket of aFermer) {
    try {
      moveTicket(ovrseeDir, ticket.file, finale)
      soldes.push(ticket.meta.id)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer le commit.
    }
  }
  return soldes
}

/**
 * Lance le crawl détaché : un commit ne doit jamais attendre le démarrage
 * d'une application et d'un navigateur.
 */
function spawnCrawl(root) {
  const crawler = join(HERE, '..', 'crawl', 'index.js')
  if (!existsSync(crawler) || !existsSync(join(root, 'ovrsee.config.json'))) return

  const child = spawn(process.execPath, [crawler], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour en éprouver une décision lancerait un
 * crawl — c'est-à-dire une application et un navigateur — à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = git(['rev-parse', '--show-toplevel'], process.cwd())
    const ovrseeDir = join(root, 'ovrsee')

    if (existsSync(ovrseeDir)) {
      const projectConfig = readJson(join(root, 'ovrsee.config.json')) ?? {}
      syncGitignore(root, mergeSettings(readSettings(), projectConfig))

      const sources = changedFiles(root)

      // Le message porte l'attribution : « (T-0124) » dit de quel ticket, donc
      // de quel plan, ce commit parle. Une lecture git en échec rend une chaîne
      // vide, et on retombe alors sur les étages suivants.
      let message = ''
      try {
        message = git(['log', '-1', '--format=%B'], root)
      } catch {
        // Sans message, on n'attribue rien de plus qu'avant.
      }

      const choisi = attachCommit(
        ovrseeDir,
        root,
        sources,
        message,
        sessionId(),
        readTickets(ovrseeDir),
      )
      if (choisi) {
        process.stdout.write(`[ovrsee] commit rattaché à ${choisi.file}\n`)
        avancerTicketsDuPlan(ovrseeDir, choisi.file, message, choisi.source === 'unique')
      }
      // Filet à chaque commit : rattrape un ticket resté en retard, quelle
      // que soit la raison (CLI qui aurait oublié d'avancer, dérive passée).
      avancerTicketsClos(ovrseeDir)
      if (crawlUtile(sources)) spawnCrawl(root)
    }
  } catch (err) {
    process.stderr.write(`[ovrsee] post-commit ignoré : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
