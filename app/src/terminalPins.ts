/**
 * Les tailles de terminal épinglées à une page.
 *
 * La taille du panneau est globale à l'application (`settings.terminal.hauteur`
 * et `.largeur`) : une seule valeur pour les sept vues. Or le besoin diffère
 * par page — sur Tableau on veut un terminal court qui laisse voir le Kanban,
 * sur Produit on le veut haut. Une épingle retient la taille courante pour le
 * couple (onglet, disposition) et fige le séparateur tant qu'elle tient.
 *
 * Le magasin vit dans `localStorage`, pas dans les préférences : c'est une
 * habitude de poste, comme la largeur de la barre latérale (`useResizable`,
 * préfixe `ovrsee.size.`). La faire transiter par l'API pour un réglage qui ne
 * quitte jamais la machine coûterait un schéma, un validateur et un aller-retour.
 */
import type { Layout } from './terminalLayout'
import type { TabId } from './views'

/** Clé `${onglet}:${disposition}` vers une taille en pixels. */
export type Pins = Record<string, number>

const STORAGE_KEY = 'ovrsee.terminal.pins'

export const pinKey = (tab: TabId, layout: Layout): string => `${tab}:${layout}`

/**
 * La taille épinglée pour cette page, ou `undefined`.
 *
 * « Plein » n'a pas de taille propre — il prend tout l'espace — donc rien à
 * épingler : le bouton ne s'affiche même pas dans cette disposition.
 */
export function pinFor(pins: Pins, tab: TabId, layout: Layout): number | undefined {
  if (layout === 'full') return undefined
  return pins[pinKey(tab, layout)]
}

/** Pose l'épingle à `size`, ou la retire si elle y était déjà. */
export function togglePin(pins: Pins, tab: TabId, layout: Layout, size: number): Pins {
  const key = pinKey(tab, layout)
  if (key in pins) {
    const { [key]: _retiree, ...reste } = pins
    return reste
  }
  return { ...pins, [key]: size }
}

export function readPins(): Pins {
  try {
    const brut: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {}

    // Le magasin vient du disque : une entrée corrompue à la main ne doit pas
    // figer le panneau à une taille absurde.
    const propre: Pins = {}
    for (const [key, valeur] of Object.entries(brut as Record<string, unknown>)) {
      if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0) propre[key] = valeur
    }
    return propre
  } catch {
    return {}
  }
}

export function writePins(pins: Pins): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // Stockage indisponible : les épingles valent pour la session, c'est tout.
  }
}
