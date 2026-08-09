/**
 * Serveur MCP stdio pour Cockpit.
 *
 * Lit JSON-RPC 2.0 depuis stdin, valide le protocole, appelle `dispatch()`,
 * et envoie les résultats sur stdout. Aucune dépendance externe.
 *
 * Format JSON-RPC 2.0 :
 * - Demande : { jsonrpc: "2.0", id?: <number|string>, method: <string>, params?: <any> }
 * - Réponse : { jsonrpc: "2.0", id: <number|string>, result?: <any>, error?: {code, message} }
 */

import { dispatch } from './dispatch.js'
import { createInterface } from 'node:readline'

const rl = createInterface({
  input: process.stdin,
  output: null,
  terminal: false,
})

/**
 * @param {*} id
 * @param {*} result
 */
function sendResponse(id, result) {
  if (result?.isError) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code: result.code ?? -32603,
        message: result.message ?? 'Erreur interne',
      },
    }))
  } else {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: result?.content ?? result ?? null,
    }))
  }
}

rl.on('line', (line) => {
  let request
  try {
    request = JSON.parse(line)
  } catch {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'JSON invalide' },
    }))
    return
  }

  const { jsonrpc, id, method, params } = request
  if (jsonrpc !== '2.0' || !method) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32600, message: 'Requête invalide' },
    }))
    return
  }

  // Pas de notification pour l'instant.
  if (id === undefined) return

  try {
    if (method === 'initialize') {
      sendResponse(id, {
        content: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'cockpit-mcp', version: '1.0.0' },
        },
      })
    } else if (method === 'tools/list') {
      sendResponse(id, {
        content: {
          tools: [
            {
              name: 'listProjects',
              description: 'Énumère les projets enregistrés',
              inputSchema: { type: 'object', properties: {}, required: [] },
            },
            {
              name: 'getProjectSummary',
              description: 'Résumé d\'un projet : compteurs, dates, statut',
              inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
            {
              name: 'getBrief',
              description: 'Texte du brief d\'un projet',
              inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
            {
              name: 'getBoard',
              description: 'Structure des colonnes d\'un projet',
              inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
            {
              name: 'listTickets',
              description: 'N derniers tickets d\'un projet',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  limit: { type: 'number', default: 20 },
                },
                required: ['path'],
              },
            },
            {
              name: 'getPlans',
              description: 'N derniers plans d\'un projet',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  limit: { type: 'number', default: 10 },
                },
                required: ['path'],
              },
            },
            {
              name: 'getTimeline',
              description: 'Chronologie des commits d\'un projet',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  weeks: { type: 'number', default: 16 },
                },
                required: ['path'],
              },
            },
            {
              name: 'getGraph',
              description: 'Graphe de dépendances complet (~384 KB)',
              inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
            {
              name: 'createTicket',
              description: 'Crée un ticket',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  titre: { type: 'string' },
                  colonne: { type: 'string' },
                  priorite: { type: 'string' },
                  tags: { type: 'array' },
                  plan: { type: 'string' },
                  corps: { type: 'string' },
                  type: { type: 'string' },
                  epic: { type: 'string' },
                },
                required: ['path', 'titre'],
              },
            },
            {
              name: 'updateTicket',
              description: 'Met à jour un ticket',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  file: { type: 'string' },
                },
                required: ['path', 'file'],
              },
            },
            {
              name: 'moveTicket',
              description: 'Déplace un ticket vers une colonne',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  file: { type: 'string' },
                  colonne: { type: 'string' },
                },
                required: ['path', 'file', 'colonne'],
              },
            },
            {
              name: 'archiveTicket',
              description: 'Archive un ticket (déplace vers colonne terminée)',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  file: { type: 'string' },
                },
                required: ['path', 'file'],
              },
            },
          ],
        },
      })
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params ?? {}
      const result = dispatch(name, args || {})
      sendResponse(id, result)
    } else {
      sendResponse(id, {
        isError: true,
        code: -32601,
        message: 'Méthode non trouvée',
      })
    }
  } catch (err) {
    console.error('[ERR]', err.message || err)
    sendResponse(id, {
      isError: true,
      code: -32603,
      message: 'Erreur interne du serveur',
    })
  }
})

rl.on('error', (err) => {
  console.error('[ERR]', err.message || err)
  process.exit(1)
})
