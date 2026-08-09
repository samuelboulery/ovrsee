#!/usr/bin/env node
/**
 * Crawl post-commit : démarre l'application, la parcourt, photographie chaque
 * page et écrit la carte de navigation.
 *
 * Il tourne AU COMMIT, jamais à la reprise. Au moment où on revient sur un
 * projet dormant, c'est précisément le moment où il est le moins capable de
 * démarrer — dépendances obsolètes, service disparu, variables oubliées.
 * Photographier une application exige qu'elle tourne : on la photographie
 * pendant que l'environnement est chaud, et à la reprise on lit un historique.
 *
 * Un scan qui échoue S'ÉCRIT. Conserver silencieusement la capture précédente
 * en la faisant passer pour fraîche serait le seul vrai mensonge du système.
 *
 *   node crawl/index.js [chemin-du-dépôt]
 */

import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// WHY: photographier une application exige de la faire tourner. Playwright
// est le seul pilote qui gère l'attente du réseau, l'état d'authentification
// et la capture pleine page sans embarquer son propre navigateur —
// `playwright-core` utilise celui du système.
import { chromium } from 'playwright-core'

import { normalizeRoutes, pageSlug, sameOrigin } from './routes.js'
import { writeFileNoFollow } from '../hooks/plans.js'

const DEFAULTS = {
  dev: 'pnpm dev',
  baseUrl: 'http://localhost:5173',
  readyTimeoutMs: 60_000,
  entryRoutes: ['/'],
  maxPages: 60,
  ignore: [],
  auth: null,
  viewport: { width: 1280, height: 800 },
}

const root = resolve(process.argv[2] ?? process.cwd())
const cockpitDir = join(root, 'cockpit')
const pagesDir = join(cockpitDir, 'pages')
const shotsDir = join(pagesDir, 'shots')

const log = message => process.stdout.write(`[crawl] ${message}\n`)

function loadConfig() {
  const path = join(root, 'cockpit.config.json')
  if (!existsSync(path)) throw new Error(`configuration absente : ${path}`)

  const config = { ...DEFAULTS, ...JSON.parse(readFileSync(path, 'utf8')) }
  if (typeof config.baseUrl !== 'string' || !config.baseUrl.startsWith('http')) {
    throw new Error(`baseUrl invalide : ${config.baseUrl}`)
  }
  if (!Array.isArray(config.entryRoutes) || config.entryRoutes.length === 0) {
    throw new Error('entryRoutes doit contenir au moins une route')
  }
  return config
}

/**
 * Faut-il rejouer une session enregistrée ?
 *
 * Refus si le fichier n'est pas ignoré par git : il contient un jeton valide,
 * et une fois committé il est dans l'historique pour de bon. Le crawl continue
 * sans session plutôt que d'encourager la fuite — les pages publiques restent
 * cartographiées, et la trace du scan dira que les pages protégées manquent.
 */
function useStorageState(config) {
  const relative = config.auth?.storageState
  if (!relative || !existsSync(join(root, relative))) return false

  try {
    execFileSync('git', ['check-ignore', '-q', relative], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    log(`${relative} n'est pas ignoré par git — session non rejouée, pages protégées ignorées`)
    return false
  }
}

const shortSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'sans-commit'
  }
}

/** Trace le scan, réussi ou non. C'est la seule écriture qui n'est jamais sautée. */
function recordScan(entry) {
  mkdirSync(pagesDir, { recursive: true })
  appendFileSync(join(pagesDir, 'scans.jsonl'), JSON.stringify(entry) + '\n', 'utf8')
}

// --- démarrage de l'application -------------------------------------------

const sleep = ms => new Promise(done => setTimeout(done, ms))

async function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
      return
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`l'application n'a pas répondu sur ${baseUrl} en ${timeoutMs} ms`)
}

/**
 * Refuse de scanner si quelque chose répond déjà sur baseUrl.
 *
 * Sur une machine de développement, plusieurs projets se disputent le port
 * 5173. Un serveur déjà en place n'est pas forcément le nôtre, et rien dans la
 * réponse HTTP ne permet de le savoir. Photographier ce serveur-là produirait
 * des captures datées d'aujourd'hui montrant une autre application : le seul
 * mensonge que ce système ne doit jamais commettre. On préfère un scan échoué.
 */
