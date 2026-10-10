/**
 * Le serveur qui répond déjà sur `baseUrl` est-il celui du projet ? (T-0281)
 *
 * Le crawl refusait tout port occupé : rien dans une réponse HTTP ne distingue
 * le serveur du projet de celui d'un voisin, et photographier le voisin serait
 * le mensonge que ce système ne doit jamais commettre. Mais le cas le plus
 * courant est l'inverse — on travaille, le serveur de dev tourne — et il
 * faisait échouer un crawl sur cinq.
 *
 * La preuve retenue est le `<title>` du HTML servi, comparé à celui qu'a servi
 * le dernier crawl réussi. Réutiliser n'exécute rien : aucune commande `dev`
 * ne part, d'où l'absence d'accord à demander.
 *
 * ponytail: un titre par défaut partagé (« Vite + React ») confond deux projets
 * — captures fausses, sans exécution. Si ça mord, comparer une empreinte du HTML.
 */

/** @param {string} html */
export const titreHtml = html => (/<title[^>]*>([^<]*)<\/title>/i.exec(String(html))?.[1] ?? '').trim()

/**
 * Le titre servi sur `baseUrl`, ou `null` si personne ne répond.
 *
 * `baseUrl` a déjà été restreint à ce poste par `loadConfig` (`urlLocale`) :
 * cette requête ne sort jamais de la machine.
 *
 * @param {string} baseUrl
 * @returns {Promise<string | null>}
 */
export async function titreServi(baseUrl) {
  try {
    const reponse = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
    return titreHtml(await reponse.text())
  } catch {
    return null
  }
}

/**
 * Le titre du dernier crawl réussi, lu dans `pages.json`. `titreHtml` est le
 * titre servi, écrit depuis T-0281 ; avant, le titre rendu de l'accueil.
 *
 * @returns {string}
 */
export function titreAttendu(pagesJson) {
  const accueil = Array.isArray(pagesJson?.pages) ? pagesJson.pages.find(p => p?.route === '/') : null
  const titre = pagesJson?.titreHtml ?? accueil?.title
  return typeof titre === 'string' ? titre.trim() : ''
}

/** Deux titres vides ne prouvent rien. */
export const memeProjet = (servi, attendu) => typeof servi === 'string' && servi !== '' && servi === attendu
