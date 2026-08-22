/**
 * Ce qu'on accepte de remettre au système hôte.
 *
 * `shell.openExternal` sort du bac à sable : l'URL est confiée au système, qui
 * la donne à l'application enregistrée pour son schéma. Or l'onglet Navigateur
 * est un navigateur complet — barre d'adresse, `allowpopups`, et aucun garde de
 * navigation sur l'invité — donc l'URL peut venir d'une page tierce. Un
 * `window.open('file:///Applications/…')` lancerait l'application visée, un
 * `smb://` partirait chercher un partage distant, un schéma enregistré par un
 * autre logiciel installé lui passerait ses paramètres.
 *
 * Liste blanche, donc, du même esprit que `EDITORS` dans `main.js` : http et
 * https, rien d'autre. `mailto:` n'est pas écarté par excès de prudence — il
 * n'a simplement jamais servi ici, et une liste blanche se rallonge le jour où
 * un besoin paraît, pas avant.
 *
 * Module à part parce qu'il n'importe rien d'Electron : c'est ce qui le rend
 * éprouvable sans fenêtre.
 */

/** Les seuls schémas qu'on remet au système. */
const SCHEMES = new Set(['http:', 'https:'])

/**
 * Cette URL peut-elle sortir vers le navigateur du système ?
 *
 * @param {unknown} url l'URL demandée par une page, de confiance ou non
 * @returns {boolean} vrai pour http et https, faux pour tout le reste — y
 *   compris ce qui n'est pas une URL absolue du tout
 */
export function ouvrable(url) {
  try {
    return SCHEMES.has(new URL(String(url)).protocol)
  } catch {
    return false
  }
}
