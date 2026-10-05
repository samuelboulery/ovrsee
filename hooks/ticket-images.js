/**
 * Les images collées dans un ticket (T-0219, issue #54) : `ovrsee/tickets/images/`,
 * un fichier par image, nommé d'après l'identifiant de son ticket.
 */

import { readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import { writeFileNoFollow } from './plans.js'
import { isSafeTicketId } from './ticket-id.js'

/** Le dossier des images de tickets, relatif à la racine du dépôt. */
export const IMAGES_DIR = 'ovrsee/tickets/images'

/**
 * Plafond d'une image de ticket, en octets bruts.
 *
 * `CORPS_MAX` (server/api.js) plafonne le corps de requête à 1 Mo, et le base64
 * gonfle de 33 % : au-delà d'environ 750 ko l'envoi serait coupé côté serveur
 * sans qu'on sache dire pourquoi. Le client ré-encode bien en dessous — 1600 px
 * de côté en WebP q0.85 tient dans 100 à 300 ko pour une capture d'écran — donc
 * ce plafond n'est pas une gêne, c'est le refus qui reste lisible.
 */
const IMAGE_MAX_OCTETS = 700_000

const PREFIXE_WEBP = 'data:image/webp;base64,'

/**
 * Écrit une image collée dans un ticket, et rend son chemin depuis la racine.
 *
 * **Une image de ticket est une donnée du dépôt** (T-0219, issue #54) : elle vit
 * sous `ovrsee/tickets/`, donc elle suit le réglage `gitignorePlans` sans qu'un
 * bloc `.gitignore` de plus existe. Le chemin rendu est relatif à la racine du
 * dépôt, pas à `ovrsee/`, parce que c'est ce que `mediaUrl()` → `/api/media`
 * attend d'un `![](…)` — voir `app/src/pages.ts`.
 *
 * `dataUri` vient du rendu, donc du dehors : il est traité comme hostile.
 * Le client a beau ré-encoder en WebP par `<canvas>` avant l'envoi, rien ne
 * force un appelant à passer par lui. D'où la triple vérification ici — type
 * annoncé, octets magiques, taille — et le nom de fichier **généré par le
 * serveur** : l'appelant ne choisit jamais où sa donnée atterrit.
 *
 * @param {string} ovrseeDir
 * @param {string} ticketId identifiant du ticket propriétaire (`T-0042`)
 * @param {unknown} dataUri `data:image/webp;base64,…`
 * @returns {string} `ovrsee/tickets/images/T-0042-a1b2c3d4.webp`
 */
export function saveTicketImage(ovrseeDir, ticketId, dataUri) {
  // L'identifiant devient un morceau de nom de fichier : le valider est ce qui
  // rend une traversée de chemin impossible, avant même toute vérification de
  // contenu.
  if (!isSafeTicketId(ticketId)) {
    throw new Error(`identifiant de ticket invalide : ${ticketId}`)
  }
  if (typeof dataUri !== 'string' || !dataUri.startsWith(PREFIXE_WEBP)) {
    throw new Error('seule une image WebP en data-URI est acceptée')
  }

  // Avant de décoder, pas après : `CORPS_MAX` borne le corps de requête du dev
  // server, mais `fetchHandler` (Electron) lit le sien en entier avant d'appeler
  // ici. Sans cette borne, un data-URI de 500 Mo serait mis en mémoire pour être
  // rejeté ensuite. Le base64 gonfle de 4/3, d'où la marge.
  if (dataUri.length > IMAGE_MAX_OCTETS * 2) {
    throw new Error('image trop volumineuse')
  }

  // Node décode le base64 sans broncher, y compris du charabia : ce sont les
  // octets magiques plus bas qui font foi, jamais le type annoncé.
  const octets = Buffer.from(dataUri.slice(PREFIXE_WEBP.length), 'base64')

  if (octets.length > IMAGE_MAX_OCTETS) {
    throw new Error(`image trop volumineuse : ${octets.length} octets`)
  }
  // `RIFF` puis, quatre octets de taille plus loin, `WEBP`.
  const entete = octets.subarray(0, 4).toString('latin1')
  const format = octets.subarray(8, 12).toString('latin1')
  if (entete !== 'RIFF' || format !== 'WEBP') {
    throw new Error('ces octets ne sont pas une image WebP')
  }

  const nom = `${ticketId}-${randomBytes(4).toString('hex')}.webp`
  writeFileNoFollow(join(ovrseeDir, 'tickets', 'images', nom), octets)
  return `${IMAGES_DIR}/${nom}`
}

/**
 * Les images d'un ticket : celles dont le nom porte son identifiant.
 *
 * Le lien se fait par le nom du fichier, pas par les `![](…)` du corps. Deux
 * raisons : une image collée puis retirée du texte resterait sinon sur le
 * disque pour toujours, et un corps qui cite l'image d'un autre ticket — un
 * copier-coller suffit — ne doit pas pouvoir la faire supprimer.
 */
export function imagesDuTicket(ovrseeDir, id) {
  const dir = join(ovrseeDir, 'tickets', 'images')
  const attendu = new RegExp(`^${id}-[0-9a-f]{8}\\.webp$`)
  try {
    return readdirSync(dir)
      .filter(nom => attendu.test(nom))
      .map(nom => join(dir, nom))
  } catch {
    return []
  }
}
