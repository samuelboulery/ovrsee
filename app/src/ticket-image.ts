/**
 * Coller une image dans le corps d'un ticket (T-0219, issue #54).
 *
 * L'image est ré-encodée **avant** l'envoi, et ce n'est pas une optimisation :
 * c'est ce qui rend le versionnement tenable. Une capture d'écran Retina pèse
 * 2 à 5 Mo, ne passerait pas `CORPS_MAX` (1 Mo, `server/api.js`), et
 * alourdirait l'historique git pour toujours — `ovrsee/tickets/images/` suit
 * `ovrsee/tickets/`, donc il est versionné par défaut.
 *
 * Le passage par `<canvas>` décode puis ré-encode les pixels : ni EXIF, ni SVG
 * scripté, ni fichier malformé n'atteint le disque. Le serveur revérifie tout
 * de même (`saveTicketImage`, `hooks/tickets.js`) : rien ne force un appelant à
 * passer par ce module.
 */

import { ticketImage } from './api'

/**
 * Le plus grand côté d'une image écrite, en pixels.
 *
 * 1600 rend une capture d'écran lisible en pleine largeur du panneau comme de
 * la modale, pour 100 à 300 ko en WebP — bien sous les 700 ko du serveur.
 */
export const MAX_COTE = 1600

/** Assez pour du texte à l'écran ; au-delà, le gain de poids ne se voit plus. */
const QUALITE = 0.85

/**
 * Insère `![](chemin)` dans un corps de ticket, à la position du curseur.
 *
 * ponytail: aucune mise en forme ajoutée — ni saut de ligne, ni ligne vide.
 * `media()` rend une image en `inline`, pas en bloc (`app/src/markdown.tsx`) :
 * elle s'affiche correctement au milieu d'une phrase, et le curseur dit déjà
 * où l'utilisateur la veut. Une règle qui devinerait mieux que lui couperait
 * une phrase en deux le jour où elle se tromperait.
 */
export function insererImage(
  corps: string,
  chemin: string,
  debut: number,
  fin: number,
): { texte: string; curseur: number } {
  const markdown = `![](${chemin})`

  return {
    texte: `${corps.slice(0, debut)}${markdown}${corps.slice(fin)}`,
    curseur: debut + markdown.length,
  }
}

/**
 * Redimensionne et ré-encode une image en WebP, et rend son data-URI.
 *
 * @throws si le fichier n'est pas une image décodable par le navigateur.
 */
async function reencoder(fichier: File): Promise<string> {
  const bitmap = await createImageBitmap(fichier)
  try {
    const facteur = Math.min(1, MAX_COTE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * facteur)
    canvas.height = Math.round(bitmap.height * facteur)

    const contexte = canvas.getContext('2d')
    if (!contexte) throw new Error('canvas indisponible')
    contexte.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/webp', QUALITE)
  } finally {
    // Un bitmap non fermé garde ses pixels décodés en mémoire jusqu'au GC :
    // quelques captures collées d'affilée pèsent vite plus que l'app.
    bitmap.close()
  }
}

/**
 * L'image d'un presse-papiers ou d'un dépôt de fichier, ou `null`.
 *
 * Un collage porte souvent plusieurs représentations — une image *et* son
 * `text/html` d'origine. On ne retient que la première image ; les captures
 * multiples ne sont pas le geste visé.
 */
export function imageDe(donnees: DataTransfer | null): File | null {
  const fichiers = Array.from(donnees?.files ?? [])
  return fichiers.find(f => f.type.startsWith('image/')) ?? null
}

/**
 * Ré-encode l'image, l'écrit sur disque, et rend son chemin depuis la racine.
 *
 * Le chemin rendu est celui que `mediaUrl()` attend d'un `![](…)` : le rendu
 * markdown et la route de lecture n'ont pas eu à changer pour cette fonction.
 */
export async function collerImage(root: string, ticketId: string, fichier: File): Promise<string> {
  return ticketImage(root, ticketId, await reencoder(fichier))
}
