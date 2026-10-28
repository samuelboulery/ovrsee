/**
 * Les sessions Claude lancées hors de l'app — iTerm, Terminal, VS Code… (T-0309).
 *
 *   hook (hors de l'app) ──▶ ~/.claude/ovrsee/sessions/<id>.json ──▶ [ ce fichier ] ──▶ tray.js ──▶ popover
 *
 * Les sessions du terminal de l'app viennent du rendu, qui lit leur pty. Celles
 * d'ailleurs n'ont pas de pty ici : leur hook tient une carte par session
 * (`suivreSessionExterne`, `hooks/ovrsee-notify.js`), et ce fichier ne fait que
 * relire le dossier, valider, et pousser la liste à `tray.js`.
 *
 * **Le dossier n'est pas une surface de contrôle**, pas plus que l'inbox :
 * n'importe quel processus du compte peut y écrire. Rien n'y est cru — lecture
 * bornée sans lien (`lireBorne`), contenu validé (`validerSessionExterne`) — et
 * le seul geste qui en découle, `activer()`, ne fait qu'un `open -b` sur un
 * bundle de `TERMINAUX`, retrouvé dans *notre* liste et jamais reçu du rendu.
 *
 * Contrairement à l'inbox, rien n'est effacé à la lecture : une carte décrit
 * un état qui dure. Elle part au `SessionEnd` de sa session (le hook l'efface),
 * ou ici au bout de `PEREMPTION_MS`.
 */

import { execFile } from 'node:child_process'
import { chmodSync, mkdirSync, readdirSync, unlinkSync, watch } from 'node:fs'
import { join } from 'node:path'

import { sessionsDir, validerSessionExterne } from '../hooks/ovrsee-notify.js'
import { lireBorne, TERMINAUX } from './notifications.js'
import { setExternes } from './tray.js'

/**
 * Une session tuée — terminal fermé, `kill`, machine éteinte — n'envoie pas de
 * `SessionEnd`, et sa carte resterait pour toujours.
 *
 * ponytail: plafond fixe de 24 h — une session réellement ouverte mais muette
 * depuis un jour disparaît du popover jusqu'à son prochain tour, et une session
 * tuée reste affichée jusqu'à 24 h. Vérifier le pid de la session si l'un des
 * deux se voit.
 */
const PEREMPTION_MS = 24 * 60 * 60 * 1000

/** Cartes lues au plus — un dossier inondé ne doit pas inonder le popover. */
const MAX_CARTES = 50

/** Taille maximale d'une carte, comme `validerSessionExterne`. */
const MAX_CARTE = 4 * 1024

/** `fs.watch` signale plusieurs fois un même rename : on relit une fois, un peu après. */
const REGROUPEMENT_MS = 50

/** Relecture de fond, pour que la péremption joue même sans événement. */
const RELECTURE_MS = 60 * 60 * 1000

/** @type {Array<ReturnType<typeof validerSessionExterne>>} */
let cartes = []
let veilleur = null
let minuterie = null
let relecture = null

/**
 * Relit tout le dossier.
 *
 * ponytail: relecture complète à chaque événement — quelques fichiers de
 * quelques centaines d'octets, bornés à `MAX_CARTES`. Passer à une mise à jour
 * par fichier si le dossier grossit.
 */
function relire(dossier) {
  let noms
  try {
    noms = readdirSync(dossier).filter(nom => nom.endsWith('.json')).slice(0, MAX_CARTES)
  } catch (err) {
    process.stderr.write(`[ovrsee] sessions externes illisibles : ${err?.message ?? err}\n`)
    return
  }

  const maintenant = Date.now()
  const lues = []
  for (const nom of noms) {
    const fichier = join(dossier, nom)
    let carte
    try {
      const brut = lireBorne(fichier, MAX_CARTE)
      carte = brut === null ? null : validerSessionExterne(brut)
    } catch (err) {
      // Effacée entre `readdir` et l'ouverture : son `SessionEnd`, c'est normal.
      if (err?.code !== 'ENOENT') process.stderr.write(`[ovrsee] session externe illisible : ${err?.message ?? err}\n`)
      continue
    }
    if (!carte) {
      process.stderr.write(`[ovrsee] session externe ignorée, contenu invalide : ${fichier}\n`)
      continue
    }
    if (maintenant - carte.at > PEREMPTION_MS) {
      try {
        unlinkSync(fichier)
      } catch {
        // Déjà partie.
      }
      continue
    }
    lues.push(carte)
  }

  cartes = lues
  // Le chemin complet reste ici : le popover n'affiche que le nom du dossier.
  setExternes(cartes.map(({ cwd: _cwd, ...visible }) => visible))
}

/**
 * Ramène au premier plan le terminal d'une session hors de l'app.
 *
 * Le rendu ne donne qu'un identifiant de session : le bundle est celui de
 * notre liste, et il doit encore figurer dans `TERMINAUX`.
 *
 * @param {unknown} session
 * @returns {boolean} vrai si `open -b` a été lancé
 */
export function activer(session) {
  if (typeof session !== 'string') return false
  const carte = cartes.find(c => c.session === session)
  if (!carte?.terminal || !TERMINAUX.has(carte.terminal)) return false
  execFile('open', ['-b', carte.terminal], err => {
    if (err) process.stderr.write(`[ovrsee] terminal non activé : ${err.message}\n`)
  })
  return true
}

/** Lit le dossier et le surveille. Appelé avec `demarrerNotifications`. */
export function demarrerSessionsExternes() {
  const dossier = sessionsDir()
  try {
    // Même geste que l'inbox : le hook a pu créer le dossier le premier.
    mkdirSync(dossier, { recursive: true, mode: 0o700 })
    chmodSync(dossier, 0o700)
  } catch (err) {
    process.stderr.write(`[ovrsee] sessions externes indisponibles : ${err?.message ?? err}\n`)
    return
  }

  relire(dossier)
  veilleur = watch(dossier, () => {
    clearTimeout(minuterie)
    minuterie = setTimeout(() => relire(dossier), REGROUPEMENT_MS)
  })
  veilleur.on('error', err => process.stderr.write(`[ovrsee] sessions externes : ${err?.message ?? err}\n`))
  relecture = setInterval(() => relire(dossier), RELECTURE_MS)
  relecture.unref()
}

export function arreterSessionsExternes() {
  veilleur?.close()
  veilleur = null
  clearTimeout(minuterie)
  clearInterval(relecture)
}
