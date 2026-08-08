/**
 * Les trois routes que lit l'interface, écrites une seule fois.
 *
 * Deux consommateurs aux formes incompatibles : le middleware du dev server
 * Vite, en `(req, res, next)`, et le `protocol.handle` d'Electron, en
 * `Request → Response`. Le cœur est donc une fonction pure qui décide *quoi*
 * répondre ; deux adaptateurs minces s'occupent du *comment*.
 *
 * Sans ce partage, la coquille réimplémenterait la lecture des projets, et
 * deux lectures divergent toujours.
 */

import { createReadStream, readFileSync } from 'node:fs'

import { projects, snapshot, shotPath } from '../hooks/snapshot.js'

/**
 * @param {URL} url
 * @param {string} cwd dépôt courant, pour la liste des projets
 * @returns {{json: unknown} | {file: string} | {status: number, json: unknown} | null}
 *   null quand la route n'est pas à nous : l'appelant passe la main.
 */
export function resolve(url, cwd = process.cwd()) {
  const known = () => projects(cwd)
  const asked = () => known().find(p => p.path === url.searchParams.get('path'))?.path ?? null

  switch (url.pathname) {
    case '/api/projects':
      return { json: known() }

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

/** Adaptateur pour le dev server Vite (connect). */
export function nodeMiddleware(cwd = process.cwd()) {
  return (req, res, next) => {
    const result = resolve(new URL(req.url ?? '/', 'http://localhost'), cwd)
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
export function fetchHandler(url, cwd = process.cwd()) {
  const result = resolve(url, cwd)
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
