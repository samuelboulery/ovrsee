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

import { spawn } from 'node:child_process'

import { git } from '../hooks/git.js'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

// WHY: photographier une application exige de la faire tourner. Playwright
// est le seul pilote qui gère l'attente du réseau, l'état d'authentification
// et la capture pleine page sans embarquer son propre navigateur —
// `playwright-core` utilise celui du système.
import { lancerChrome } from './chrome.js'
import { memeProjet, titreAttendu, titreServi } from './serveur.js'
import { readJsonDuDepot } from '../hooks/json.js'

import { normalizeRoutes, pageSlug, routeDansBase, sameOrigin, urlLocale } from './routes.js'
import { assurerConfiance, DEV_DEFAUT } from './confiance.js'
import { migrerSession, sessionPath } from './session.js'
import { redige } from '../hooks/redaction.js'
import { cleanEnv, killTree, shellRun } from '../hooks/shell.js'
import { writeFileNoFollow } from '../hooks/plans.js'
import { appendFileNoFollow, assurerSansLien } from '../hooks/sans-lien.js'
import { estPrincipal } from '../hooks/principal.js'

const DEFAULTS = {
  // Partagé avec `crawl/confiance.js` : c'est la chaîne approuvée quand la
  // configuration n'en déclare pas. Deux défauts divergents feraient approuver
  // une commande et en exécuter une autre.
  dev: DEV_DEFAUT,
  baseUrl: 'http://localhost:5173',
  readyTimeoutMs: 60_000,
  entryRoutes: ['/'],
  maxPages: 60,
  ignore: [],
  auth: null,
  viewport: { width: 1280, height: 800 },
}

const root = resolve(process.argv[2] ?? process.cwd())
const ovrseeDir = join(root, 'ovrsee')
const pagesDir = join(ovrseeDir, 'pages')
const shotsDir = join(pagesDir, 'shots')

const log = message => process.stdout.write(`[crawl] ${message}\n`)

function loadConfig() {
  const path = join(root, 'ovrsee.config.json')
  if (!existsSync(path)) throw new Error(`configuration absente : ${path}`)

  let lu
  try {
    lu = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    // Le message de `JSON.parse` cite le texte fautif : il vient du dépôt, et
    // part dans `scans.jsonl` avant l'accord.
    throw new Error('ovrsee.config.json illisible : JSON invalide')
  }
  const config = { ...DEFAULTS, ...lu }
  if (typeof config.baseUrl !== 'string' || !config.baseUrl.startsWith('http')) {
    // Sans la valeur : elle vient du dépôt observé, et ce message est écrit
    // dans `scans.jsonl` — avant que l'accord n'ait été vérifié.
    throw new Error('baseUrl invalide : une URL http(s) est attendue')
  }
  if (!urlLocale(config.baseUrl)) {
    throw new Error('baseUrl refusé : le crawl ne vise que ce poste (localhost, 127.0.0.1, ::1)')
  }
  if (!Array.isArray(config.entryRoutes) || config.entryRoutes.length === 0) {
    throw new Error('entryRoutes doit contenir au moins une route')
  }
  if (!config.entryRoutes.every(route => routeDansBase(route, config.baseUrl))) {
    throw new Error('entryRoutes refusé : chaque route doit rester sur l’origine de baseUrl')
  }
  return config
}

/**
 * La session enregistrée à rejouer, ou null.
 *
 * Elle vit hors du dépôt (`crawl/session.js`, T-0275). Une session laissée
 * dans le dépôt par une version antérieure y est déplacée au passage.
 */
function sessionARejouer(config) {
  try {
    if (migrerSession(root, config)) log('session déplacée hors du dépôt — l’ancien fichier peut être supprimé')
  } catch (err) {
    log(`session non déplacée : ${err?.message ?? err}`)
  }
  const chemin = sessionPath(root)
  return existsSync(chemin) ? chemin : null
}

