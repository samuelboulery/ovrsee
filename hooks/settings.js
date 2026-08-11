/**
 * Préférences globales de l'ovrsee, dans `~/.claude/ovrsee/settings.json`.
 *
 * Module pur : pas d'accès réseau, pas de shell, pas d'état global. C'est le
 * cœur logique dont dépendent les deux hôtes (dev server et Electron) et
 * l'interface.
 *
 * Deux niveaux : global dans `~/.claude/ovrsee/settings.json`, surcharges
 * par `ovrsee.config.json` (versionné git du projet). Les champs personnels
 * (`langue`, `theme`, `densiteActivite`, `onboardingVu`, `claude`) ne se
 * surchargent pas.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

/**
 * Schéma complet des préférences, avec défauts.
 *
 * @type {{
 *   langue: string,
 *   theme: string,
 *   densiteActivite: {granularite: string, fenetre: string},
 *   onglets: {actifs: string[], ordre: string[]},
 *   terminal: {visible: boolean, disposition: string, hauteur: number, largeur: number},
 *   bootstrap: string[],
 *   packageManager: string,
 *   sourceGraphe: string,
 *   customActions: Array<{label: string, text: string}>,
 *   onboardingVu: boolean,
 *   claude: {niveau: string, usage: string},
 *   gitignoreShots: boolean,
 *   gitignorePlans: boolean,
 * }}
 */
export const DEFAULT_SETTINGS = {
  langue: 'fr',
  theme: 'auto',
  densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
  onglets: {
    actifs: ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'],
    ordre: ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'],
  },
  terminal: {
    visible: true,
    disposition: 'bottom',
    // Coupé pour de bon quand l'accueil détecte un usage sans terminal — pas
    // seulement replié. Voir `app/src/profilage.ts:terminalPourUsage()`.
    disabled: false,
    hauteur: 244,
    largeur: 468,
  },
  bootstrap: ['/project-setup'],
  packageManager: 'pnpm',
  sourceGraphe: 'auto',
  customActions: [],
  // Faux tant que la présentation de premier lancement n'a pas été vue — ou
  // passée, ce qui compte pour vue : un accueil qui rejoue est un accueil qui
  // ment. Le défaut est le bon même sur un fichier abîmé : mieux vaut une
  // présentation de trop qu'un premier lancement muet.
  onboardingVu: false,
  // `usage` vient de l'accueil et s'y met à jour. `niveau` n'est plus posé par
  // l'accueil (la galerie de profils remplace la question) — le champ reste
  // pour compatibilité mais retombe toujours sur son défaut.
  claude: { niveau: 'intermediaire', usage: 'terminal' },
  // Alignés sur l'état constaté du dépôt ovrsee lui-même au moment d'écrire
  // ce réglage : captures ignorées, plans/tickets versionnés.
  gitignoreShots: true,
  gitignorePlans: false,
}

/** Les valeurs admises pour `claude.niveau`, du plus neuf au plus aguerri. */
export const NIVEAUX_CLAUDE = ['debutant', 'intermediaire', 'avance', 'expert']

/** Les valeurs admises pour `claude.usage` — par quoi Claude Code est lancé. */
export const USAGES_CLAUDE = ['terminal', 'ide', 'desktop', 'autre']

/**
 * Chemin du fichier de préférences globales.
 *
 * `OVRSEE_SETTINGS` env var pour les tests : ils écrivent réellement dans le
 * fichier, et un test qui lisait dans le profil live de l'utilisateur serait
 * un test qui casse l'outil qu'il vérifie.
 */
export const settingsPath = () =>
  process.env.OVRSEE_SETTINGS ?? join(homedir(), '.claude', 'ovrsee', 'settings.json')

/**
 * Lit le profil global, fusionne avec les défauts. Un fichier corrompu ou
 * absent rend le défaut complet, jamais une exception — un profil cassé ne
 * doit pas emporter le fonctionnement de l'app.
 *
 * @returns {object} préférences fusionnées
 */
