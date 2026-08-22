/**
 * Dispatcher pur pour les outils MCP.
 *
 * Ne décide de rien lui-même : chaque outil est un appel à `resolve()` de
 * `server/api.js`, la même fonction que le middleware Vite et le protocole
 * `ovrsee://` d'Electron. C'est l'invariant du projet — trois implémentations
 * divergeraient, et les bugs ne se verraient que dans certains modes.
 *
 * Ce qui reste ici n'est donc que de la traduction : un nom d'outil vers une
 * route, et un corps de réponse vers un résultat d'outil. Aucun side-effect sur
 * stdout : c'est `mcp/server.js` qui écrit.
 */

import { basename } from 'node:path'

import { resolve, usableDirectory } from '../server/api.js'
import { buildBrief, intention, readOvrsee } from '../hooks/brief.js'

/**
 * Origine factice. `resolve()` ne lit que `pathname` et `searchParams` ; en
 * stdio il n'y a pas d'hôte, mais `URL` en exige un.
 */
const ORIGINE = 'http://ovrsee'

/**
 * Un appel à `resolve()`, traduit en résultat d'outil.
 *
 * `cwd` vide est délibéré : dans une session stdio il n'y a pas de dépôt
 * courant, et seul le registre doit faire liste blanche. L'en-tête `X-Ovrsee`
 * est la parade CORS du dev server — sans objet ici, mais `resolve()` l'exige
 * pour toute écriture, et la lui donner vaut mieux que la rendre optionnelle.
 *
 * @param {string} route
 * @param {string | null} chemin projet, ajouté en `?path=` s'il est fourni
 * @param {{method?: string, body?: unknown}} [requete]
 */
function appel(route, chemin = null, requete = {}) {
  const url = new URL(route, ORIGINE)
  if (chemin) url.searchParams.set('path', chemin)

  const out = resolve(url, '', { headers: { 'x-ovrsee': '1' }, ...requete })

  // `null` veut dire « pas notre route » côté HTTP. Ici, c'est une faute de
  // programmation dans la table ci-dessous, pas une requête d'un client.
  if (!out) return { isError: true, code: 500, message: `Route absente : ${route}` }
  if (typeof out.status === 'number' && out.status >= 400) {
    return { isError: true, code: out.status, message: String(out.json?.error ?? 'erreur') }
  }
  return { content: out.json }
}

/**
 * Refuse un chemin avant d'aller plus loin, ou `null` s'il passe.
 *
 * `resolve()` applique déjà la liste blanche du registre sur ses routes, mais
 * `getBrief` n'en a pas : la garde vit donc ici pour que tous les outils la
 * subissent. Le lien symbolique et le chemin relatif s'ajoutent en défense en
 * profondeur — un projet enregistré ne devrait jamais être un lien, et s'il
 * l'est on ne le suit pas.
 */
function refus(chemin) {
  if (typeof chemin !== 'string' || chemin.length === 0) {
    return { isError: true, code: 400, message: 'Chemin vide' }
  }
  if (!usableDirectory(chemin)) {
    return { isError: true, code: 400, message: 'Chemin inutilisable : absolu, dossier réel, sans lien' }
  }

  const liste = appel('/api/projects')
  if (liste.isError) return liste
  if (!liste.content.some(p => p.path === chemin)) {
    return { isError: true, code: 404, message: 'Projet non enregistré' }
  }
  return null
}

/** Le snapshot d'un projet, ou l'erreur qui l'empêche. */
const projet = chemin => appel('/api/project', chemin)

/** Le graphe d'un projet — hors du snapshot depuis T-0134. */
const graphe = chemin => appel('/api/graph', chemin)

/**
 * Le tri décroissant sur une date de frontmatter, puis les N premiers.
 *
 * Les noms de champs ne sont pas interchangeables : un ticket porte `cree`, un
 * plan porte `opened`. Trier sur un champ absent ne lève rien — ça rend
 * simplement l'ordre du dossier en se faisant passer pour une chronologie.
 */
const derniers = (liste, champ, limite) =>
  [...(liste ?? [])]
    .sort((a, b) => String(b?.[champ] ?? '').localeCompare(String(a?.[champ] ?? '')))
    .slice(0, limite)

/**
 * Le corps d'un plan ou d'un ticket, retiré sauf demande explicite.
 *
 * Un plan pèse jusqu'à 26 ko, un ticket quelques milliers d'octets : dix plans
 * renvoyés entiers, c'est une réponse d'outil de vingt mille jetons pour une
 * question qui portait le plus souvent sur des titres et des dates. Le corps
 * reste accessible — il faut le demander.
 *
 * Un plan sans son corps garde quand même de quoi se reconnaître : `intention`
 * en donne la première phrase, celle que le brief affiche déjà.
 *
 * @param {Array} liste
 * @param {boolean} full
 * @param {'body' | 'corps'} champ nom du corps — un plan porte `body`, un ticket `corps`
 */
const sansCorps = (liste, full, champ) =>
  full
    ? liste
    : liste.map(item => {
        const { [champ]: body, ...reste } = item
        return champ === 'body' ? { ...reste, intention: intention({ body }) } : reste
      })

/**
 * Un outil = une fonction du chemin et des arguments vers un résultat.
 * Toutes reçoivent un chemin déjà validé, sauf `listProjects` qui n'en prend pas.
 */