const shortSha = () => {
  try {
    return git(root, ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'sans-commit'
  }
}

/** Trace le scan, réussi ou non. C'est la seule écriture qui n'est jamais sautée. */
function recordScan(entry) {
  // Rédigé ici plutôt qu'à la capture : c'est le seul point d'écriture, donc le
  // seul endroit qu'un futur chemin d'échec ne pourra pas contourner.
  const propre = entry.error ? { ...entry, error: redige(entry.error) } : entry
  // Jamais à travers un lien : `scans.jsonl -> .git/hooks/post-commit` faisait
  // ajouter ce texte à un script exécuté au commit suivant.
  appendFileNoFollow(join(pagesDir, 'scans.jsonl'), JSON.stringify(propre) + '\n')
}

// --- démarrage de l'application -------------------------------------------

const sleep = ms => new Promise(done => setTimeout(done, ms))

async function waitForServer(baseUrl, timeoutMs, sortie = () => '') {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(baseUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
      return
    } catch {
      await sleep(500)
    }
  }

  // Ce que la commande `dev` a dit avant de renoncer. Sans ça, l'échec le plus
  // fréquent — `pnpm: command not found`, quand l'ovrsee est lancé depuis le
  // Finder — se lisait « l'application n'a pas répondu », ce qui envoie
  // chercher le problème dans le projet observé plutôt que dans le PATH.
  const dit = sortie().trim()
  throw new Error(
    `l'application n'a pas répondu sur ${baseUrl} en ${timeoutMs} ms` +
      (dit ? `\n\nCe qu'a dit la commande dev :\n${dit}` : ' (et elle n\'a rien écrit)'),
  )
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
    await fetch(baseUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
  } catch {
    return // personne ne répond : la voie est libre
  }
  throw new Error(
    `${baseUrl} répond déjà — un autre serveur occupe le port. ` +
      `Arrêtez-le, ou donnez un baseUrl libre dans ovrsee.config.json.`,
  )
}

/**
 * Le serveur de dev en cours, s'il y en a un.
 *
 * Au niveau du module, et pas seulement dans `run()`, parce qu'un signal
 * n'arrive pas dans une portée : annuler un crawl depuis l'application tue le
 * groupe du crawler, et sans cette référence le `finally` de `run()` n'a pas
 * le temps de s'exécuter. Le serveur de dev, lui, est `detached` — il est donc
 * dans son propre groupe et survit. Le port restait pris, et tous les crawls
 * suivants se refusaient d'eux-mêmes.
 */
let appEnCours = null

/** Ce que la commande `dev` a écrit, borné : c'est un message d'erreur, pas un journal. */
const DERNIERS_OCTETS = 2000

/**
 * Les derniers mots de la commande `dev`, filtrés **avant** d'être tronqués.
 *
 * Coupée d'abord, une affectation perdait son nom — `…KEY=` hors de la
 * fenêtre — et sa valeur restait, nue, qu'aucune règle ne reconnaissait
 * (T-0275). On garde quatre fois la fenêtre, on filtre, puis on coupe : ce
 * qu'une coupure de tête abîme n'atteint jamais la fin conservée.
 *
 * @param {number} [taille]
 */
export function garderSortie(taille = DERNIERS_OCTETS) {
  let brut = ''
  return {
    retiens: morceau => {
      brut = (brut + morceau).slice(-4 * taille)
    },
    lire: () => redige(brut).slice(-taille),
  }
}