export function readSettings() {
  try {
    const raw = readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return validateSettings(parsed)
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

/**
 * Validation par champ : chaque champ invalide retombe à son défaut.
 *
 * Pas de validation tout-ou-rien. Un `theme: 42` ne vide pas tout l'objet —
 * c'est le défaut de ce champ uniquement, et les autres restent en place.
 *
 * @param {unknown} partial données reçues
 * @param {object} [defaults] schéma de référence
 * @returns {object} version validée
 */
export function validateSettings(partial, defaults = DEFAULT_SETTINGS) {
  const out = structuredClone(defaults)
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return out

  // Champs de premier niveau
  if (typeof partial.langue === 'string' && ['fr', 'en'].includes(partial.langue)) {
    out.langue = partial.langue
  }
  if (typeof partial.theme === 'string' && ['light', 'dark', 'auto'].includes(partial.theme)) {
    out.theme = partial.theme
  }
  if (typeof partial.packageManager === 'string' && ['pnpm', 'npm', 'yarn', 'bun'].includes(partial.packageManager)) {
    out.packageManager = partial.packageManager
  }
  if (
    typeof partial.sourceGraphe === 'string' &&
    ['auto', 'graphify', 'obsidian'].includes(partial.sourceGraphe)
  ) {
    out.sourceGraphe = partial.sourceGraphe
  }

  // Objet imbriqué : densiteActivite
  if (partial.densiteActivite && typeof partial.densiteActivite === 'object') {
    const { granularite, fenetre } = partial.densiteActivite
    if (['jour', 'semaine', 'mois'].includes(granularite)) {
      out.densiteActivite.granularite = granularite
    }
    if (['jour', 'semaine', 'mois', '3mois', 'an'].includes(fenetre)) {
      out.densiteActivite.fenetre = fenetre
    }
  }

  // Objet imbriqué : onglets
  if (partial.onglets && typeof partial.onglets === 'object') {
    if (Array.isArray(partial.onglets.actifs)) {
      const valides = partial.onglets.actifs.filter(
        t => typeof t === 'string' && defaults.onglets.ordre.includes(t),
      )
      if (valides.length > 0) {
        out.onglets.actifs = valides
      }
    }
    if (Array.isArray(partial.onglets.ordre)) {
      const valides = partial.onglets.ordre.filter(
        t => typeof t === 'string' && defaults.onglets.ordre.includes(t),
      )
      if (valides.length === defaults.onglets.ordre.length) {
        out.onglets.ordre = valides
      }
    }
  }

  // Objet imbriqué : terminal
  if (partial.terminal && typeof partial.terminal === 'object') {
    if (typeof partial.terminal.visible === 'boolean') {
      out.terminal.visible = partial.terminal.visible
    }
    if (typeof partial.terminal.disabled === 'boolean') {
      out.terminal.disabled = partial.terminal.disabled
    }
    if (['bottom', 'side', 'full'].includes(partial.terminal.disposition)) {
      out.terminal.disposition = partial.terminal.disposition
    }
    if (typeof partial.terminal.hauteur === 'number' && partial.terminal.hauteur > 0) {
      out.terminal.hauteur = partial.terminal.hauteur
    }
    if (typeof partial.terminal.largeur === 'number' && partial.terminal.largeur > 0) {
      out.terminal.largeur = partial.terminal.largeur
    }
  }

  // Tableau : bootstrap
  if (Array.isArray(partial.bootstrap)) {
    if (partial.bootstrap.every(x => typeof x === 'string')) {
      out.bootstrap = partial.bootstrap
    }
  }

  // Tableau : customActions — chaque action validée individuellement
  if (Array.isArray(partial.customActions)) {
    const valides = partial.customActions.filter(action => {
      if (!action || typeof action !== 'object') return false
      if (typeof action.label !== 'string' || !action.label.trim()) return false
      if (typeof action.text !== 'string' || !action.text.trim()) return false
      // Rejette les actions avec sauts de ligne
      if (action.text.includes('\n')) return false
      return true
    })
    out.customActions = valides
  }

  if (typeof partial.onboardingVu === 'boolean') {
    out.onboardingVu = partial.onboardingVu
  }

  if (typeof partial.gitignoreShots === 'boolean') {
    out.gitignoreShots = partial.gitignoreShots
  }
  if (typeof partial.gitignorePlans === 'boolean') {
    out.gitignorePlans = partial.gitignorePlans
  }

  // Objet imbriqué : claude
  if (partial.claude && typeof partial.claude === 'object') {
    const { niveau, usage } = partial.claude
    if (NIVEAUX_CLAUDE.includes(niveau)) {
      out.claude.niveau = niveau
    }
    if (USAGES_CLAUDE.includes(usage)) {
      out.claude.usage = usage
    }
  }

  return out
}

/**
 * Écrit le profil global.
 *
 * @param {object} settings préférences à écrire
 */
export function writeSettings(settings) {
  const dir = join(settingsPath(), '..')
  mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2) + '\n', 'utf8')
}

