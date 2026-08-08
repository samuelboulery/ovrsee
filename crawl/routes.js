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
 * Un segment devient un paramètre s'il ressemble à un identifiant, ou si le
 * même préfixe porte au moins trois valeurs distinctes à cette position — le
 * cas des slugs, qui ne ressemblent à rien de reconnaissable mais désignent
 * bien une collection.
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
      const variants = siblings.get(key)?.size ?? 0
      const dynamic = isDynamicSegment(segment) || variants >= COLLECTION_THRESHOLD
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
