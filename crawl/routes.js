/**
 * Normalisation des chemins découverts pendant le parcours.
 *
 * Le crawler visite des URL concrètes (`/plante/12`), mais la carte doit
 * montrer des écrans (`/plante/:id`). Sans ce repliement, un herbier de
 * quatre-vingts planches produirait quatre-vingts « pages » identiques.
 *
 * Module pur : aucune entrée/sortie, entièrement testable.
 */

const NUMERIC = /^\d+$/
const HEX = /^[0-9a-f]{24,}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Seuil au-delà duquel des valeurs frères sont une collection, pas des écrans. */
const COLLECTION_THRESHOLD = 3

/** Un segment ressemble-t-il à un identifiant plutôt qu'à un nom d'écran ? */
export function isDynamicSegment(segment) {
  return NUMERIC.test(segment) || UUID.test(segment) || HEX.test(segment)
}

const segmentsOf = path => path.split('/').filter(Boolean)

/**
 * Replie les chemins concrets en routes.
 *
 * Un segment devient un paramètre dans deux cas :
 *
 * 1. Il ressemble à un identifiant — nombre, uuid, hexadécimal.
 * 2. Il est à une profondeur ≥ 1 ET partage sa position avec au moins trois
 *    autres valeurs qui ne ressemblent pas non plus à des identifiants. C'est
 *    le cas des slugs (`/blog/mon-article`), reconnaissables seulement au fait
 *    qu'ils sont nombreux.
 *
 * Les deux restrictions de la seconde règle sont chèrement acquises :
 *
 * - **Profondeur ≥ 1** : à la racine, les valeurs frères sont des écrans, pas
 *   une collection. Sans cette borne, `/auth`, `/privacy`, `/terms`, `/legal`
 *   et `/cookies` se replient en un seul `/:id` et cinq pages disparaissent de
 *   la carte.
 * - **Frères non identifiants** : sous `/campaigns`, les frères sont trois
 *   uuid et le mot `new`. Compter les uuid ferait passer `/campaigns/new` —
 *   le formulaire de création — pour une campagne parmi d'autres.
 *
 * @param {string[]} paths chemins concrets, sans origine ni query
 * @returns {{routes: string[], routeOf: (path: string) => string}}
 */
export function normalizeRoutes(paths) {
  const clean = [...new Set(paths.map(p => (p === '/' ? '/' : p.replace(/\/+$/, ''))))].filter(
    Boolean,
  )

  // Pour chaque (préfixe, position), l'ensemble des valeurs rencontrées.
  const siblings = new Map()
  for (const path of clean) {
    const segments = segmentsOf(path)
    segments.forEach((segment, i) => {
      const key = segments.slice(0, i).join('/') + `#${i}`
      if (!siblings.has(key)) siblings.set(key, new Set())
      siblings.get(key).add(segment)
    })
  }

  const routeFor = path => {
    const segments = segmentsOf(path)
    if (segments.length === 0) return '/'

    let param = 0
    const out = segments.map((segment, i) => {
      const key = segments.slice(0, i).join('/') + `#${i}`
      const namedSiblings = [...(siblings.get(key) ?? [])].filter(v => !isDynamicSegment(v)).length

      const dynamic =
        isDynamicSegment(segment) || (i >= 1 && namedSiblings >= COLLECTION_THRESHOLD)
      if (!dynamic) return segment
      param += 1
      return param === 1 ? ':id' : `:id${param}`
    })
    return '/' + out.join('/')
  }

  const mapping = new Map(clean.map(path => [path, routeFor(path)]))

  return {
    routes: [...new Set(mapping.values())],
    routeOf: path => {
      const key = path === '/' ? '/' : path.replace(/\/+$/, '')
      return mapping.get(key) ?? path
    },
  }
}

/** Nom de dossier pour les captures d'une route. Jamais de traversée. */
export function pageSlug(route) {
  const slug = route
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'accueil'
}

/** Le lien reste-t-il dans l'application ? */
export function sameOrigin(href, baseUrl) {
  try {
    return new URL(href, baseUrl).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

/**
 * L'adresse désigne-t-elle ce poste ? http(s) vers `localhost`, `127.x.x.x`
 * ou `[::1]`. Pas `*.localhost` : Chrome le garde en boucle locale, mais le
 * `fetch` de Node qui sonde le port passe par le résolveur du système.
 *
 * `baseUrl` vient d'`ovrsee.config.json`, versionné : sans cette borne, un
 * dépôt envoyait le crawl — et le Chrome du poste — sur le réseau local ou
 * sur Internet (T-0275). Le crawl cartographie l'application qu'on développe,
 * et elle tourne ici.
 *
 * @param {unknown} url
 */
export function urlLocale(url) {
  let u
  try {
    u = new URL(String(url))
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname
  return h === 'localhost' || h === '[::1]' || /^127(\.\d{1,3}){3}$/.test(h)
}

/** Une route d'entrée reste-t-elle sur l'origine de `baseUrl` ? */
export const routeDansBase = (route, baseUrl) => typeof route === 'string' && sameOrigin(route, baseUrl)
