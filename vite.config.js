import { existsSync, readFileSync, readdirSync, createReadStream } from 'node:fs'
import { homedir } from 'node:os'
import { join, normalize } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { readPlans } from './hooks/plans.js'

const REGISTRY = join(homedir(), '.claude', 'cockpit', 'projects.json')

const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const projects = () => {
  const listed = readJson(REGISTRY) ?? []
  // Le dépôt courant figure toujours en tête, même s'il n'a jamais été
  // enregistré : on ne veut pas d'un cockpit vide au premier lancement.
  const here = { path: process.cwd(), name: 'cockpit' }
  return [here, ...listed.filter(p => p?.path && p.path !== here.path)]
}

/** Tout ce que l'interface doit lire pour un projet, en une réponse. */
const snapshot = root => ({
  root,
  plans: readPlans(join(root, 'cockpit')).map(p => ({ file: p.file, ...p.meta, body: p.body })),
  packageJson: readJson(join(root, 'package.json')),
  pages: readJson(join(root, 'cockpit', 'pages', 'pages.json')),
  scans: (() => {
    try {
      return readFileSync(join(root, 'cockpit', 'pages', 'scans.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    } catch {
      return []
    }
  })(),
  graph: readJson(join(root, 'graphify-out', 'graph.json')),
  // Captures successives par page. C'est l'historique d'un écran : une image
  // datée est honnête là où une phrase peut mentir sans prévenir.
  shots: shotsByPage(root),
})

function shotsByPage(root) {
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
    // Aucun crawl n'a encore tourné.
  }
  return out
}

/**
 * Sert les données du cockpit au dev server. Pas de backend : le cockpit lit
 * des fichiers, il n'a rien à exécuter ni à stocker.
 */
const cockpitData = () => ({
  name: 'cockpit-data',
  configureServer(server) {
    server.middlewares.use('/api', (req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      const send = body => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }

      if (url.pathname === '/projects') return send(projects())

      if (url.pathname === '/project') {
        const root = projects().find(p => p.path === url.searchParams.get('path'))?.path
        if (!root) {
          res.statusCode = 404
          return send({ error: 'projet inconnu' })
        }
        return send(snapshot(root))
      }

      if (url.pathname === '/shot') {
        const root = projects().find(p => p.path === url.searchParams.get('path'))?.path
        const rel = url.searchParams.get('file') ?? ''
        const base = join(root ?? '', 'cockpit', 'pages')
        const file = normalize(join(base, rel))
        // Le chemin vient de la barre d'adresse : il ne doit pas sortir du
        // dossier des captures.
        if (!root || !file.startsWith(base) || !existsSync(file)) {
          res.statusCode = 404
          return send({ error: 'capture introuvable' })
        }
        res.setHeader('Content-Type', 'image/png')
        return createReadStream(file).pipe(res)
      }

      next()
    })
  },
})

export default defineConfig({
  root: 'app',
  plugins: [react(), cockpitData()],
  server: { port: 5180, strictPort: true },
})