async function startApp(config) {
  await assertPortFree(config.baseUrl)

  // `-lic`, pas `shell: true`, et les trois lettres comptent.
  //
  // `shell: true` lance `/bin/sh -c`, qui ne source rien. Lancé depuis le DMG,
  // l'ovrsee hérite du PATH minimal d'une application graphique — `/usr/bin`,
  // `/bin`, `/usr/sbin`, `/sbin` — où `pnpm` n'est pas. La commande sortait
  // aussitôt sur un `command not found` que `stdio: 'ignore'` jetait, et
  // l'attente du serveur expirait soixante secondes plus tard.
  //
  // `-l` seul ne suffit pas : zsh ne source `.zshrc` que pour un shell
  // INTERACTIF, et c'est là que vivent les PATH des gestionnaires de version
  // (pnpm, nvm, mise…). `-l` donne `.zprofile`, `-i` donne `.zshrc`. Le
  // terminal intégré échappe au piège sans le savoir : un pty est interactif
  // par nature.
  //
  // La ligne reste passée à un shell parce que `dev` est une commande écrite
  // par l'utilisateur dans SON fichier de configuration, dans SON dépôt, au
  // même titre qu'un script npm. Elle n'est jamais construite à partir d'une
  // entrée externe.
  const [fichier, args, options] = shellRun(config.dev)
  const child = spawn(fichier, args, {
    ...options,
    cwd: root,
    env: cleanEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    // `detached` vient de `shellRun` avec le reste : il ne se décide pas sans
    // savoir quel shell a été choisi — voir `hooks/shell.js`. Le poser ici
    // écrasait la réponse, et sous Windows le `cmd.exe` détaché emportait dans
    // sa console tout ce que les deux tuyaux ci-dessus devaient lire.
  })

  // Retenu ici, et pas au retour de `startApp` : entre ce `spawn` et le moment
  // où le serveur répond, il peut s'écouler jusqu'à `readyTimeoutMs` — soit une
  // minute. C'est précisément là qu'on annule, puisque c'est là que le crawl
  // paraît bloqué. Affecté plus tard, le gestionnaire de signal lisait `null`
  // et laissait le serveur derrière lui, port compris.
  appEnCours = child

  // Sans cet écouteur, un shell introuvable lève un événement `error` que
  // personne n'attrape, et le crawl meurt sans rien consigner — l'échec
  // deviendrait un silence, ce que ce système ne doit jamais produire.
  let panne = null
  child.on('error', err => {
    panne = String(err?.message ?? err)
  })

  // Gardée pour l'échec, jetée en cas de succès. Non lue, elle remplirait le
  // tuyau et finirait par bloquer le serveur de dev.
  const { retiens, lire } = garderSortie()
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', retiens)
  child.stderr.on('data', retiens)

  // Noté, pas agi : une commande qui rend la main n'a pas forcément renoncé —
  // `docker compose up -d` sort aussitôt et le serveur arrive après. On attend
  // donc le délai complet, mais on le dit dans le message d'échec, parce que
  // c'est ce qui distingue « rien ne démarre » de « c'est long ».
  let partie = false
  child.on('exit', () => {
    partie = true
  })

  log(`attente de ${config.baseUrl}…`)
  try {
    await waitForServer(config.baseUrl, config.readyTimeoutMs, () => {
      const trace = lire()
      if (panne) return `${trace}\n(la commande dev n'a pas pu être lancée : ${panne})`
      return partie ? `${trace}\n(la commande dev s'est arrêtée d'elle-même)` : trace
    })
  } catch (err) {
    stopApp(child)
    throw err
  }
  return child
}

// Le groupe entier, ou l'arbre entier sous Windows : `pnpm dev` laisse un
// enfant vite derrière lui, et ne tuer que le fils direct laisserait le port
// pris — le crawl suivant refuserait alors de démarrer.
const stopApp = killTree

// --- parcours --------------------------------------------------------------

const pathOf = url => {
  const { pathname } = new URL(url)
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
}

/**
 * Un chemin correspond-il à l'un des globs `ignore` ? Seul `*` est spécial.
 *
 * Pas de `RegExp` : le motif vient d'`ovrsee.config.json`, versionné, et le
 * chemin d'un lien de la page observée. `(` faisait lever, et `*a*a*…b` sur un
 * long chemin ne finissait pas (T-0274). Ici, au pire chemin × motif.
 */
export const isIgnored = (path, patterns) => patterns.some(pattern => globCorrespond(String(pattern), path))

function globCorrespond(motif, texte) {
  let m = 0
  let t = 0
  let etoile = -1
  let reprise = 0
  while (t < texte.length) {
    if (m < motif.length && motif[m] !== '*' && motif[m] === texte[t]) {
      m += 1
      t += 1
    } else if (m < motif.length && motif[m] === '*') {
      etoile = m
      reprise = t
      m += 1
    } else if (etoile !== -1) {
      m = etoile + 1
      reprise += 1
      t = reprise
    } else {
      return false
    }
  }
  while (motif[m] === '*') m += 1
  return m === motif.length
}

/**
 * Ce qui résume une page, du plus délibéré au plus brut (T-0294) : la
 * description qu'elle déclare, son titre et son premier paragraphe, son
 * contenu principal, et seulement en dernier recours tout `body` — qui
 * emportait la barre latérale et les raccourcis (« Rechercher… ⌘K VUES 7 »).
 *
 * @param {{ description?: string, h1?: string, p?: string, main?: string, texte?: string }} lu
 * @returns {string}
 */
export function extraitDePage({ description, h1, p, main, texte } = {}) {
  const net = v => String(v ?? '').trim()
  if (net(description)) return net(description)
  const entete = [net(h1), net(p)].filter(Boolean).join('\n')
  return entete || net(main) || net(texte)
}

