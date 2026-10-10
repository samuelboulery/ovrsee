/**
 * Le serveur qui répond déjà sur `baseUrl` est-il celui du projet ? (T-0281)
 *
 * Le crawl refusait tout port occupé : rien dans une réponse HTTP ne distingue
 * le serveur du projet de celui d'un voisin, et photographier le voisin serait
 * le mensonge que ce système ne doit jamais commettre. Mais le cas le plus
 * courant est l'inverse — on travaille, le serveur de dev tourne — et il
 * faisait échouer un crawl sur cinq.
 *
 * La preuve retenue est le `<title>` servi, comparé à celui qu'a servi le
 * serveur que le crawler a lui-même lancé la dernière fois. Cette référence
 * vit dans `trust.json`, **hors du dépôt** (`retenirServeur`) : lue dans
 * `pages.json`, un dépôt hostile l'aurait choisie pour faire photographier un
 * autre service du poste sans même passer par l'accord.
 *
 * ponytail: un titre par défaut partagé (« Vite + React ») sur le même port
 * confond deux projets — captures fausses, sans exécution. Si ça mord,
 * retenir une empreinte du HTML plutôt que le titre.
 */

/** @param {string} html */
export const titreHtml = html => (/<title[^>]*>([^<]*)<\/title>/i.exec(String(html))?.[1] ?? '').trim().slice(0, 200)

/**
 * Le titre servi sur `baseUrl`, ou `null` si personne ne répond.
 *
 * `baseUrl` a déjà été restreint à ce poste par `loadConfig` (`urlLocale`), et
 * une redirection n'est pas suivie : cette requête ne sort jamais de la machine.
 *
 * @param {string} baseUrl
 * @returns {Promise<string | null>}
 */
export async function titreServi(baseUrl) {
  try {
    const reponse = await fetch(baseUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
    return titreHtml(await reponse.text())
  } catch {
    return null
  }
}

/**
 * Le serveur sur `baseUrl` est celui que le crawler a lancé la dernière fois.
 * Deux titres vides ne prouvent rien.
 *
 * @param {{ baseUrl: string, titre: string } | null} connu lu dans `trust.json`
 */
export const memeServeur = (connu, baseUrl, servi) =>
  connu?.baseUrl === baseUrl && typeof servi === 'string' && servi !== '' && servi === connu.titre
