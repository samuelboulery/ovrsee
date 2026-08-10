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
import { PROFILS, appliquerProfil } from './PreferencesProfils'

export type Niveau = 'debutant' | 'intermediaire' | 'avance' | 'expert'
export type Usage = 'terminal' | 'ide' | 'desktop' | 'autre'

export const NIVEAUX: Niveau[] = ['debutant', 'intermediaire', 'avance', 'expert']
export const USAGES: Usage[] = ['terminal', 'ide', 'desktop', 'autre']

/** Ce que la présentation retient d'une personne. */
export type Reponses = {
  niveau: Niveau
  usage: Usage
  /** Le template retenu, déduit puis éventuellement écrasé à la main. */
  profil: string
  /** Proposer une commande à l'ouverture d'un projet neuf. */
  bootstrap: boolean
}

/**
 * Le template suggéré : l'usage décide de la place du terminal, le niveau de la
 * surface montrée.
 *
 * Débutant ou occasionnel, on ne cache rien — un onglet masqué qu'on ignore est
 * un onglet qu'on ne redécouvrira jamais. Aguerri, on resserre sur ce qui sert
 * tous les jours. Sans terminal (Claude Desktop, autre), les onglets qui
 * supposent une session ouverte n'ont plus de raison d'occuper la barre.
 */
export function profilSuggere(niveau: Niveau, usage: Usage): string {
  const aguerri = niveau === 'avance' || niveau === 'expert'
  const avecTerminal = usage === 'terminal' || usage === 'ide'
  if (avecTerminal) return aguerri ? 'dev' : 'complet'
  return aguerri ? 'revue' : 'sobre'
}

/**
 * La place du terminal, dictée par la façon dont Claude Code est lancé.
 *
 * Appliquée *après* le template : un template range les onglets, mais c'est
 * l'usage réel qui sait si une session tourne à côté et où elle doit tenir.
 */
export function terminalPourUsage(usage: Usage): { visible: boolean; disposition?: string } {
  if (usage === 'terminal') return { visible: true, disposition: 'side' }
  if (usage === 'ide') return { visible: true, disposition: 'bottom' }
  return { visible: false }
}

/**
 * La commande proposée par défaut à l'ouverture d'un projet neuf.
 *
 * `/project-setup` sert à qui découvre ; un expert a ses propres habitudes et
 * n'a pas à voir une commande qu'il n'a pas demandée.
 */
export const BOOTSTRAP_DEFAUT = ['/project-setup']

/** Le réglage de démarrage suggéré pour un niveau. */
export const bootstrapPourNiveau = (niveau: Niveau): boolean =>
  niveau === 'debutant' || niveau === 'intermediaire'

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
    : profilSuggere(reponses.niveau, reponses.usage)
  const profil = PROFILS.find(p => p.id === id) ?? PROFILS[0]

  const applique = appliquerProfil(settings, profil)

  return {
    ...applique,
    terminal: { ...applique.terminal, ...terminalPourUsage(reponses.usage) },
    bootstrap: reponses.bootstrap ? BOOTSTRAP_DEFAUT : [],
    claude: { niveau: reponses.niveau, usage: reponses.usage },
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
  const niveau = (NIVEAUX as string[]).includes(settings.claude?.niveau ?? '')
    ? (settings.claude?.niveau as Niveau)
    : 'intermediaire'
  const usage = (USAGES as string[]).includes(settings.claude?.usage ?? '')
    ? (settings.claude?.usage as Usage)
    : 'terminal'
  return {
    niveau,
    usage,
    profil: profilSuggere(niveau, usage),
    bootstrap: bootstrapPourNiveau(niveau),
  }
}
