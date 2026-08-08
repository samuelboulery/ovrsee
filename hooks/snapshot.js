/**
 * Lecture d'un projet : ce que l'interface a besoin de savoir, en une fois.
 *
 * Module Node pur — aucun import Vite, aucun import Electron. C'est la
 * frontière qui rend la coquille remplaçable : le dev server et l'application
 * empaquetée lisent le même code, donc ne peuvent pas diverger sur le calcul
 * du backlog ou sur la fraîcheur d'un scan.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, normalize } from 'node:path'

import { readPlans, readRegistry } from './plans.js'

const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Projets connus, du dernier ouvert au plus ancien.
 *
 * L'ordre est celui de l'usage, pas celui de l'insertion : on retourne à un
 * projet bien plus souvent qu'on n'en ajoute, et le chercher en bas d'une liste
 * qui s'allonge est du travail pour rien. Une entrée sans `lastOpened` vient
 * d'un registre écrit avant cette date — elle passe en fin de liste, dans son
 * ordre d'origine, plutôt que de prétendre à une fraîcheur qu'on ne connaît pas.
 *
 * Le dépôt courant est ajouté en tête s'il porte un `cockpit/` sans être
 * enregistré : au dev server lancé depuis le dépôt, cela évite un cockpit vide
 * au premier lancement. S'il est enregistré, c'est l'usage qui le classe.
 * Dans l'application empaquetée, il n'y a pas de dépôt courant et la liste vient
 * entièrement du registre.
 *
 * @param {string|null} [cwd]
 */
export function projects(cwd = process.cwd()) {
  const known = readRegistry()

  // Tri stable : `sort` l'est en JavaScript moderne, donc deux entrées sans
  // date gardent leur ordre d'écriture.
  const ordered = [...known].sort((a, b) => (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''))

  if (!cwd || !existsSync(join(cwd, 'cockpit'))) return ordered
  if (ordered.some(p => p.path === cwd)) return ordered

  return [{ path: cwd, name: basename(cwd) }, ...ordered]
}

/** Captures successives par page, de la plus récente à la plus ancienne. */
export function shotsByPage(root) {
  const base = join(root, 'cockpit', 'pages', 'shots')
  const out = {}
  try {
    for (const slug of readdirSync(base)) {
      const files = readdirSync(join(base, slug))
        .filter(f => f.endsWith('.png'))
        .sort()
        .reverse()
      if (files.length > 0) out[slug] = files
    }
  } catch {
    // Aucun crawl n'a encore tourné sur ce projet.
  }
  return out
}

/** Traces de scan, une par ligne. Les échecs comptent autant que les succès. */
function scans(root) {
  try {
    return readFileSync(join(root, 'cockpit', 'pages', 'scans.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

/** Tout ce que l'interface doit lire pour un projet, en une réponse. */
export function snapshot(root) {
  return {
    root,
    // Un fait, pas une déduction : un `cockpit/` vide et un `cockpit/` absent
    // se ressemblent une fois les plans lus, et l'interface ne doit pas
    // proposer d'initialiser ce qui l'est déjà.
    equipped: existsSync(join(root, 'cockpit')),
    plans: readPlans(join(root, 'cockpit')).map(p => ({ file: p.file, ...p.meta, body: p.body })),
    packageJson: readJson(join(root, 'package.json')),
    pages: readJson(join(root, 'cockpit', 'pages', 'pages.json')),
    scans: scans(root),
    graph: readJson(join(root, 'graphify-out', 'graph.json')),
    shots: shotsByPage(root),
  }
}

/**
 * Chemin absolu d'une capture, ou null.
 *
 * Sécurité : `relative` vient de la barre d'adresse. Il ne doit pas permettre
 * de sortir du dossier des captures — et ce contrôle vaut d'autant plus qu'il
 * servira aussi dans l'application empaquetée.
 */
export function shotPath(root, relative) {
  const base = join(root, 'cockpit', 'pages')
  const file = normalize(join(base, relative ?? ''))

  if (!file.startsWith(base) || !existsSync(file)) return null
  return file
}
