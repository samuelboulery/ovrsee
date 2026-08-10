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
import { isAbsolute, join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { readConfigClaude } from '../hooks/config-claude.js'
import { install } from '../hooks/install.js'
import { exportVault } from '../hooks/obsidian.js'
import { registerProject, touchProject, unregisterProject } from '../hooks/plans.js'
import { readSettings, writeSettings, validateSettings, mergeSettings } from '../hooks/settings.js'
import { installSkills, readSkills } from '../hooks/skills.js'
import { projects, snapshot, shotPath, mediaPath, tableau, readJson } from '../hooks/snapshot.js'
import {
  addColumn,
  createTicket,
  deleteTicket,
  reorderColumn,
  moveTicket,
  removeColumn,
  renameColumn,
  updateTicket,
} from '../hooks/tickets.js'

/**
 * Un dossier réel, désigné par un chemin absolu, qui n'est pas un lien.
 *
 * Le chemin vient du rendu. Il n'ouvre qu'une lecture du `cockpit/` qui s'y
 * trouve — c'est le sens même d'« ouvrir un projet » — mais il n'a aucune raison
 * d'être relatif, de désigner un fichier, ni de passer par un lien symbolique.
 *
 * Exporté pour le serveur MCP : ses outils reçoivent un chemin par le même
 * chemin de confiance qu'une barre d'adresse, et doivent le refuser pareil.
 */
export const usableDirectory = path =>
  typeof path === 'string' &&
  path.length > 0 &&
  isAbsolute(path) &&
  existsSync(path) &&
  !lstatSync(path).isSymbolicLink() &&
  lstatSync(path).isDirectory()

/**
 * Ce qu'on propose de mettre dans `cockpit.config.json`, pour que le formulaire
 * d'équipement arrive pré-rempli plutôt que vide.
 *
 * ponytail: heuristique volontairement courte — le script `dev` ou `start` du
 * `package.json`, le port que ce script déclare, sinon 3000 pour Next et 5173
 * sinon. Un projet non-JS retombe sur les valeurs par défaut du crawler. Ce sont
 * deux champs de formulaire éditables, pas une détection qui doit avoir raison :
 * la corriger coûte une frappe, la deviner mieux coûterait un analyseur.
 *
 * Le gestionnaire de paquets vient des préférences plutôt que d'une constante —
 * il y est déjà réglé, et proposer `pnpm dev` à quelqu'un qui a choisi `npm`
 * serait une faute qu'on lui ferait corriger à chaque projet.
 */
function detectDefaults(root) {
  const scripts = readJson(join(root, 'package.json'))?.scripts ?? {}
  const nom = ['dev', 'start'].find(cle => typeof scripts[cle] === 'string') ?? 'dev'
  const script = scripts[nom] ?? ''
  const port =
    /(?:--port|-p)[= ](\d{4,5})/.exec(script)?.[1] ?? (/\bnext\b/.test(script) ? '3000' : '5173')

  return {
    dev: `${readSettings().packageManager} ${nom}`,
    baseUrl: `http://localhost:${port}`,
  }
}

/**
 * État détecté d'un dossier : est-ce un dépôt git ? a-t-il un lockfile ?
 * cockpit.config.json ? Est-ce équipé ? Et que proposer au formulaire ?
 */
function getFolderState(root) {
  const hasGit = (() => {
    try {
      execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  const hasLockfile = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb']
    .some(name => existsSync(join(root, name)))

  const hasConfig = existsSync(join(root, 'cockpit.config.json'))

  const defaults = detectDefaults(root)

  try {
    const snap = snapshot(root)
    return {
      isGit: hasGit,
      hasLockfile,
      hasConfig,
      equipped: snap.equipped,
      hasPackageJson: snap.packageJson !== null,
      defaults,
    }
  } catch {
    return {
      isGit: hasGit,
      hasLockfile,
      hasConfig,
      equipped: false,
      hasPackageJson: existsSync(join(root, 'package.json')),
      defaults,
    }
  }
}

/** Distingue « pas de config demandée » de « config demandée, mais fausse ». */
const INVALID = Symbol('config invalide')

/**
 * La configuration de crawl proposée par le formulaire d'équipement.
 *
 * Ce que cette validation vise, et ce qu'elle ne vise pas. `dev` finira dans un
 * `spawn(…, { shell: true })` du crawler : c'est une commande shell, et ça le
 * restera — c'est le sens du champ, exactement comme éditer `cockpit.config.json`
 * à la main. Prétendre l'assainir ici donnerait une fausse assurance. Ce qui
 * tient une page tierce à distance, c'est l'en-tête `X-Cockpit` et le registre
 * comme liste blanche, pas une expression rationnelle sur une ligne de commande.
 *
 * Restent deux refus qui valent la peine : un `baseUrl` qui n'est pas une URL
 * http — le crawler le refuserait de toute façon, mais bien plus tard et bien
 * moins clairement — et une valeur qui n'est pas une chaîne, qui écrirait un
 * JSON absurde qu'on relirait sans comprendre.
 *
 * @returns {{dev: string, baseUrl: string} | null | typeof INVALID}
 */
function validateCrawlConfig(config) {
  if (config === undefined || config === null) return null
  if (typeof config !== 'object' || Array.isArray(config)) return INVALID

  const dev = typeof config.dev === 'string' ? config.dev.trim() : ''
  const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

  if (!dev || dev.length > 300 || /[\r\n]/.test(dev)) return INVALID
  if (baseUrl.length > 300 || !/^https?:\/\/\S+$/.test(baseUrl)) return INVALID

  return { dev, baseUrl }
}

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
function projectAction(body) {
  const { action, path } = body ?? {}
  const known = () => projects().some(p => p.path === path)
  const list = () => ({ json: { projects: projects() } })

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

    case 'export-obsidian': {
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
      try {
        return { json: { projects: projects(), done: exportVault(path) } }
      } catch (err) {
        return { status: 400, json: { error: String(err.message ?? err) } }
      }
    }

    case 'state': {
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
      return { json: getFolderState(path) }
    }

    case 'init': {
      if (!known()) return { status: 404, json: { error: 'projet inconnu' } }

      const config = validateCrawlConfig(body?.config)
      if (config === INVALID) {
        return { status: 400, json: { error: 'config de crawl invalide : dev et baseUrl requis' } }
      }

      try {
        const done = install(path, {
          skills: body?.skills,
          gitInit: body?.gitInit === true,
          commit: body?.commit === true,
          config,
        })

        // L'export s'orchestre ici plutôt que dans `install` : c'est déjà une
        // action de cette route, et l'équipement n'a pas à connaître Obsidian.
        // Après, jamais avant — exporter un coffre d'un `cockpit/` inexistant
        // ne produirait qu'un index vide.
        if (body?.obsidian === true) done.push(...exportVault(path))

        return { json: { projects: projects(), done } }
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
 * Création, déplacement, modification, suppression d'un ticket.
 *
 * Les tickets sont la seule donnée du cockpit que l'interface écrit. Le geste
 * courant est le glisser-déposer, d'où une réponse réduite au tableau : relire
 * tout le projet après chaque déplacement serait payer le graphe et le journal
 * git pour un champ qui change.
 *
 * Les refus de `hooks/tickets.js` — colonne inconnue, titre vide, nom de
 * fichier douteux — remontent en 400 avec leur message. C'est une erreur
 * d'appel, pas une panne du serveur.
 *
 * @param {unknown} body
 * @param {string} root projet déjà vérifié comme présent au registre
 */
function ticketAction(body, root) {
  const { action, file } = body ?? {}
  const cockpitDir = join(root, 'cockpit')
  const list = () => ({ json: tableau(root) })
  const absent = () => ({ status: 404, json: { error: 'ticket introuvable' } })

  try {
    switch (action) {
      case 'create':
        createTicket(cockpitDir, body)
        return list()

      case 'move':
        return moveTicket(cockpitDir, file, body?.colonne) ? list() : absent()

      case 'update':
        return updateTicket(cockpitDir, file, body) ? list() : absent()

      case 'delete':
        return deleteTicket(cockpitDir, file) ? list() : absent()

      // Colonnes. L'identifiant n'est jamais modifiable : il est dérivé du
      // titre à la création et cité par les tickets. Renommer ne touche donc
      // que le titre, et retirer reloge les tickets avant d'écrire le board.
      case 'column-add':
        addColumn(cockpitDir, body)
        return list()

      case 'column-rename':
        renameColumn(cockpitDir, body?.id, body)
        return list()

      case 'column-remove':
        removeColumn(cockpitDir, body?.id, body?.vers)
        return list()

      case 'column-reorder':
        reorderColumn(cockpitDir, body?.id, body?.index)
        return list()

      default:
        return { status: 400, json: { error: 'action inconnue' } }
    }
  } catch (err) {
    return { status: 400, json: { error: String(err.message ?? err) } }
  }
}

/**
 * @param {URL} url
 * @param {string} cwd dépôt courant. Plus lu depuis que `projects()` ne consulte
 *   que le registre ; l'argument reste pour ne pas décaler la position de
 *   `request` chez les trois hôtes.
 * @param {{method?: string, headers?: Record<string, string>, body?: unknown}} [request]
 * @returns {{json: unknown} | {file: string, type?: string} | {status: number, json: unknown} | null}
 *   null quand la route n'est pas à nous : l'appelant passe la main.
 */
export function resolve(url, cwd = process.cwd(), request = {}) {
  const { method = 'GET', headers = {}, body = null } = request
  const known = () => projects()
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
      return projectAction(body)

    // Les skills vivent dans `~/.claude/`, pas dans un projet : c'est la seule
    // route qui ne prend pas de chemin. La liste blanche n'est donc pas le
    // registre des projets mais le catalogue, appliqué dans `installSkills`.
    case '/api/skills': {
      if (method !== 'POST') return { json: readSkills() }
      if (headers['x-cockpit'] !== '1') {
        return { status: 403, json: { error: 'en-tête X-Cockpit manquant' } }
      }
      try {
        return { json: { done: installSkills(body?.noms), skills: readSkills() } }
      } catch (err) {
        return { status: 400, json: { error: String(err.message ?? err) } }
      }
    }

    case '/api/config-claude': {
      // Configuration Claude Code : agents, commands, plugins, hooks, env.
      // Lecture seule, GET uniquement. Masquage des secrets effectué côté serveur.
      if (method !== 'GET') return { status: 405, json: { error: 'méthode non permise' } }
      try {
        return { json: readConfigClaude() }
      } catch (err) {
        return { status: 400, json: { error: String(err.message ?? err) } }
      }
    }

    case '/api/settings': {
      // L'en-tête vérification d'abord pour les écritures
      if (method === 'POST' && headers['x-cockpit'] !== '1') {
        return { status: 403, json: { error: 'en-tête X-Cockpit manquant' } }
      }

      const askedPath = url.searchParams.get('path')

      if (method === 'GET') {
        // Sans projet : rendre le profil global seul (onboarding C1)
        if (!askedPath) return { json: readSettings() }

        // Avec projet : refuser si absent du registre
        const root = projects().find(p => p.path === askedPath)?.path ?? null
        if (!root) return { status: 404, json: { error: 'inconnu' } }

        // Fusionner global + projet — réutilise readJson de snapshot.js
        const projectConfig = readJson(join(root, 'cockpit.config.json')) ?? {}
        return { json: mergeSettings(readSettings(), projectConfig) }
      }

      if (method === 'POST') {
        writeSettings(validateSettings(body, readSettings()))
        return { json: readSettings() }
      }

      return { status: 405, json: { error: 'méthode non permise' } }
    }

    case '/api/tickets': {
      // L'en-tête d'abord : rien de ce qui suit ne doit tourner pour une
      // requête qu'on refuse de toute façon, pas même une lecture du registre.
      if (method === 'POST' && headers['x-cockpit'] !== '1') {
        return { status: 403, json: { error: 'en-tête X-Cockpit manquant' } }
      }

      // Même liste blanche que partout ailleurs : le registre. Un chemin
      // arbitraire ne doit pas devenir une écriture disque arbitraire.
      const asked = url.searchParams.get('path') ?? body?.path
      const root = projects().find(p => p.path === asked)?.path ?? null
      if (!root) return { status: 404, json: { error: 'projet inconnu' } }

      return method === 'POST' ? ticketAction(body, root) : { json: tableau(root) }
    }

    case '/api/project': {
      const root = asked()
      // On ne lit que des projets enregistrés : un chemin arbitraire dans la
      // barre d'adresse ne doit pas devenir une lecture de disque arbitraire.
      return root ? { json: snapshot(root) } : { status: 404, json: { error: 'projet inconnu' } }
    }

    case '/api/shot': {
      const root = asked()
      const file = root ? shotPath(root, url.searchParams.get('file') ?? '') : null
      return file ? { file, type: 'image/png' } : { status: 404, json: { error: 'capture introuvable' } }
    }

    // Les images et vidéos qu'un README cite. Même liste blanche de projets que
    // partout, plus une liste blanche d'extensions dans `mediaPath` : cette
    // route lit à la racine du dépôt, pas dans le seul `cockpit/`.
    case '/api/media': {
      const root = asked()
      const media = root ? mediaPath(root, url.searchParams.get('file') ?? '') : null
      return media ?? { status: 404, json: { error: 'média introuvable' } }
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
      res.setHeader('Content-Type', result.type ?? 'image/png')
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
      headers: { 'Content-Type': result.type ?? 'image/png' },
    })
  }

  return new Response(JSON.stringify(result.json), {
    status: result.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