async function assertPortFree(baseUrl) {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
  } catch {
    return // personne ne répond : la voie est libre
  }
  throw new Error(
    `${baseUrl} répond déjà — un autre serveur occupe le port. ` +
      `Arrêtez-le, ou donnez un baseUrl libre dans cockpit.config.json.`,
  )
}

async function startApp(config) {
  await assertPortFree(config.baseUrl)

  // shell: true parce que `dev` est une ligne de commande écrite par
  // l'utilisateur dans SON fichier de configuration, dans SON dépôt — au même
  // titre qu'un script npm. Elle n'est jamais construite à partir d'une entrée
  // externe.
  const child = spawn(config.dev, { cwd: root, shell: true, stdio: 'ignore', detached: true })
  try {
    await waitForServer(config.baseUrl, config.readyTimeoutMs)
  } catch (err) {
    stopApp(child)
    throw err
  }
  return child
}

function stopApp(child) {
  if (!child?.pid) return
  try {
    // Le groupe entier : `pnpm dev` laisse un enfant vite derrière lui.
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* déjà mort */
    }
  }
}

// --- parcours --------------------------------------------------------------

const pathOf = url => {
  const { pathname } = new URL(url)
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
}

const isIgnored = (path, patterns) =>
  patterns.some(pattern => new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(path))

/**
 * Parcours en largeur depuis les routes d'entrée, en suivant les liens
 * internes. Rend une entrée par chemin concret visité.
 */
async function visitAll(page, config) {
  const queue = config.entryRoutes.map(route => new URL(route, config.baseUrl).href)
  const seen = new Set()
  const visited = []
  /** chemin demandé → chemin réellement affiché, quand ils diffèrent */
  const redirects = new Map()

  while (queue.length > 0 && visited.length < config.maxPages) {
    const url = queue.shift()
    const requested = pathOf(url)
    if (seen.has(requested) || isIgnored(requested, config.ignore)) continue
    seen.add(requested)

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
      if (response && response.status() >= 400) {
        log(`${requested} → HTTP ${response.status()}, ignorée`)
        continue
      }
    } catch (err) {
      log(`${requested} → injoignable (${err.message.split('\n')[0]})`)
      continue
    }

    // L'identité d'une page est son URL FINALE. Une route protégée redirige
    // vers la connexion : l'enregistrer sous le chemin demandé donnerait une
    // page « /dashboard » montrant un formulaire de connexion — un faux
    // plausible, donc le pire. On garde la redirection comme information : elle
    // dit que la route existe et qu'elle est protégée.
    const path = pathOf(page.url())
    if (path !== requested) {
      redirects.set(requested, path)
      log(`${requested} → redirige vers ${path}`)
      if (seen.has(path)) continue
      seen.add(path)
    }

    const links = await page.$$eval('a[href]', anchors => anchors.map(a => a.href))
    const outgoing = [
      ...new Set(
        links.filter(href => sameOrigin(href, config.baseUrl)).map(href => pathOf(href)),
      ),
    ]

    visited.push({
      path,
      title: (await page.title()) || path,
      text: (await page.evaluate(() => document.body?.innerText ?? '')).slice(0, 400),
      links: outgoing,
    })

    for (const link of outgoing) {
      if (!seen.has(link)) queue.push(new URL(link, config.baseUrl).href)
    }
  }

  if (queue.length > 0) {
    log(`plafond de ${config.maxPages} pages atteint — ${queue.length} lien(s) non suivis`)
  }
  return { visited, redirects: Object.fromEntries(redirects) }
}

// --- rétention -------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000

/**
 * Tout garder sur trente jours, puis une capture par semaine.
 *
 * Décidé avant l'accumulation, parce qu'une politique de rétention choisie
 * après coup ne peut plus rendre ce qu'elle a laissé grossir.
 */
export function retainable(files, now = new Date()) {
  const parsed = files
    .map(file => ({ file, at: Date.parse(file.slice(0, 10)) }))
    .filter(f => !Number.isNaN(f.at))
    .sort((a, b) => b.at - a.at)

  const keep = new Set()
  const weeksSeen = new Set()

  for (const { file, at } of parsed) {
    if (now.getTime() - at <= 30 * DAY) {
      keep.add(file)
      continue
    }
    const week = Math.floor(at / (7 * DAY))
    if (!weeksSeen.has(week)) {
      weeksSeen.add(week)
      keep.add(file)
    }
  }
  return keep
}