/**
 * Fusionne le profil global avec les surcharges du projet.
 *
 * Les champs personnels (`langue`, `theme`, `densiteActivite`, `onboardingVu`,
 * `claude`) ne se surchargent jamais — c'est la préférence de l'utilisateur,
 * pas du projet. Un dépôt cloné n'a surtout pas à décider qu'on a déjà vu la
 * présentation.
 *
 * @param {object} global profil utilisateur
 * @param {object} project surcharges du projet (ovrsee.config.json)
 * @returns {object} fusionné
 */
export function mergeSettings(global, project = {}) {
  const out = structuredClone(global)
  if (!project || typeof project !== 'object' || Array.isArray(project)) return out

  // Champs surchargeables, validés comme dans validateSettings
  if (typeof project.onglets === 'object') {
    if (Array.isArray(project.onglets.actifs)) {
      const valides = project.onglets.actifs.filter(
        t => typeof t === 'string' && DEFAULT_SETTINGS.onglets.ordre.includes(t),
      )
      if (valides.length > 0) {
        out.onglets.actifs = valides
      }
    }
    if (Array.isArray(project.onglets.ordre)) {
      const valides = project.onglets.ordre.filter(
        t => typeof t === 'string' && DEFAULT_SETTINGS.onglets.ordre.includes(t),
      )
      if (valides.length === DEFAULT_SETTINGS.onglets.ordre.length) {
        out.onglets.ordre = valides
      }
    }
  }

  if (typeof project.terminal === 'object') {
    if (typeof project.terminal.visible === 'boolean') {
      out.terminal.visible = project.terminal.visible
    }
    if (['bottom', 'side', 'full'].includes(project.terminal.disposition)) {
      out.terminal.disposition = project.terminal.disposition
    }
    if (typeof project.terminal.hauteur === 'number' && project.terminal.hauteur > 0) {
      out.terminal.hauteur = project.terminal.hauteur
    }
    if (typeof project.terminal.largeur === 'number' && project.terminal.largeur > 0) {
      out.terminal.largeur = project.terminal.largeur
    }
  }

  if (Array.isArray(project.bootstrap)) {
    if (project.bootstrap.every(x => typeof x === 'string')) {
      out.bootstrap = project.bootstrap
    }
  }

  if (typeof project.packageManager === 'string' && ['pnpm', 'npm', 'yarn', 'bun'].includes(project.packageManager)) {
    out.packageManager = project.packageManager
  }

  if (typeof project.sourceGraphe === 'string' && ['auto', 'graphify', 'obsidian'].includes(project.sourceGraphe)) {
    out.sourceGraphe = project.sourceGraphe
  }

  if (typeof project.gitignoreShots === 'boolean') {
    out.gitignoreShots = project.gitignoreShots
  }
  if (typeof project.gitignorePlans === 'boolean') {
    out.gitignorePlans = project.gitignorePlans
  }

  return out
}