/**
 * Filtre le titre et l'extrait captés dans le DOM de l'application observée,
 * au plus près de la source — avant qu'ils n'entrent dans `visited[]` — pour
 * que `pages.json`, versionné, et tout consommateur en aval (skill `ovrsee`,
 * outil MCP `getProjectSummary`) héritent du filtre sans repasser dessus.
 *
 * `redige()` s'applique avant la troncature à 400 caractères : sectionner
 * d'abord aurait pu couper un jeton en deux et le laisser passer à moitié.
 */
export function sanitizePageCapture(title, text) {
  // Borné avant le filtre : seuls 400 caractères restent, et le texte d'une
  // page n'a pas de taille maximale.
  return { title: redige(String(title ?? '').slice(0, 2000)), text: redige(String(text ?? '').slice(0, 20000)).slice(0, 400) }
}

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

    // Le serveur local peut rediriger ailleurs : la page d'un autre hôte
    // n'entre pas dans la carte (T-0275). La requête, elle, est partie — la
    // bloquer demanderait d'intercepter chaque navigation (`page.route`).
    if (!sameOrigin(page.url(), config.baseUrl)) {
      log(`${requested} → redirige hors de baseUrl, ignorée`)
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

    const lu = await page.evaluate(() => ({
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      h1: document.querySelector('h1')?.innerText ?? '',
      p: (document.querySelector('main p, article p') ?? document.querySelector('p'))?.innerText ?? '',
      main: document.querySelector('main')?.innerText ?? '',
      texte: document.body?.innerText ?? '',
    }))
    const { title, text } = sanitizePageCapture((await page.title()) || path, extraitDePage(lu))
    visited.push({ path, title, text, links: outgoing })

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
 * Deux jours entiers, puis une capture par jour, puis une par semaine.
 *
 * Décidé avant l'accumulation, parce qu'une politique de rétention choisie
 * après coup ne peut plus rendre ce qu'elle a laissé grossir.
 *
 * L'étage journalier est arrivé après coup, lui (T-0136) : « tout garder sur
 * trente jours » n'avait pas prévu qu'un crawl tourne à chaque commit. Sur ce
 * dépôt, 879 captures pour huit pages en treize jours — douze photographies du
 * même écran par jour, dont onze ne montrent rien que la douzième ne montre.
 * Le ticket visait la compression : mesure faite, il n'y a rien à y gagner.
 * Chrome écrit déjà un PNG serré sur une interface à plats, et le même écran en
 * JPEG qualité 85 sort *plus gros* (97 ko contre 96). Le poids était dans le
 * nombre.
 *
 * Les deux jours pleins ne sont pas de la prudence : plusieurs crawls d'un même
 * après-midi se comparent entre eux, et c'est le seul moment où ils le méritent.
 * Ils garantissent aussi que la capture qu'on vient d'écrire — celle que
 * `pages.json` cite — survit au ménage qui suit immédiatement.
 *
 * La granularité est le jour, pas l'heure : un nom de fichier ne porte que
 * `YYYY-MM-DD` et un sha. Départager deux captures du même jour se fait donc
 * sur le nom, faute de mieux — arbitraire, mais stable d'un ménage à l'autre.
 */
export function retainable(files, now = new Date()) {
  const parsed = files
    .map(file => ({ file, at: Date.parse(file.slice(0, 10)) }))
    .filter(f => !Number.isNaN(f.at))
    .sort((a, b) => b.at - a.at || b.file.localeCompare(a.file))

  const keep = new Set()
  const daysSeen = new Set()
  const weeksSeen = new Set()

  for (const { file, at } of parsed) {
    const age = now.getTime() - at

    if (age <= 2 * DAY) {
      keep.add(file)
      continue
    }

    if (age <= 30 * DAY) {
      const day = Math.floor(at / DAY)
      if (!daysSeen.has(day)) {
        daysSeen.add(day)
        keep.add(file)
      }
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
 * ovrsee dit ce qu'il sait — « ces images ne correspondent à rien d'actuel » —
 * et laisse l'arbitrage à celui qui peut le faire.
 */
function orphanShots(knownSlugs) {
  try {
    return readdirSync(shotsDir).filter(slug => !knownSlugs.includes(slug))
  } catch {
    return []
  }
}

/** Le nom exact qu'écrit le crawl : `YYYY-MM-DD-<sha>.png`, ou `sans-commit` (`shortSha`). */
const NOM_CAPTURE = /^\d{4}-\d{2}-\d{2}-(?:[0-9a-f]+|sans-commit)\.png$/

/**
 * Les captures à effacer : seulement celles dont le nom est celui que le crawl
 * écrit, et que `retainable` ne garde pas. Un autre fichier — ou un dossier de
 * l'utilisateur derrière un lien — n'est jamais touché.
 */
export function capturesASupprimer(files, now = new Date()) {
  const captures = files.filter(f => NOM_CAPTURE.test(f))
  const keep = retainable(captures, now)
  return captures.filter(f => !keep.has(f))
}

function pruneShots(dir) {
  assurerSansLien(dir)
  for (const file of capturesASupprimer(readdirSync(dir))) rmSync(join(dir, file))
}

// --- orchestration ---------------------------------------------------------

async function run() {
  const config = loadConfig()

  // Le serveur du projet tourne déjà ? On le photographie sans rien lancer
  // (T-0281). Seule chose faite avant l'accord : un GET sur `baseUrl`, que
  // `loadConfig` a restreint à ce poste — rien n'y est exécuté.
  const servi = await titreServi(config.baseUrl)
  const reutilise = memeProjet(servi, titreAttendu(readJsonDuDepot(root, join(pagesDir, 'pages.json'))))

  // Sinon, avant tout le reste : aucun navigateur, aucune trace. `config.dev`
  // est ici la chaîne exacte qui partira à `shellRun()` dans `startApp` —
  // c'est elle qu'on compare à l'accord, et personne ne relit le fichier entre
  // les deux. Un `dev` changé depuis l'accord fait donc échouer la
  // comparaison, ce qui referme la course entre l'accord et le lancement.
  if (!reutilise) await assurerConfiance(root, config.dev)

  const commit = shortSha()
  const date = new Date().toISOString().slice(0, 10)

  const session = sessionARejouer(config)

  // Le navigateur avant le serveur : sans Chrome, inutile de démarrer le
  // projet observé pour l'arrêter aussitôt (T-0283).
  const browser = await lancerChrome({ headless: true })
  let app = null
  try {
    if (reutilise) {
      log('serveur déjà lancé, réutilisé')
    } else {
      log(`démarrage de « ${config.dev} »…`)
      app = await startApp(config)
    }
    const context = await browser.newContext({
      viewport: config.viewport,
      ...(session ? { storageState: session } : {}),
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
      const capture = join(dir, `${date}-${commit}.png`)
      assurerSansLien(capture)
      mkdirSync(dir, { recursive: true })
      assurerSansLien(capture)

      await page.goto(new URL(entry.path, config.baseUrl).href, { waitUntil: 'networkidle' })
      await page.screenshot({ path: capture, fullPage: false })
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
        {
          date,
          commit,
          // Ce que le serveur servait : la preuve qu'on relira au prochain
          // crawl pour reconnaître le serveur déjà lancé (T-0281).
          // Versionné comme le reste : filtré comme les titres de page.
          titreHtml: redige(String(servi ?? (await titreServi(config.baseUrl)) ?? '').slice(0, 2000)),
          pages: [...pages.values()],
          redirects: redirectRoutes,
          orphanShots: orphans,
        },
        null,
        2,
      ) + '\n',
    )
    recordScan({ date, commit, ok: true, pages: pages.size })
    log(`${pages.size} page(s) écrite(s) dans ovrsee/pages/pages.json`)
  } finally {
    await browser.close().catch(() => {})
    stopApp(app)
  }
}

// Exécuté seulement en invocation directe : les tests importent `retainable`
// sans vouloir démarrer un navigateur.
if (estPrincipal(import.meta.url)) {
  // Annuler un crawl envoie un signal au groupe du crawler. Sans ces deux
  // écouteurs, le processus meurt avant son `finally` et laisse derrière lui le
  // serveur de dev du projet observé, qui garde le port.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      stopApp(appEnCours)
      process.exit(0)
    })
  }

  run().catch(err => {
    const message = String(err?.message ?? err)
    // L'échec est une information, pas un silence. Sans cette ligne, l'ovrsee
    // continuerait d'afficher la capture d'avant comme si elle datait d'aujourd'hui.
    try {
      recordScan({
        date: new Date().toISOString().slice(0, 10),
        commit: shortSha(),
        ok: false,
        error: message,
      })
    } catch (trace) {
      // `scans.jsonl` refusé (lien symbolique) : l'échec se dit au moins ici.
      process.stderr.write(`[crawl] trace impossible : ${trace?.message ?? trace}\n`)
    }
    process.stderr.write(`[crawl] scan échoué : ${message}\n`)
    process.exit(0)
  })
}
