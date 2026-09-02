/**
 * L'état de travail d'une session Claude : quel plan capte ses commits, quel
 * ticket couvre ses éditions.
 *
 * Avant ce module, cet état vivait dans deux fichiers uniques par dépôt —
 * `ovrsee/.active-plan` et `ovrsee/.active-ticket`. Un seul fichier pour toutes
 * les sessions veut dire que la dernière qui écrit gagne : ouvrir un plan dans
 * une session volait le sien à toutes les autres, et leurs commits suivants
 * s'inscrivaient sous une intention qui n'était pas la leur. Travailler dans
 * plusieurs sessions à la fois est l'usage normal, pas un cas limite.
 *
 * L'état vit donc dans `ovrsee/.active/<session>.json`, un fichier par session,
 * et le dossier est ignoré par git : c'est de l'état local, pas du contenu.
 *
 * Deux règles portent tout le reste :
 *
 * - **Session inconnue → le seau partagé.** Le CLI, un commit fait depuis un
 *   terminal extérieur, un appelant sans identifiant : tous retombent sur
 *   `unknown.json`, qui se comporte exactement comme l'ancien fichier unique.
 * - **Une session ne lit jamais le seau d'une autre.** À défaut du sien, elle
 *   lit le seau partagé, et rien d'autre. C'est ce qui garantit qu'aucune
 *   session ne récupère l'intention d'une voisine.
 */

import { mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { readJson } from './json.js'

import { writeFileNoFollow, isSafePlanFileName } from './plans.js'

const DOSSIER = '.active'

/** Le seau des appelants sans identifiant de session. */
const PARTAGE = 'unknown'

/**
 * Au-delà, une entrée n'appartient plus à personne.
 *
 * ponytail: une date de dernière écriture, pas un signal de vie. Savoir
 * vraiment si une session tourne demanderait un démon, ce que le cadrage
 * interdit. Une session tuée sans `SessionEnd` laisse donc son entrée au plus
 * une journée — assez court pour ne pas gêner, assez long pour couvrir une
 * pause déjeuner au milieu d'un plan.
 */
const PERIME_MS = 24 * 60 * 60 * 1000

/** Au-delà, un verrou est réputé abandonné par un processus mort. */
const VERROU_PERIME_MS = 10_000

/** Le temps qu'on accepte d'attendre un verrou avant de passer outre. */
const ATTENTE_MAX_MS = 10_000

const PAS_MS = 20

const VIDE = { plan: null, ticket: null }

const dossierActif = ovrseeDir => join(ovrseeDir, DOSSIER)

/**
 * Réduit un identifiant de session à un nom de fichier sûr.
 *
 * Sécurité : c'est la seule barrière entre une valeur venue d'un payload JSON
 * et un chemin sur disque. Tout ce qui n'est pas `[a-z0-9-]` devient un tiret,
 * ce qui neutralise `/`, `\` et `..` d'un seul coup — même barrière que
 * `slugify` dans `plans.js`.
 */
export function assainirSession(brut) {
  const propre = String(brut ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')

  return propre || null
}

/**
 * L'identifiant de la session appelante, ou null.
 *
 * Deux sources, dans l'ordre de fiabilité : le payload d'un hook Claude porte
 * `session_id` ; à défaut, `CLAUDE_CODE_SESSION_ID` est exporté dans
 * l'environnement de l'outil Bash, donc hérité par le hook git `post-commit`
 * d'un `git commit` lancé depuis une session.
 */
export function sessionId(payload = null) {
  return assainirSession(payload?.session_id ?? process.env.CLAUDE_CODE_SESSION_ID ?? null)
}

const cheminEntree = (ovrseeDir, nom) => join(dossierActif(ovrseeDir), `${nom}.json`)

/** Lit une entrée, ou null — absente, illisible et corrompue se valent ici. */
function lireEntree(path) {
  const parse = readJson(path)
  if (parse === null || typeof parse !== 'object' || Array.isArray(parse)) return null

  // Les deux valeurs sont relues du disque puis réinjectées dans un chemin ou
  // dans une comparaison : on les valide ici, une fois, plutôt qu'à chaque
  // appelant qui finirait par l'oublier.
  return {
    plan: isSafePlanFileName(parse.plan) ? parse.plan : null,
    ticket: /^T-\d+$/.test(String(parse.ticket ?? '')) ? parse.ticket : null,
  }
}

/** Une entrée trop vieille n'appartient plus à personne : on la retire. */
function perimee(path) {
  try {
    return Date.now() - statSync(path).mtimeMs > PERIME_MS
  } catch {
    return false
  }
}

const oublier = path => {
  try {
    unlinkSync(path)
  } catch {
    // Déjà partie, ou jamais écrite : il n'y a rien à signaler.
  }
}

/**
 * Reprend un `.active-plan` / `.active-ticket` d'avant ce module.
 *
 * Une seule fois, au premier accès : leur contenu passe dans le seau partagé,
 * puis les fichiers disparaissent. Sans cela, un dépôt déjà équipé perdrait son
 * plan en cours à la mise à jour — et le pointeur survivrait sans que rien ne
 * le lise plus.
 */
function migrerAnciensPointeurs(ovrseeDir) {
  const ancienPlan = join(ovrseeDir, '.active-plan')
  const ancienTicket = join(ovrseeDir, '.active-ticket')

  const lire = path => {
    try {
      return readFileSync(path, 'utf8').trim()
    } catch {
      return null
    }
  }

  const plan = lire(ancienPlan)
  const ticket = lire(ancienTicket)
  if (plan === null && ticket === null) return

  const path = cheminEntree(ovrseeDir, PARTAGE)
  const actuel = lireEntree(path) ?? VIDE
  ecrire(path, {
    plan: actuel.plan ?? (isSafePlanFileName(plan) ? plan : null),
    ticket: actuel.ticket ?? (/^T-\d+$/.test(String(ticket)) ? ticket : null),
  })

  oublier(ancienPlan)
  oublier(ancienTicket)
}

const ecrire = (path, etat) =>
  writeFileNoFollow(path, JSON.stringify({ plan: etat.plan ?? null, ticket: etat.ticket ?? null }, null, 2) + '\n')

/**
 * L'état de travail d'une session : le sien, à défaut celui du seau partagé.
 *
 * @param {string} ovrseeDir
 * @param {string|null} session
 * @returns {{plan: string|null, ticket: string|null}}
 */
export function readActive(ovrseeDir, session = null) {
  migrerAnciensPointeurs(ovrseeDir)

  const nom = assainirSession(session)
  if (nom && nom !== PARTAGE) {
    const path = cheminEntree(ovrseeDir, nom)
    if (perimee(path)) {
      oublier(path)
    } else {
      const propre = lireEntree(path)
      if (propre) return propre
    }
  }

  const partage = cheminEntree(ovrseeDir, PARTAGE)
  if (perimee(partage)) {
    oublier(partage)
    return { ...VIDE }
  }
  return lireEntree(partage) ?? { ...VIDE }
}

/**
 * Écrit tout ou partie de l'état d'une session. Les champs absents du patch
 * gardent leur valeur.
 *
 * La fusion se fait sur le seau **exact** de la session, sans repli sur le seau
 * partagé : écrire ne doit jamais recopier chez soi l'état d'ailleurs.
 */
export function writeActive(ovrseeDir, session, patch) {
  const nom = assainirSession(session) ?? PARTAGE
  const path = cheminEntree(ovrseeDir, nom)
  const actuel = lireEntree(path) ?? VIDE

  ecrire(path, { ...actuel, ...patch })
}

/**
 * Retire un champ de l'état d'une session, ou l'entrée entière.
 *
 * @param {string} ovrseeDir
 * @param {string|null} session
 * @param {'plan'|'ticket'|null} champ null pour tout retirer
 * @param {string|null} valeur ne retire que si le champ vaut ceci
 */
export function clearActive(ovrseeDir, session, champ = null, valeur = null) {
  const nom = assainirSession(session) ?? PARTAGE
  const path = cheminEntree(ovrseeDir, nom)

  if (!champ) {
    oublier(path)
    return
  }

  const actuel = lireEntree(path)
  if (!actuel) return
  if (valeur !== null && actuel[champ] !== valeur) return

  const suivant = { ...actuel, [champ]: null }
  if (suivant.plan === null && suivant.ticket === null) oublier(path)
  else ecrire(path, suivant)
}

/**
 * Toutes les sessions qui ont un état, périmées exclues (et purgées au passage).
 *
 * @returns {Array<{session: string, plan: string|null, ticket: string|null}>}
 */
export function allActive(ovrseeDir) {
  migrerAnciensPointeurs(ovrseeDir)

  let noms
  try {
    noms = readdirSync(dossierActif(ovrseeDir))
  } catch {
    return []
  }

  const entrees = []
  for (const nom of noms) {
    if (!nom.endsWith('.json')) continue
    const path = join(dossierActif(ovrseeDir), nom)
    if (perimee(path)) {
      oublier(path)
      continue
    }
    const etat = lireEntree(path)
    if (etat) entrees.push({ session: nom.slice(0, -'.json'.length), ...etat })
  }
  return entrees
}

/** Les plans que quelqu'un capte encore, toutes sessions confondues. */
export function activePlans(ovrseeDir) {
  return [...new Set(allActive(ovrseeDir).map(e => e.plan).filter(Boolean))]
}

/** Attente synchrone : les hooks sont synchrones de bout en bout. */
const dormir = ms => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Exécute `fn` seule sur le dépôt.
 *
 * Ce que ça protège : `updatePlanMeta` et `rewrite` lisent un fichier, le
 * transforment, puis le réécrivent. L'écriture est atomique (tmp + rename),
 * l'intervalle ne l'est pas — deux sessions qui commitent en même temps sur le
 * même plan, et l'une des deux entrées de `commits` disparaît. Même chose pour
 * l'allocation d'un identifiant de ticket, qui lit le dossier et rend le
 * maximum plus un : deux sessions au même instant produisent deux `T-0156`.
 *
 * `mkdir` est l'unique primitive atomique disponible partout, Windows compris.
 *
 * On ne lève jamais : au bout de `ATTENTE_MAX_MS`, on exécute sans le verrou
 * plutôt que de faire échouer un hook. Un verrou abandonné par un processus
 * mort est brisé au bout de `VERROU_PERIME_MS`.
 *
 * ponytail: un verrou pour tout le dépôt. Les sections critiques durent une
 * lecture et une écriture de fichier ; si un jour ça serre, verrou par fichier.
 */
export function withLock(ovrseeDir, fn) {
  // Réentrant : `createTicket` prend le verrou puis appelle `moveTicket`, qui
  // le reprendrait. Sans ce compteur, le processus attendrait son propre verrou
  // jusqu'à la limite avant de passer outre — pas une panne, mais dix secondes
  // d'attente à chaque ticket créé.
  if (tenuPour === ovrseeDir) return fn()

  const verrou = join(dossierActif(ovrseeDir), '.lock')
  mkdirSync(dossierActif(ovrseeDir), { recursive: true })

  let tenu = false
  const limite = Date.now() + ATTENTE_MAX_MS

  while (Date.now() < limite) {
    try {
      mkdirSync(verrou)
      tenu = true
      break
    } catch (err) {
      if (err?.code !== 'EEXIST') break // Verrou impossible à poser : on passe outre.

      if (perimeVerrou(verrou)) {
        try {
          rmdirSync(verrou)
        } catch {
          // Une autre session vient de le briser : le tour suivant le reprendra.
        }
        continue
      }
      dormir(PAS_MS)
    }
  }

  const precedent = tenuPour
  tenuPour = ovrseeDir
  try {
    return fn()
  } finally {
    tenuPour = precedent
    if (tenu) {
      try {
        rmdirSync(verrou)
      } catch {
        // Déjà brisé par une session qui l'a cru périmé : rien à réparer.
      }
    }
  }
}

/** Le dépôt dont ce processus tient déjà le verrou, ou null. */
let tenuPour = null

function perimeVerrou(verrou) {
  try {
    return Date.now() - statSync(verrou).mtimeMs > VERROU_PERIME_MS
  } catch {
    return true // Disparu entre-temps : autant réessayer tout de suite.
  }
}
