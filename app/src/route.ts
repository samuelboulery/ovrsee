/**
 * L'URL comme état : quel onglet, quel projet, quel ticket, quelle route.
 *
 * Sorti d'`App.tsx` (T-0206) : ce sont des fonctions pures d'une chaîne, sans
 * rapport avec l'état de la fenêtre.
 */

import { t } from './i18n'
import { TABS, type TabId } from './views'

export const tabForPath = (pathname: string): TabId =>
  TABS.find(([, , path]) => path === pathname)?.[0] ?? 'apercu'

/**
 * Le nom de l'onglet tel que l'utilisateur le lit — pour les messages.
 *
 * Lu dans `TABS`, qui porte déjà la clé : une seconde table identifiant → clé
 * finissait par diverger de celle-ci.
 */
export const labelOf = (id: TabId): string =>
  t(TABS.find(([tab]) => tab === id)?.[1] ?? 'tabs.apercu')

/**
 * Le projet courant vit dans la requête, pas dans le chemin.
 *
 * `pathOf()` de crawl/routes.js ignore la requête : la carte n'est donc pas
 * multipliée par le nombre de projets. Effet secondaire utile — un
 * rechargement de page retrouve le projet sélectionné.
 */
export const projectFromUrl = () => new URLSearchParams(window.location.search).get('p')

/** Ticket à ouvrir au montage de l'onglet Tableau — voir `onOuvrirTicket`. */
export const ticketFromUrl = () => new URLSearchParams(window.location.search).get('ticket')

/** Route à charger au montage de l'onglet Navigateur — voir `onOuvrirDansNavigateur`. */
export const routeFromUrl = () => new URLSearchParams(window.location.search).get('route')

export function pushUrl(
  path: string,
  project: string | null,
  ticket: string | null = null,
  route: string | null = null,
) {
  const params = new URLSearchParams()
  if (project) params.set('p', project)
  if (ticket) params.set('ticket', ticket)
  if (route) params.set('route', route)
  const query = params.toString()
  window.history.pushState(null, '', path + (query ? `?${query}` : ''))
}
