/**
 * Ce que les réponses de la présentation règlent — et rien d'autre.
 *
 * Module pur : aucun React, aucun réseau. Une question dont la réponse ne change
 * rien est du bruit, donc chaque valeur admise ici a une conséquence visible,
 * écrite noir sur blanc dans les deux tables ci-dessous.
 *
 * La séparation avec `PreferencesProfils.tsx` : ce module choisit *quel* template
 * proposer, ce module-là sait *comment* l'appliquer. On ne réécrit pas
 * `appliquerProfil()`.
 */

import type { SettingsType } from './data'
import { PROFILS, appliquerProfil, profilCourant } from './PreferencesProfils'

/** Ce que la présentation retient d'une personne. */
export type Reponses = {
  /** Le template retenu : choisi directement dans la galerie, plus jamais déduit d'une matrice. */
  profil: string
  /**
   * Les vues actives, quand la grille de bascules de l'écran 2 (maquette 2j)
   * s'écarte du template choisi. `null` tant qu'on n'y a pas touché — le
   * template décide seul.
   */
  vuesActives: string[] | null
  /** Proposer une commande à l'ouverture d'un projet neuf. */
  bootstrap: boolean
}

/**
 * La commande proposée par défaut à l'ouverture d'un projet neuf.
 *
 * `/project-setup` sert à qui découvre ; l'écran 3 laisse ensuite un switch
 * explicite pour qui n'en veut pas.
 */
const BOOTSTRAP_DEFAUT = ['/project-setup']

/**
 * Les préférences telles qu'elles seront après la présentation.
 *
 * Fonction totale : un profil inconnu retombe sur le premier de la liste
 * (« Complet ») plutôt que de ne rien appliquer, parce qu'un écran passé à la
 * va-vite doit quand même laisser des réglages cohérents derrière lui.
 *
 * Ce qui n'est *pas* touché : la langue, le thème, la densité et `claude`
 * (niveau/usage — l'accueil ne pose plus cette question, voir
 * `hooks/settings.js:DEFAULT_SETTINGS`). Ils ont leur propre écran ou leur
 * propre défaut, et les écraser ici ferait qu'un changement de profil
 * déferait un réglage sans rapport.
 */
export function appliquerReponses(settings: SettingsType, reponses: Reponses): SettingsType {
  const profil = PROFILS.find(p => p.id === reponses.profil) ?? PROFILS[0]
  // La grille de la maquette 2j l'emporte sur le template dès qu'on y a
  // touché — sinon un réglage fin serait repris par le prochain rendu.
  const applique = appliquerProfil(
    settings,
    reponses.vuesActives ? { ...profil, actifs: reponses.vuesActives } : profil,
  )

  return {
    ...applique,
    bootstrap: reponses.bootstrap ? BOOTSTRAP_DEFAUT : [],
    onboardingVu: true,
  }
}

/**
 * L'aperçu d'un choix en cours, sans le marquer comme vu.
 *
 * C'est ce que rend la maquette de l'écran 2 : on veut voir ce que le choix
 * donnerait, pas clore la présentation à chaque clic.
 */
export const apercuReponses = (settings: SettingsType, reponses: Reponses): SettingsType => ({
  ...appliquerReponses(settings, reponses),
  onboardingVu: false,
})

/**
 * Les réponses de départ, reprises des préférences quand elles existent déjà —
 * cas d'un « Revoir la présentation » : on ne redemande pas ce qu'on sait.
 */
export function reponsesInitiales(settings: SettingsType): Reponses {
  return {
    profil: profilCourant(settings) ?? PROFILS[0].id,
    vuesActives: null,
    bootstrap: true,
  }
}
