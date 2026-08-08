/**
 * Lecture d'un projet : ce que l'interface a besoin de savoir, en une fois.
 *
 * Module Node pur — aucun import Vite, aucun import Electron. C'est la
 * frontière qui rend la coquille remplaçable : le dev server et l'application
 * empaquetée lisent le même code, donc ne peuvent pas diverger sur le calcul
 * du backlog ou sur la fraîcheur d'un scan.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, normalize } from 'node:path'

import { readPlans } from './plans.js'

const REGISTRY = join(homedir(), '.claude', 'cockpit', 'projects.json')

const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Projets connus. Le dépôt courant vient toujours en tête, même s'il n'a
 * jamais été enregistré : on ne veut pas d'un cockpit vide au premier
 * lancement.
 *
 * @param {string} [cwd] dépôt courant
 */
export function projects(cwd = process.cwd()) {
  const listed = Array.isArray(readJson(REGISTRY)) ? readJson(REGISTRY) : []
  const here = { path: cwd, name: basename(cwd) }

  return [here, ...listed.filter(p => p?.path && p.path !== here.path)]
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