const OUTILS = {
  listProjects: () => appel('/api/projects'),

  getProjectSummary: chemin => {
    const snap = projet(chemin)
    if (snap.isError) return snap

    const liste = appel('/api/projects')
    const entree = liste.isError ? null : liste.content.find(p => p.path === chemin)

    return {
      content: {
        path: chemin,
        name: entree?.name ?? basename(chemin),
        equipped: snap.content.equipped,
        planCount: snap.content.plans?.length ?? 0,
        ticketCount: snap.content.tickets?.length ?? 0,
        pageCount: snap.content.pages?.pages?.length ?? 0,
        lastOpened: entree?.lastOpened ?? null,
      },
    }
  },

  // La seule lecture qui n'a pas de route : le brief est un texte composé pour
  // le terminal, que l'interface ne demande jamais au serveur. Le composer ici
  // ne duplique aucune logique de `resolve()`.
  getBrief: chemin => {
    const state = readOvrsee(chemin)
    return { content: state ? buildBrief(state) : '' }
  },

  getBoard: chemin => {
    const snap = projet(chemin)
    return snap.isError ? snap : { content: { colonnes: snap.content.board } }
  },

  listTickets: (chemin, args) => {
    const snap = projet(chemin)
    return snap.isError
      ? snap
      : {
          content: sansCorps(
            derniers(snap.content.tickets, 'cree', args.limit ?? 20),
            args.full === true,
            'corps',
          ),
        }
  },

  getPlans: (chemin, args) => {
    const snap = projet(chemin)
    return snap.isError
      ? snap
      : {
          content: sansCorps(
            derniers(snap.content.plans, 'opened', args.limit ?? 10),
            args.full === true,
            'body',
          ),
        }
  },

  getTimeline: chemin => {
    const snap = projet(chemin)
    return snap.isError ? snap : { content: snap.content.timeline }
  },

  // Le blob de graphify pèse 708 ko, soit ~177 000 jetons : un seul appel
  // remplissait 18 % d'un contexte d'un million. La description de l'outil
  // avertissait déjà du volume — un avertissement ne suffit pas quand la
  // réponse est déjà dans le contexte au moment où on le lit. D'où un résumé
  // par défaut, et le blob seulement sur `full`.
  getGraph: (chemin, args) => {
    const snap = graphe(chemin)
    if (snap.isError) return snap

    const graph = snap.content.graph
    if (args.full === true) return { content: { graph, graphSource: snap.content.graphSource } }

    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
    const communautes = [...new Set(nodes.map(n => n?.community).filter(c => c != null))].sort()

    return {
      content: {
        graphSource: snap.content.graphSource,
        resume: graph
          ? {
              nodeCount: nodes.length,
              linkCount: Array.isArray(graph.links) ? graph.links.length : 0,
              hyperedgeCount: Array.isArray(graph.hyperedges) ? graph.hyperedges.length : 0,
              communautes,
              note: 'Résumé. Passer { full: true } pour le graphe entier (~177 000 jetons).',
            }
          : null,
      },
    }
  },

  createTicket: (chemin, args) => {
    if (typeof args.titre !== 'string' || args.titre.trim().length === 0) {
      return { isError: true, code: 400, message: 'Titre vide ou invalide' }
    }
    return ecriture(chemin, { ...args, action: 'create' })
  },

  updateTicket: (chemin, args) => {
    if (!args.file) return { isError: true, code: 400, message: 'Fichier manquant' }
    return ecriture(chemin, { ...args, action: 'update' })
  },

  moveTicket: (chemin, args) => {
    if (!args.file || !args.colonne) {
      return { isError: true, code: 400, message: 'Fichier ou colonne manquante' }
    }
    return ecriture(chemin, { ...args, action: 'move' })
  },
}

/**
 * Écriture d'un ticket. `resolve()` rend le tableau complet après chaque geste ;
 * on n'en garde que la confirmation et les colonnes, parce qu'un client MCP
 * paierait le texte de tous les tickets pour un champ qui change.
 */
function ecriture(chemin, body) {
  const out = appel('/api/tickets', chemin, { method: 'POST', body: { ...body, path: chemin } })
  return out.isError ? out : { content: { success: true, board: { colonnes: out.content.board } } }
}

/**
 * Dispatcher principal.
 *
 * @param {string} outil nom de l'outil MCP
 * @param {object} args arguments passés par le client
 * @returns {{content: *} | {isError: true, code: number, message: string}}
 */
/**
 * Au-delà, ce n'est plus un argument d'outil : c'est un corps de ticket qui a
 * dérapé. Le seuil est large — un ticket réel n'en approche pas le dixième.
 */
const ARG_MAX = 100_000

/**
 * Une chaîne d'argument dépasse-t-elle la borne ?
 *
 * Les `maxLength` du schéma annoncé (`mcp/server.js`) sont une indication
 * donnée au modèle, pas une garde : rien n'oblige un appelant à les respecter.
 * La garde est ici, du côté qui écrit sur le disque.
 */
const tropLong = valeur => {
  if (typeof valeur === 'string') return valeur.length > ARG_MAX
  if (Array.isArray(valeur)) return valeur.some(tropLong)
  return false
}

export function dispatch(outil, args = {}) {
  const fn = OUTILS[outil]
  if (!fn) return { isError: true, code: 400, message: `Outil inconnu : ${outil}` }

  const enorme = Object.entries(args ?? {}).find(([, valeur]) => tropLong(valeur))
  if (enorme) {
    return { isError: true, code: 400, message: `Argument trop long : ${enorme[0]}` }
  }

  try {
    if (outil === 'listProjects') return fn()

    const nonValide = refus(args.path)
    if (nonValide) return nonValide

    return fn(args.path, args)
  } catch (err) {
    return { isError: true, code: 500, message: String(err.message ?? err) }
  }
}
