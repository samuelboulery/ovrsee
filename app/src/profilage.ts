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

export type Usage = 'terminal' | 'ide' | 'desktop' | 'autre'

export const USAGES: Usage[] = ['terminal', 'ide', 'desktop', 'autre']

/** Ce que la présentation retient d'une personne. */
export type Reponses = {
  usage: Usage
  /** Le template retenu : choisi directement dans la galerie, plus jamais déduit d'une matrice. */
  profil: string
  /** Proposer une commande à l'ouverture d'un projet neuf. */
  bootstrap: boolean
}

/**
 * Le template suggéré par défaut, avant que la galerie ne devienne le vrai
 * choix : sans terminal, les onglets qui supposent une session ouverte n'ont
 * plus de raison d'occuper la barre.
 */
export function profilSuggere(usage: Usage): string {
  const avecTerminal = usage === 'terminal' || usage === 'ide'
  return avecTerminal ? 'complet' : 'sobre'
}

/**
 * La place du terminal, dictée par la façon dont Claude Code est lancé.
 *
 * Appliquée *après* le template : un template range les onglets, mais c'est
 * l'usage réel qui sait si une session tourne à côté et où elle doit tenir.
 * Sans terminal (Claude Desktop, autre), `disabled` coupe aussi la pastille de
 * réouverture — pas seulement `visible`, qui ne fait que replier le panneau.
 */
export function terminalPourUsage(
  usage: Usage,
): { visible: boolean; disposition?: string; disabled: boolean } {
  if (usage === 'terminal') return { visible: true, disposition: 'side', disabled: false }
  if (usage === 'ide') return { visible: true, disposition: 'bottom', disabled: false }
  return { visible: false, disabled: true }
}

/**
 * La commande proposée par défaut à l'ouverture d'un projet neuf.
 *
 * `/project-setup` sert à qui découvre ; l'écran 3 laisse ensuite un switch
 * explicite pour qui n'en veut pas.
 */
export const BOOTSTRAP_DEFAUT = ['/project-setup']

/**
 * Les préférences telles qu'elles seront après la présentation.
 *
 * Fonction totale : un profil inconnu retombe sur la suggestion plutôt que de
 * ne rien appliquer, parce qu'un écran passé à la va-vite doit quand même
 * laisser des réglages cohérents derrière lui.
 *
 * Ce qui n'est *pas* touché : la langue, le thème et la densité. Ils ont leur
 * propre écran et se règlent séparément — les écraser ici ferait qu'un
 * changement de profil déferait un choix de thème.
 */
export function appliquerReponses(settings: SettingsType, reponses: Reponses): SettingsType {
  const id = PROFILS.some(p => p.id === reponses.profil)
    ? reponses.profil
    : profilSuggere(reponses.usage)
  const profil = PROFILS.find(p => p.id === id) ?? PROFILS[0]

  const applique = appliquerProfil(settings, profil)

  return {
    ...applique,
    terminal: { ...applique.terminal, ...terminalPourUsage(reponses.usage) },
    bootstrap: reponses.bootstrap ? BOOTSTRAP_DEFAUT : [],
    claude: { niveau: settings.claude?.niveau ?? 'intermediaire', usage: reponses.usage },
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
  const usage = (USAGES as string[]).includes(settings.claude?.usage ?? '')
    ? (settings.claude?.usage as Usage)
    : 'terminal'
  return {
    usage,
    profil: profilCourant(settings) ?? profilSuggere(usage),
    bootstrap: true,
  }
}
