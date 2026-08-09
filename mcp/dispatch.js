/**
 * Dispatcher pur pour les outils MCP.
 *
 * Valide le chemin (registre + usableDirectory), appelle les fonctions de
 * hooks/, et formate les résultats pour MCP. Aucun side-effect sur stdout.
 */

import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

// Imports des hooks
import { readRegistry } from '../hooks/plans.js'
import { readPlans } from '../hooks/plans.js'
import { density } from '../hooks/density.js'
import { readTickets, readBoard, createTicket, updateTicket, moveTicket } from '../hooks/tickets.js'
import { snapshot, projects, tableau } from '../hooks/snapshot.js'
import { buildBrief, readCockpit } from '../hooks/brief.js'
import { timeline as buildTimeline } from '../hooks/timeline.js'

/**
 * Valide qu'un chemin est un dossier réel et enregistré au registre.
 * Retourne le chemin s'il est valide, ou un objet d'erreur sinon.
 */
function validatePath(path) {
  // Valider usableDirectory
  if (typeof path !== 'string' || path.length === 0) {
    return { isError: true, code: 400, message: 'Chemin vide' }
  }
  if (!isAbsolute(path)) {
    return { isError: true, code: 400, message: 'Chemin non absolu' }
  }
  if (!existsSync(path)) {
    return { isError: true, code: 400, message: 'Chemin inexistant' }
  }
  let stat
  try {
    stat = lstatSync(path)
  } catch {
    return { isError: true, code: 400, message: 'Impossible de lire le chemin' }
  }
  if (stat.isSymbolicLink()) {
    return { isError: true, code: 400, message: 'Lien symbolique refusé' }
  }
  if (!stat.isDirectory()) {
    return { isError: true, code: 400, message: 'Doit être un dossier' }
  }

  // Valider au registre (sauf pour listProjects)
  const registered = readRegistry().some(p => p.path === path)
  if (!registered) {
    return { isError: true, code: 404, message: 'Projet non enregistré' }
  }

  return { valid: true, path }
}

/**
 * Dispatcher principal. Appelle la fonction appropriée et retourne le résultat.
 *
 * @param {string} method nom de l'outil MCP
 * @param {object} args arguments passés par le client
 * @returns {{content: *} | {isError: true, code: number, message: string}}
 */
export function dispatch(method, args = {}) {
  try {
    switch (method) {
      case 'listProjects': {
        const list = readRegistry()
        return {
          content: list.map(p => ({
            path: p.path,
            name: p.name,
            lastOpened: p.lastOpened,
          })),
        }
      }

      case 'getProjectSummary': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const snap = snapshot(args.path)
          // Compter les plans, tickets, pages (implicitement dans l'objet snapshot)
          return {
            content: {
              path: args.path,
              name: snap.name ?? '',
              equipped: snap.equipped ?? false,
              planCount: snap.plans?.length ?? 0,
              ticketCount: snap.tickets?.length ?? 0,
              pageCount: snap.pageCount ?? 0,
              lastOpened: readRegistry().find(p => p.path === args.path)?.lastOpened,
            },
          }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'getBrief': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const state = readCockpit(args.path)
          if (!state) {
            return { content: '' }
          }
          const brief = buildBrief(state)
          return { content: brief }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'getBoard': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const board = readBoard(cockpitDir)
          return { content: { colonnes: board } }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'listTickets': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const board = readBoard(cockpitDir)
          const tickets = readTickets(cockpitDir, board)
          const limit = args.limit ?? 20
          const sorted = tickets.sort((a, b) => {
            const aDate = new Date(a.meta?.creatDate || 0).getTime()
            const bDate = new Date(b.meta?.creatDate || 0).getTime()
            return bDate - aDate
          })
          return {
            content: sorted.slice(0, limit).map(t => ({
              file: t.file,
              ...t.meta,
            })),
          }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'getPlans': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const plans = readPlans(cockpitDir)
          const limit = args.limit ?? 10
          const sorted = plans.sort((a, b) => {
            const aDate = new Date(a.meta?.dateCreation || 0).getTime()
            const bDate = new Date(b.meta?.dateCreation || 0).getTime()
            return bDate - aDate
          })
          return {
            content: sorted.slice(0, limit).map(p => ({
              file: p.file,
              ...p.meta,
            })),
          }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'getTimeline': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const plans = readPlans(cockpitDir)
          const weeks = args.weeks ?? 16
          // timeline() ne prend que les plans (pas les commits en MCP)
          // On retourne simplement un résumé par semaine
          const tl = buildTimeline([], plans)
          return { content: tl }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'getGraph': {
        const val = validatePath(args.path)
        if (val.isError) return val

        try {
          const graphPath = join(args.path, 'cockpit', 'graphify-out', 'graph.json')
          if (!existsSync(graphPath)) {
            return { content: null }
          }
          const graph = JSON.parse(readFileSync(graphPath, 'utf8'))
          return { content: graph }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'createTicket': {
        const val = validatePath(args.path)
        if (val.isError) return val

        if (!args.titre || typeof args.titre !== 'string') {
          return { isError: true, code: 400, message: 'Titre vide ou invalide' }
        }

        try {
          const cockpitDir = join(args.path, 'cockpit')
          createTicket(cockpitDir, {
            titre: args.titre,
            colonne: args.colonne,
            priorite: args.priorite,
            tags: args.tags,
            plan: args.plan,
            corps: args.corps,
            type: args.type,
            epic: args.epic,
          })
          // Relire le board pour confirmer
          const board = readBoard(cockpitDir)
          return { content: { success: true, board } }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'updateTicket': {
        const val = validatePath(args.path)
        if (val.isError) return val

        if (!args.file) {
          return { isError: true, code: 400, message: 'Fichier manquant' }
        }

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const result = updateTicket(cockpitDir, args.file, args)
          if (!result) {
            return { isError: true, code: 404, message: 'Ticket non trouvé' }
          }
          return { content: { success: true } }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'moveTicket': {
        const val = validatePath(args.path)
        if (val.isError) return val

        if (!args.file || !args.colonne) {
          return { isError: true, code: 400, message: 'Fichier ou colonne manquante' }
        }

        try {
          const cockpitDir = join(args.path, 'cockpit')
          const result = moveTicket(cockpitDir, args.file, args.colonne)
          if (!result) {
            return { isError: true, code: 404, message: 'Ticket ou colonne non trouvé' }
          }
          const board = readBoard(cockpitDir)
          return { content: { success: true, board: { colonnes: board } } }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      case 'archiveTicket': {
        const val = validatePath(args.path)
        if (val.isError) return val

        if (!args.file) {
          return { isError: true, code: 400, message: 'Fichier manquant' }
        }

        try {
          const cockpitDir = join(args.path, 'cockpit')
          // Archiver = déplacer vers la colonne 'terminé'
          const result = moveTicket(cockpitDir, args.file, 'terminé')
          if (!result) {
            return { isError: true, code: 404, message: 'Ticket non trouvé' }
          }
          return { content: { success: true } }
        } catch (err) {
          return { isError: true, code: 400, message: String(err.message) }
        }
      }

      default:
        return { isError: true, code: 400, message: `Outil inconnu : ${method}` }
    }
  } catch (err) {
    return { isError: true, code: 500, message: String(err.message) }
  }
}
