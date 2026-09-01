/**
 * Le catalogue des skills Claude Code que l'ovrsee sait proposer.
 *
 * Un skill est un fichier `SKILL.md` dans `~/.claude/skills/<nom>/`. Claude Code
 * le lit à la demande : tant qu'il n'est pas là, un projet équipé reste un
 * dossier `ovrsee/` que personne ne sait remplir.
 *
 * Deux natures d'entrées, et la distinction n'est pas cosmétique :
 *
 * - `bundled` — le fichier est dans ce dépôt, sous `skills/<nom>/SKILL.md`. Le
 *   ovrsee l'écrit lui-même : rien à télécharger, rien à exécuter.
 * - `externe` — le skill appartient à quelqu'un d'autre (Graphify). On **détecte
 *   sa présence, on ne l'installe jamais**. Installer un paquet tiers depuis une
 *   interface graphique, c'est lancer du code arbitraire à la place de
 *   l'utilisateur sans qu'il voie ce qui se passe. On affiche la commande ; il
 *   la lance s'il le veut.
 *
 * Le catalogue est une constante et non un registre distant : il n'y a pas de
 * mise à jour hors d'une mise à jour de l'ovrsee, donc pas de réseau à gérer, et
 * surtout la liste des noms écrivables est fixée à la compilation.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeFileNoFollow } from './plans.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Où les skills s'installent.
 *
 * `OVRSEE_SKILLS_DIR` existe pour les tests, comme `OVRSEE_REGISTRY` pour le
 * registre : un test qui écrit dans les skills de la machine casserait l'outil
 * qu'il vérifie.
 */
export const skillsDir = () =>
  process.env.OVRSEE_SKILLS_DIR ?? join(homedir(), '.claude', 'skills')

export const CATALOGUE = [
  {
    nom: 'ovrsee',
    source: 'bundled',
    titre: 'Ovrsee — lire le projet',
    resume: "Plans, pages, scans : ce qu'il faut lire, et dans quel ordre, sans ouvrir le code.",
  },
  {
    nom: 'ovrsee-tickets',
    source: 'bundled',
    titre: 'Ovrsee — ticketing',
    resume: 'Créer et déplacer les tickets du Tableau depuis la conversation.',
  },
  {
    nom: 'graphify',
    source: 'externe',
    titre: 'Graphify — graphe du code',
    resume: "Alimente l'onglet Données et la section graphe du coffre Obsidian.",
    commande: 'pip install graphifyy',
    url: 'https://pypi.org/project/graphifyy/',
  },
]

const entree = nom => CATALOGUE.find(s => s.nom === nom)

/**
 * Le `SKILL.md` livré dans ce dépôt, pour un nom du catalogue.
 *
 * Sécurité : le nom n'est jamais concaténé tel quel. Il doit d'abord figurer au
 * catalogue en `bundled` — la liste blanche rend la traversée de chemin
 * impossible, puisque aucun segment ne vient de l'appelant.
 *
 * @throws si le nom n'est pas un skill livré
 */
export function bundledPath(nom) {
  const skill = entree(nom)
  if (skill?.source !== 'bundled') throw new Error(`skill inconnu : ${nom}`)
  return join(HERE, '..', 'skills', skill.nom, 'SKILL.md')
}

/** Le chemin d'installation d'un skill. Même liste blanche. */
const installedPath = nom => join(skillsDir(), nom, 'SKILL.md')

/** Du texte, pas du JSON : `readJson` de `json.js` ne s'applique pas ici. */
const lire = path => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * L'état de chaque skill du catalogue.
 *
 * `aJour` ne vaut que pour les skills livrés : c'est la comparaison au fichier
 * du dépôt, et c'est elle qui permet de proposer une réinstallation après une
 * mise à jour de l'ovrsee. Un skill externe n'a pas de version de référence — on
 * sait seulement s'il est là.
 *
 * @returns {Array<{nom: string, source: string, titre: string, resume: string,
 *   commande?: string, url?: string, installe: boolean, aJour: boolean}>}
 */
export function readSkills() {
  return CATALOGUE.map(skill => {
    const installe = lire(installedPath(skill.nom))
    if (skill.source !== 'bundled') {
      return { ...skill, installe: installe !== null, aJour: installe !== null }
    }
    const livre = lire(bundledPath(skill.nom))
    return {
      ...skill,
      installe: installe !== null,
      aJour: installe !== null && livre !== null && installe === livre,
    }
  })
}

/**
 * Écrit les skills demandés dans `~/.claude/skills/`.
 *
 * Rend la liste de ce qui a été fait, ligne par ligne — même forme de retour que
 * `install()`, que l'interface sait déjà afficher.
 *
 * Un nom hors catalogue, ou un skill externe, ne produit pas une erreur fatale :
 * la ligne le dit et l'installation continue. Refuser tout le lot parce qu'un
 * nom est douteux ferait perdre les skills légitimes du même appel.
 *
 * @param {string[]} noms
 * @returns {string[]}
 */
export function installSkills(noms) {
  const done = []

  for (const nom of noms ?? []) {
    const skill = entree(nom)

    if (!skill) {
      done.push(`${nom} : inconnu du catalogue — ignoré.`)
      continue
    }
    if (skill.source !== 'bundled') {
      done.push(`${nom} : skill externe — à installer vous-même (${skill.commande}).`)
      continue
    }

    const contenu = lire(bundledPath(nom))
    if (contenu === null) {
      done.push(`${nom} : introuvable dans cette version de l'ovrsee — ignoré.`)
      continue
    }

    const cible = installedPath(nom)
    const avant = lire(cible)
    writeFileNoFollow(cible, contenu)
    done.push(avant === null ? `Skill ${nom} installé (${cible})` : `Skill ${nom} mis à jour`)
  }

  return done
}
