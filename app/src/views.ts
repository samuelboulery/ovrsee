/**
 * Le registre des 7 vues — extrait d'`App.tsx` pour que `CommandPalette.tsx`
 * puisse le lire sans créer un import circulaire (`App.tsx` monte
 * `CommandPalette`, qui a besoin des mêmes vues que le rail).
 */
import {
  Browser,
  ClockCounterClockwise,
  Database,
  Graph,
  House,
  Kanban,
  Stack as StackIcon,
} from '@phosphor-icons/react'

import type { SettingsType } from './data'

/**
 * Chaque onglet a sa route.
 *
 * Ce n'est pas du confort : un crawler découvre les écrans en suivant les
 * `<a href>`. Tant que les onglets vivaient dans un état React, Ovrsee
 * produisait une carte à une seule page de lui-même — exactement la limite
 * relevée sur `associa`.
 *
 * Aperçu tient `/`, sans redirection : ouvrir un projet doit d'abord dire de
 * quoi il s'agit, et la page d'entrée du graphe est alors celle par où on entre
 * vraiment. Produit descend sur `/produit` — une vraie route de plus, pas une
 * page fantôme : la carte gagne un nœud, elle n'en perd aucun. Les captures
 * déjà prises de l'ancien `/` ont suivi dans `shots/produit/`, sans quoi vingt
 * images du graphe passeraient pour l'historique visuel d'Aperçu.
 */
export const TABS = [
  ['apercu', 'tabs.apercu', '/'],
  ['navigateur', 'tabs.navigateur', '/navigateur'],
  ['produit', 'tabs.produit', '/produit'],
  ['historique', 'tabs.historique', '/historique'],
  ['tableau', 'tabs.tableau', '/tableau'],
  ['donnees', 'tabs.donnees', '/donnees'],
  ['stack', 'tabs.stack', '/stack'],
] as const

export type TabId = (typeof TABS)[number][0]

/** Un picto Phosphor par vue, pour le rail — maquette 2a : contour au repos, plein à l'état actif. */
export const TAB_ICONS: Record<TabId, typeof House> = {
  apercu: House,
  navigateur: Browser,
  produit: Graph,
  historique: ClockCounterClockwise,
  tableau: Kanban,
  donnees: Database,
  stack: StackIcon,
}

/**
 * Onglets actifs, dans l'ordre choisi dans les préférences.
 *
 * `TABS` en tombant en repli : tant que les paramètres ne sont pas chargés,
 * tout est actif dans l'ordre déclaré — mieux vaut tout montrer que
 * éviter un écran vide au démarrage.
 *
 * @param settings préférences chargées (ou null au démarrage)
 * @returns liste des onglets actifs dans l'ordre configuré
 */
export const activeTabsInOrder = (settings: SettingsType | null) => {
  if (!settings) return TABS
  const active = new Set(settings.onglets.actifs)
  return TABS.filter(([id]) => active.has(id)).sort(
    (a, b) => settings.onglets.ordre.indexOf(a[0]) - settings.onglets.ordre.indexOf(b[0]),
  )
}
