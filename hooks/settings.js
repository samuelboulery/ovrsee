/**
 * Préférences globales de l'ovrsee, dans `~/.claude/ovrsee/settings.json`.
 *
 * Module pur : pas d'accès réseau, pas de shell, pas d'état global. C'est le
 * cœur logique dont dépendent les deux hôtes (dev server et Electron) et
 * l'interface.
 *
 * Deux niveaux : global dans `~/.claude/ovrsee/settings.json`, surcharges
 * par `ovrsee.config.json` (versionné git du projet). Les champs personnels
 * (`theme`, `langue`, `densiteActivite`, `onboardingVu`) ne se surchargent pas.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

import { writeFileNoFollow } from './plans.js'

/**
 * Schéma complet des préférences, avec défauts.
 *
 * @type {{
 *   theme: string,
 *   langue: string,
 *   densiteActivite: {granularite: string, fenetre: string},
 *   onglets: {actifs: string[], ordre: string[]},
 *   terminal: {visible: boolean, disposition: string, hauteur: number, largeur: number},
 *   bootstrap: string[],
 *   packageManager: string,
 *   sourceGraphe: string,
 *   customActions: Array<{label: string, text: string}>,
 *   projectActions: Record<string, Array<{label: string, text: string}>>,
 *   onboardingVu: boolean,
 *   gitignoreShots: boolean,
 *   gitignorePlans: boolean,
 * }}
 */
export const DEFAULT_SETTINGS = {
  // `system` et pas `dark` : c'est ce que demande l'issue #64, et la
  // conséquence est assumée — un poste réglé en clair voit l'application
  // changer d'apparence à la mise à jour. Le champ a existé puis a été retiré
  // en T-0200 faute d'un thème clair derrière ; il en a un (T-0227).
  theme: 'system',
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
  // Les mêmes, mais attachées à un projet : `{ '<chemin>': [action, …] }`.
  // Hors du dépôt observé et non surchargeable — un dépôt cloné n'a pas à
  // décider ce qui part dans le terminal (issue #70, même raison que
  // `bootstrap`). Voir `mergeSettings`.
  projectActions: {},
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
 * Une action du terminal est-elle utilisable ?
 *
 * Le saut de ligne est refusé ici et pas seulement à la saisie : une action
 * multiligne est plusieurs commandes envoyées au shell d'un coup, ce qui n'est
 * pas explicite au clic. Même prédicat pour les actions globales et celles
 * d'un projet — les deux finissent dans le même terminal.
 */
function actionValide(action) {
  if (!action || typeof action !== 'object') return false
  if (typeof action.label !== 'string' || !action.label.trim()) return false
  if (typeof action.text !== 'string' || !action.text.trim()) return false
  if (action.text.includes('\n')) return false
  return true
}

/**
 * Validation par champ : chaque champ invalide retombe à son défaut.
 *
 * Pas de validation tout-ou-rien. Un `langue: 42` ne vide pas tout l'objet —
 * c'est le défaut de ce champ uniquement, et les autres restent en place.
 *
 * Une clé inconnue est simplement ignorée : un profil écrit par une version
 * antérieure (`claude`, retiré en T-0201) se lit sans erreur. `theme` a fait
 * ce chemin dans les deux sens — retiré en T-0200, revenu en T-0228.
 *
 * @param {unknown} partial données reçues
 * @param {object} [defaults] schéma de référence
 * @returns {object} version validée
 */
export function validateSettings(partial, defaults = DEFAULT_SETTINGS) {
  const out = structuredClone(defaults)
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return out

  // Champs de premier niveau
  validerEnum(out, 'theme', partial.theme, ['light', 'dark', 'system'])
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
    out.customActions = partial.customActions.filter(actionValide)
  }

  // Objet : projectActions — une liste d'actions par chemin de projet. Une
  // valeur qui n'est pas un tableau est ignorée, comme partout ici : un
  // fichier abîmé sur une clé ne doit pas emporter les autres projets.
  if (partial.projectActions && typeof partial.projectActions === 'object' &&
      !Array.isArray(partial.projectActions)) {
    const parProjet = {}
    for (const [chemin, actions] of Object.entries(partial.projectActions)) {
      if (Array.isArray(actions)) parProjet[chemin] = actions.filter(actionValide)
    }
    out.projectActions = parProjet
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
  // `writeFileNoFollow` plutôt qu'un `writeFileSync` : ce fichier se relit avec
  // un `catch` qui retombe sur les défauts, donc une écriture coupée ne se
  // signale pas — elle se traduit en « l'utilisateur n'avait rien réglé », et
  // l'onboarding rejoue. Le renommage rend l'écriture indivisible.
  writeFileNoFollow(settingsPath(), JSON.stringify(settings, null, 2) + '\n')
}

/**
 * Fusionne le profil global avec les surcharges du projet.
 *
 * Les champs personnels (`theme`, `langue`, `densiteActivite`, `onboardingVu`)
 * ne se surchargent jamais — c'est la préférence de l'utilisateur, pas du
 * projet. Un dépôt cloné n'a pas à décider du thème de qui l'ouvre, pas plus
 * que de sa langue. Un dépôt cloné n'a surtout pas à décider qu'on a déjà vu la
 * présentation. `bootstrap` non plus (issue #70) : envoyé au terminal Claude,
 * un dépôt cloné n'a pas à décider quelle commande s'y exécute.
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

  // `bootstrap` n'est PAS surchargeable : c'est ce que l'utilisateur veut
  // voir tourner dans son terminal, une préférence de poste — pas une
  // propriété du dépôt observé. Le laisser dicter par un dépôt cloné
  // ouvrirait l'exécution de commandes arbitraires côté terminal (issue #70).
  // `customActions` et `projectActions` sont là pour la même raison : les
  // actions d'un projet vivent dans ce fichier-ci, indexées par chemin, jamais
  // dans l'`ovrsee.config.json` du dépôt observé (T-0216).

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
