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
 * Projets connus, le dépôt courant en tête.
 *
 * Le préfixage n'a lieu que si `cwd` porte vraiment un `cockpit/` : au dev
 * server lancé depuis le dépôt, cela évite un cockpit vide au premier
 * lancement ; dans l'application empaquetée, il n'y a pas de dépôt courant et
 * la liste vient alors uniquement du registre. Ajouter le dossier de
 * lancement d'une application de bureau à la liste des projets n'aurait aucun
 * sens.
 *
 * @param {string|null} [cwd]
 */
export function projects(cwd = process.cwd()) {
  const listed = Array.isArray(readJson(REGISTRY)) ? readJson(REGISTRY) : []
  const known = listed.filter(p => p?.path)

  if (!cwd || !existsSync(join(cwd, 'cockpit'))) return known

  const here = { path: cwd, name: basename(cwd) }
  return [here, ...known.filter(p => p.path !== here.path)]
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