/**
 * Dossiers de captures qui ne correspondent à aucune page du scan courant.
 *
 * Deux causes, indiscernables de l'extérieur : une page a disparu de
 * l'application, ou un scan antérieur a mal nommé sa route. Dans les deux cas
 * ce sont des images qu'un lecteur prendrait pour des écrans actuels.
 *
 * On les signale, on ne les supprime PAS : effacer serait irréversible, et une
 * capture d'une page réellement supprimée reste un morceau d'histoire. Le
 * cockpit dit ce qu'il sait — « ces images ne correspondent à rien d'actuel » —
 * et laisse l'arbitrage à celui qui peut le faire.
 */
function orphanShots(knownSlugs) {
  try {
    return readdirSync(shotsDir).filter(slug => !knownSlugs.includes(slug))
  } catch {
    return []
  }
}

function pruneShots(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.png'))
  const keep = retainable(files)
  for (const file of files) {
    if (!keep.has(file)) rmSync(join(dir, file))
  }
}

// --- orchestration ---------------------------------------------------------

async function run() {
  const config = loadConfig()
  const commit = shortSha()
  const date = new Date().toISOString().slice(0, 10)

  log(`démarrage de « ${config.dev} »…`)
  const app = await startApp(config)

  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({
      viewport: config.viewport,
      ...(useStorageState(config) ? { storageState: join(root, config.auth.storageState) } : {}),
    })
    const page = await context.newPage()

    const { visited, redirects } = await visitAll(page, config)
    log(`${visited.length} chemin(s) visité(s)`)

    const { routeOf } = normalizeRoutes(visited.map(v => v.path))

    // Une capture par ROUTE, pas par chemin concret : quatre-vingts planches
    // ne doivent pas produire quatre-vingts photographies du même écran.
    const pages = new Map()
    for (const entry of visited) {
      const route = routeOf(entry.path)
      if (pages.has(route)) continue

      const slug = pageSlug(route)
      const dir = join(shotsDir, slug)
      mkdirSync(dir, { recursive: true })

      await page.goto(new URL(entry.path, config.baseUrl).href, { waitUntil: 'networkidle' })
      await page.screenshot({ path: join(dir, `${date}-${commit}.png`), fullPage: false })
      pruneShots(dir)

      pages.set(route, {
        route,
        slug,
        title: entry.title,
        sample: entry.path,
        excerpt: entry.text,
        links: [...new Set(entry.links.map(routeOf))].filter(r => r !== route),
        shot: `shots/${slug}/${date}-${commit}.png`,
        shotDate: date,
        // Enregistré au moment de la prise, jamais deviné à l'affichage : une
        // vignette au mauvais rapport ne montre qu'une bande de l'écran, et
        // toutes les pages finissent par se ressembler. Si `viewport` change
        // dans la configuration, l'interface suit sans qu'on la retouche.
        shotSize: { ...config.viewport },
      })
    }

    await browser.close()
    stopApp(app)

    // Les redirections sont exprimées en routes : `/dashboard → /auth` dit que
    // la route existe mais qu'elle est protégée.
    const redirectRoutes = Object.fromEntries(
      Object.entries(redirects).map(([from, to]) => [routeOf(from), routeOf(to)]),
    )

    const orphans = orphanShots([...pages.values()].map(p => p.slug))
    if (orphans.length > 0) {
      log(`${orphans.length} dossier(s) de captures sans page correspondante : ${orphans.join(', ')}`)
    }

    writeFileNoFollow(
      join(pagesDir, 'pages.json'),
      JSON.stringify(
        { date, commit, pages: [...pages.values()], redirects: redirectRoutes, orphanShots: orphans },
        null,
        2,
      ) + '\n',
    )
    recordScan({ date, commit, ok: true, pages: pages.size })
    log(`${pages.size} page(s) écrite(s) dans cockpit/pages/pages.json`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    stopApp(app)
  }
}

// Exécuté seulement en invocation directe : les tests importent `retainable`
// sans vouloir démarrer un navigateur.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    const message = String(err?.message ?? err)
    // L'échec est une information, pas un silence. Sans cette ligne, le cockpit
    // continuerait d'afficher la capture d'avant comme si elle datait d'aujourd'hui.
    recordScan({
      date: new Date().toISOString().slice(0, 10),
      commit: shortSha(),
      ok: false,
      error: message,
    })
    process.stderr.write(`[crawl] scan échoué : ${message}\n`)
    process.exit(0)
  })
}
