/**
 * Préférences globales de l'ovrsee, dans `~/.claude/ovrsee/settings.json`.
 *
 * Module pur : pas d'accès réseau, pas de shell, pas d'état global. C'est le
 * cœur logique dont dépendent les deux hôtes (dev server et Electron) et
 * l'interface.
 *
 * Deux niveaux : global dans `~/.claude/ovrsee/settings.json`, surcharges
 * par `ovrsee.config.json` (versionné git du projet). Les champs personnels
 * (`langue`, `densiteActivite`, `onboardingVu`) ne se surchargent pas.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

/**
 * Schéma complet des préférences, avec défauts.
 *
 * @type {{
 *   langue: string,
 *   densiteActivite: {granularite: string, fenetre: string},
 *   onglets: {actifs: string[], ordre: string[]},
 *   terminal: {visible: boolean, disposition: string, hauteur: number, largeur: number},
 *   bootstrap: string[],
 *   packageManager: string,
 *   sourceGraphe: string,
 *   customActions: Array<{label: string, text: string}>,
 *   onboardingVu: boolean,
 *   gitignoreShots: boolean,
 *   gitignorePlans: boolean,
 * }}
 */
export const DEFAULT_SETTINGS = {
  langue: 'fr',
  densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
  onglets: {
    actifs: ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'],
    ordre: ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack'],
  },
  terminal: {
    visible: true,
    disposition: 'bottom',
    // Coupé pour de bon quand le profil choisi à l'accueil n'a pas de
    // terminal — pas seulement replié. Voir `app/src/PreferencesProfils.tsx`.
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
  // Alignés sur l'état constaté du dépôt ovrsee lui-même au moment d'écrire
  // ce réglage : captures ignorées, plans/tickets versionnés.
  gitignoreShots: true,
  gitignorePlans: false,
}

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
 * Pose `out[cle]` si `valeur` est une chaîne admise par `options`. Motif
 * répété pour chaque champ à énumération fermée (langue, disposition…).
 */
function validerEnum(out, cle, valeur, options) {
  if (typeof valeur === 'string' && options.includes(valeur)) out[cle] = valeur
}

/** Valide `input.actifs`/`input.ordre` contre `ordreDefaut`, écrit dans `out`. */
function validerOnglets(input, out, ordreDefaut) {
  if (!input || typeof input !== 'object') return
  if (Array.isArray(input.actifs)) {
    const valides = input.actifs.filter(t => typeof t === 'string' && ordreDefaut.includes(t))
    if (valides.length > 0) out.actifs = valides
  }
  if (Array.isArray(input.ordre)) {
    const valides = input.ordre.filter(t => typeof t === 'string' && ordreDefaut.includes(t))
    if (valides.length === ordreDefaut.length) out.ordre = valides
  }
}

/**
 * Valide les champs communs de `input` (terminal) et écrit dans `out`.
 * `disabled` n'en fait pas partie : seul `validateSettings` le pose, un
 * projet ne doit pas pouvoir désactiver le terminal de l'utilisateur.
 */
function validerTerminal(input, out) {
  if (!input || typeof input !== 'object') return
  if (typeof input.visible === 'boolean') out.visible = input.visible
  validerEnum(out, 'disposition', input.disposition, ['bottom', 'side', 'full'])
  if (typeof input.hauteur === 'number' && input.hauteur > 0) out.hauteur = input.hauteur
  if (typeof input.largeur === 'number' && input.largeur > 0) out.largeur = input.largeur
}

/**
 * Validation par champ : chaque champ invalide retombe à son défaut.
 *
 * Pas de validation tout-ou-rien. Un `langue: 42` ne vide pas tout l'objet —
 * c'est le défaut de ce champ uniquement, et les autres restent en place.
 *
 * Une clé inconnue est simplement ignorée : un profil écrit par une version
 * antérieure (`theme`, `claude`, retirés en T-0200/T-0201) se lit sans erreur.
 *
 * @param {unknown} partial données reçues
 * @param {object} [defaults] schéma de référence
 * @returns {object} version validée
 */
export function validateSettings(partial, defaults = DEFAULT_SETTINGS) {
  const out = structuredClone(defaults)
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return out

  // Champs de premier niveau
  validerEnum(out, 'langue', partial.langue, ['fr', 'en'])
  validerEnum(out, 'packageManager', partial.packageManager, ['pnpm', 'npm', 'yarn', 'bun'])
  validerEnum(out, 'sourceGraphe', partial.sourceGraphe, ['auto', 'graphify', 'obsidian'])

  // Objet imbriqué : densiteActivite
  if (partial.densiteActivite && typeof partial.densiteActivite === 'object') {
    const { granularite, fenetre } = partial.densiteActivite
    validerEnum(out.densiteActivite, 'granularite', granularite, ['jour', 'semaine', 'mois'])
    validerEnum(out.densiteActivite, 'fenetre', fenetre, ['jour', 'semaine', 'mois', '3mois', 'an'])
  }

  // Objet imbriqué : onglets
  validerOnglets(partial.onglets, out.onglets, defaults.onglets.ordre)

  // Objet imbriqué : terminal
  validerTerminal(partial.terminal, out.terminal)
  if (partial.terminal && typeof partial.terminal.disabled === 'boolean') {
    out.terminal.disabled = partial.terminal.disabled
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
 * Les champs personnels (`langue`, `densiteActivite`, `onboardingVu`) ne se
 * surchargent jamais — c'est la préférence de l'utilisateur, pas du projet. Un dépôt cloné n'a surtout pas à décider qu'on a déjà vu la
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
  validerOnglets(project.onglets, out.onglets, DEFAULT_SETTINGS.onglets.ordre)
  validerTerminal(project.terminal, out.terminal)

  if (Array.isArray(project.bootstrap)) {
    if (project.bootstrap.every(x => typeof x === 'string')) {
      out.bootstrap = project.bootstrap
    }
  }

  validerEnum(out, 'packageManager', project.packageManager, ['pnpm', 'npm', 'yarn', 'bun'])
  validerEnum(out, 'sourceGraphe', project.sourceGraphe, ['auto', 'graphify', 'obsidian'])

  if (typeof project.gitignoreShots === 'boolean') {
    out.gitignoreShots = project.gitignoreShots
  }
  if (typeof project.gitignorePlans === 'boolean') {
    out.gitignorePlans = project.gitignorePlans
  }

  return out
}
