/**
 * Rattraper les commits qu'aucun hook n'a vus.
 *
 * Le hook `post-commit` ne tourne que sur la machine qui committe. Un
 * squash-merge fait sur GitHub crée son commit sur les serveurs de GitHub :
 * aucun hook, aucun rattachement. Le commit arrive ensuite par un `git pull`,
 * et il n'y a plus personne pour le relier au plan qu'il réalise.
 *
 * Le symptôme, observé sur ce dépôt : cinq plans restés ouverts avec zéro
 * commit, et seize tickets « à faire », pour du travail livré la veille. Un
 * `ovrsee:close` refusait de les clore — à raison, puisqu'il date la clôture
 * d'après le dernier commit du plan.
 *
 * Ce module lit le message des commits, pas leur provenance. Il n'a donc rien à
 * savoir de GitHub : ce qui cite un ticket se rattache au plan de ce ticket, que
 * le commit soit né ici ou ailleurs.
 *
 * Trois différences avec `planPourCommit`, et elles sont la raison d'être de ce
 * fichier :
 *
 * 1. **Plusieurs plans par commit.** Un squash écrase cinq plans en un commit ;
 *    n'en rendre qu'un en laisserait quatre ouverts.
 * 2. **N'importe quel commit**, pas seulement `HEAD`.
 * 3. **Rien n'est deviné.** Pas de repli sur la session ni sur l'unique plan
 *    actif : au moment du `pull`, la session courante n'a rien à voir avec le
 *    travail qui arrive. Seul un ticket cité fait foi.
 */

import { execFileSync } from 'node:child_process'

import { attachCommitToPlan, readPlans } from './plans.js'
import { readTickets } from './tickets.js'
import { avancerTicketsDuPlan } from './ovrsee-post-commit.js'

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/**
 * Les tickets qu'un message désigne, intervalles compris.
 *
 * Ce dépôt titre ses fusions « (T-0164 → T-0179) ». Ne lire que les deux bornes
 * laisserait quatorze tickets — et les plans qui les portent — sur le carreau,
 * alors que le message dit précisément qu'ils sont tous dedans. La flèche et le
 * tiret sont acceptés ; au-delà de cent tickets d'écart, l'intervalle est tenu
 * pour une coïncidence de mise en forme et seules les bornes comptent.
 *
 * @param {string} message
 * @returns {Set<string>}
 */
export function ticketsCites(message) {
  const texte = String(message ?? '')
  const cites = new Set(texte.match(/T-\d{4}/g) ?? [])

  for (const [, a, b] of texte.matchAll(/T-(\d{4})\s*(?:→|->|…|\.\.\.)\s*T-(\d{4})/g)) {
    const debut = Number(a)
    const fin = Number(b)
    if (fin <= debut || fin - debut > 100) continue
    for (let n = debut; n <= fin; n++) cites.add(`T-${String(n).padStart(4, '0')}`)
  }

  return cites
}

/**
 * Les plans **ouverts** que ce message réalise, d'après les tickets qu'il cite.
 *
 * Les plans clos sont écartés ici plutôt que laissés à `attachCommitToPlan` :
 * celui-ci les refuserait de toute façon, mais les compter ferait annoncer un
 * rattachement qui n'a pas eu lieu.
 *
 * @param {string} ovrseeDir
 * @param {string} message
 * @returns {string[]} noms de fichiers de plans, sans doublon
 */
export function plansPourMessage(ovrseeDir, message) {
  const cites = ticketsCites(message)
  if (cites.size === 0) return []

  const ouverts = new Set(
    readPlans(ovrseeDir)
      .filter(p => p.meta.status === 'open')
      .map(p => p.file),
  )

  const trouves = new Set()
  for (const ticket of readTickets(ovrseeDir)) {
    if (cites.has(ticket.meta.id) && ouverts.has(ticket.meta.plan)) trouves.add(ticket.meta.plan)
  }
  return [...trouves]
}

/** Les sha déjà consignés, tous plans confondus. */
function dejaVus(ovrseeDir) {
  const vus = new Set()
  for (const plan of readPlans(ovrseeDir)) {
    for (const commit of plan.meta.commits ?? []) vus.add(commit.sha)
  }
  return vus
}

/**
 * Rattache les commits récents aux plans ouverts qu'ils réalisent.
 *
 * La fenêtre n'est pas arbitraire : on remonte à l'ouverture du plus ancien plan
 * ouvert. Un commit antérieur ne peut réaliser aucun d'eux, et sans plan ouvert
 * il n'y a rien à rattraper — la fonction sort alors sans lancer git.
 *
 * Idempotent : `attachCommitToPlan` refuse un sha déjà présent et un plan clos.
 *
 * @param {string} ovrseeDir
 * @param {string} root racine du dépôt
 * @param {(message: string) => void} [dire] pour tracer, sur stderr
 * @returns {Array<{sha: string, plans: string[]}>} ce qui a été rattaché
 */
export function reconcile(ovrseeDir, root, dire = () => {}) {
  const ouverts = readPlans(ovrseeDir).filter(p => p.meta.status === 'open')
  if (ouverts.length === 0) return []

  const depuis = ouverts
    .map(p => p.meta.opened)
    .filter(Boolean)
    .sort()[0]
  if (!depuis) return []

  const vus = dejaVus(ovrseeDir)
  const fait = []

  // `%x00` sépare les champs et `%x01` les commits : un message de commit
  // contient des sauts de ligne, et découper dessus casserait au premier
  // message à corps — c'est-à-dire à tous ceux de ce dépôt.
  let brut
  try {
    brut = git(['log', `--since=${depuis}`, '--format=%h%x00%cs%x00%B%x01'], root)
  } catch {
    // Pas un dépôt git, ou git absent : rien à rattraper, rien à signaler.
    return []
  }

  for (const bloc of brut.split('\x01')) {
    const [sha, date, message] = bloc.replace(/^\n/, '').split('\x00')
    if (!sha || vus.has(sha)) continue

    const rattaches = []
    for (const plan of plansPourMessage(ovrseeDir, message)) {
      // `files: []`, et non la liste réelle : ce commit n'a pas été vu passer,
      // et un squash porte les fichiers de toute une branche. Les inscrire
      // ferait croire que ce plan a touché tout ce que la fusion contenait, et
      // la relation plan → fichiers → page ne voudrait plus rien dire.
      if (attachCommitToPlan(ovrseeDir, plan, { sha, date, files: [] })) {
        rattaches.push(plan)
        avancerTicketsDuPlan(ovrseeDir, plan, message)
      }
    }

    if (rattaches.length > 0) {
      fait.push({ sha, plans: rattaches })
      dire(`[ovrsee] ${sha} rattaché à ${rattaches.join(', ')}\n`)
    }
  }

  return fait
}
