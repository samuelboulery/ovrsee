/**
 * Les routes que lit l'interface, écrites une seule fois.
 *
 * Deux consommateurs aux formes incompatibles : le middleware du dev server
 * Vite, en `(req, res, next)`, et le `protocol.handle` d'Electron, en
 * `Request → Response`. Le cœur est donc une fonction pure qui décide *quoi*
 * répondre ; deux adaptateurs minces s'occupent du *comment*.
 *
 * Sans ce partage, la coquille réimplémenterait la lecture des projets, et
 * deux lectures divergent toujours. C'est aussi pourquoi l'écriture du registre
 * passe par ici plutôt que par un canal IPC : ajouter ou retirer un projet doit
 * se comporter pareil au dev server et dans l'application empaquetée.
 */

import { createReadStream, existsSync, lstatSync, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { install } from '../hooks/install.js'
import { registerProject, touchProject, unregisterProject } from '../hooks/plans.js'
import { projects, snapshot, shotPath } from '../hooks/snapshot.js'

/**
 * Un dossier réel, désigné par un chemin absolu, qui n'est pas un lien.
 *
 * Le chemin vient du rendu. Il n'ouvre qu'une lecture du `cockpit/` qui s'y
 * trouve — c'est le sens même d'« ouvrir un projet » — mais il n'a aucune raison
 * d'être relatif, de désigner un fichier, ni de passer par un lien symbolique.
 */
const usableDirectory = path =>
  typeof path === 'string' &&
  path.length > 0 &&
  isAbsolute(path) &&
  existsSync(path) &&
  !lstatSync(path).isSymbolicLink() &&
  lstatSync(path).isDirectory()

/**
 * Ajout, retrait, remontée en tête, initialisation.
 *
 * Une seule route pour quatre gestes : ils portent le même argument, rendent la
 * même chose — la liste à jour — et se lisent d'un coup d'œil ici plutôt que
 * dispersés en quatre chemins d'URL.
 *
 * Seul `add` accepte un chemin inconnu. Les trois autres n'agissent que sur un
 * projet déjà enregistré, exactement comme `/api/project` et `/api/shot` : le
 * registre est la liste blanche de ce que cette application touche.
 */
function projectAction(body, cwd) {
  const { action, path } = body ?? {}
  const known = () => projects(cwd).some(p => p.path === path)
  const list = () => ({ json: { projects: projects(cwd) } })

  switch (action) {
    case 'add':
      if (!usableDirectory(path)) return { status: 400, json: { error: 'dossier introuvable' } }
      registerProject(path)
      touchProject(path)
      return list()

    case 'remove':
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
      unregisterProject(path)
      return list()

    case 'touch':
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
      touchProject(path)
      return list()

    case 'init': {
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
      try {
        return { json: { projects: projects(cwd), done: install(path) } }
      } catch (err) {
        // Le cas courant : le dossier n'est pas un dépôt git. Le dire, plutôt
        // que d'installer à moitié un rattachement des commits qui ne peut pas
        // fonctionner.
        return { status: 400, json: { error: String(err.message ?? err) } }
      }
    }

    default:
      return { status: 400, json: { error: 'action inconnue' } }
  }
}

/**
 * @param {URL} url
 * @param {string} cwd dépôt courant, pour la liste des projets
 * @param {{method?: string, headers?: Record<string, string>, body?: unknown}} [request]
 * @returns {{json: unknown} | {file: string} | {status: number, json: unknown} | null}
 *   null quand la route n'est pas à nous : l'appelant passe la main.
 */
export function resolve(url, cwd = process.cwd(), request = {}) {
  const { method = 'GET', headers = {}, body = null } = request
  const known = () => projects(cwd)
  const asked = () => known().find(p => p.path === url.searchParams.get('path'))?.path ?? null

  switch (url.pathname) {
    case '/api/projects':
      if (method !== 'POST') return { json: known() }

      // Au dev server, n'importe quelle page ouverte dans le navigateur peut
      // poster vers localhost. Un en-tête personnalisé impose un préflight
      // CORS, que le rendu du cockpit passe et qu'un formulaire distant non.
      if (headers['x-cockpit'] !== '1') {
        return { status: 403, json: { error: 'en-tête X-Cockpit manquant' } }
      }
      return projectAction(body, cwd)

    case '/api/project': {
      const root = asked()
      // On ne lit que des projets enregistrés : un chemin arbitraire dans la
      // barre d'adresse ne doit pas devenir une lecture de disque arbitraire.
      return root ? { json: snapshot(root) } : { status: 404, json: { error: 'projet inconnu' } }
    }

    case '/api/shot': {
      const root = asked()
      const file = root ? shotPath(root, url.searchParams.get('file') ?? '') : null
      return file ? { file } : { status: 404, json: { error: 'capture introuvable' } }
    }

    default:
      return null
  }
}

/** Corps JSON, ou null. Un corps illisible n'est pas une panne : c'est un refus. */
const parseBody = text => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Lit le corps d'une requête node avant de décider. */
const readBody = req =>
  new Promise(resolve => {
    let text = ''
    req.on('data', chunk => (text += chunk))
    req.on('end', () => resolve(parseBody(text)))
  })

/** Adaptateur pour le dev server Vite (connect). */
export function nodeMiddleware(cwd = process.cwd()) {
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const method = req.method ?? 'GET'
    const body = method === 'POST' ? await readBody(req) : null

    const result = resolve(url, cwd, { method, headers: req.headers, body })
    if (!result) return next()

    if ('file' in result) {
      res.setHeader('Content-Type', 'image/png')
      return createReadStream(result.file).pipe(res)
    }

    res.statusCode = result.status ?? 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.json))
  }
}

/** Adaptateur pour `protocol.handle` d'Electron. Rend null si hors périmètre. */
export async function fetchHandler(url, cwd = process.cwd(), request = null) {
  const method = request?.method ?? 'GET'
  const body = method === 'POST' ? parseBody(await request.text()) : null

  const result = resolve(url, cwd, {
    method,
    headers: Object.fromEntries(request?.headers ?? []),
    body,
  })
  if (!result) return null

  if ('file' in result) {
    return new Response(readFileSync(result.file), {
      headers: { 'Content-Type': 'image/png' },
    })
  }

  return new Response(JSON.stringify(result.json), {
    status: result.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
