/**
 * Serveur MCP stdio pour Ovrsee.
 *
 * Lit JSON-RPC 2.0 depuis stdin, valide le protocole, appelle `dispatch()`,
 * et envoie les résultats sur stdout. Aucune dépendance externe.
 *
 * Format JSON-RPC 2.0 :
 * - Demande : { jsonrpc: "2.0", id?: <number|string>, method: <string>, params?: <any> }
 * - Réponse : { jsonrpc: "2.0", id: <number|string>, result?: <any>, error?: {code, message} }
 *
 * stdout est le transport, pas un journal : rien d'autre que du JSON-RPC ne doit
 * y être écrit, sous peine de couper la conversation au milieu. Les traces vont
 * sur stderr.
 */

import { dispatch } from './dispatch.js'
import { createInterface } from 'node:readline'

const rl = createInterface({
  input: process.stdin,
  output: null,
  terminal: false,
})

/** Les outils annoncés, dans l'ordre où ils se lisent. */
const TOOLS = [
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
    description: 'N derniers tickets d\'un projet, métadonnées seules (titre, colonne, priorité, dates). Passer full:true pour le corps de chaque ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        limit: { type: 'number', default: 20 },
        full: { type: 'boolean', default: false, description: 'Inclure le corps markdown — réponse nettement plus volumineuse' },
      },
      required: ['path'],
    },
  },
  {
    name: 'getPlans',
    description: 'N derniers plans d\'un projet, métadonnées + première phrase de l\'intention. Passer full:true pour le corps entier (~2 000 jetons par plan).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        limit: { type: 'number', default: 10 },
        full: { type: 'boolean', default: false, description: 'Inclure le corps markdown de chaque plan' },
      },
      required: ['path'],
    },
  },
  {
    name: 'getTimeline',
    description: 'Chronologie des commits d\'un projet, par semaine',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'getGraph',
    description: 'Résumé du graphe de dépendances : nombre de nœuds, de liens, liste des communautés. Passer full:true pour le graphe entier — plusieurs centaines de ko, ~177 000 jetons.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        full: { type: 'boolean', default: false, description: 'Renvoie le graphe entier au lieu du résumé' },
      },
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
        charge: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
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
        titre: { type: 'string' },
        colonne: { type: 'string' },
        priorite: { type: 'string' },
        charge: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        corps: { type: 'string' },
      },
      required: ['path', 'file'],
    },
  },
  {
    name: 'moveTicket',
    description: 'Déplace un ticket vers une colonne — sert aussi à archiver',
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
]

/** Une réponse JSON-RPC réussie. */
function sendResult(id, result) {
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result }))
}

/**
 * Une erreur JSON-RPC — réservée aux fautes de *protocole*.
 *
 * Un outil qui refuse un chemin n'est pas une faute de protocole : la spec veut
 * qu'il réponde un résultat marqué `isError`, pour que le modèle lise le motif
 * du refus au lieu de voir l'appel disparaître. Voir `toolResult`.
 */
function sendError(id, code, message) {
  console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }))
}

/**
 * Le résultat d'un outil, à la forme que la spec MCP impose : une liste de blocs
 * de contenu, jamais la donnée nue. C'est ce que `dispatch()` ne peut pas
 * produire seul — il ne connaît pas le transport.
 *
 * @param {{content: *} | {isError: true, code: number, message: string}} out
 */
function toolResult(out) {
  if (out?.isError) {
    return { content: [{ type: 'text', text: `Erreur ${out.code} : ${out.message}` }], isError: true }
  }
  const data = out?.content
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? null)
  return { content: [{ type: 'text', text }] }
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
    sendError(id, -32600, 'Requête invalide')
    return
  }

  // Une demande sans `id` est une notification : la spec interdit d'y répondre.
  if (id === undefined) return

  try {
    if (method === 'initialize') {
      sendResult(id, {
        protocolVersion: '2024-11-05',
        // `tools` doit être déclaré : un client conforme n'appelle `tools/list`
        // que si le serveur annonce cette capacité. Un objet vide suffit —
        // aucune option (comme `listChanged`) n'est proposée.
        capabilities: { tools: {} },
        serverInfo: { name: 'ovrsee-mcp', version: '1.0.0' },
      })
    } else if (method === 'tools/list') {
      sendResult(id, { tools: TOOLS })
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params ?? {}
      sendResult(id, toolResult(dispatch(name, args || {})))
    } else {
      sendError(id, -32601, 'Méthode non trouvée')
    }
  } catch (err) {
    console.error('[ERR]', err.message || err)
    sendError(id, -32603, 'Erreur interne du serveur')
  }
})

rl.on('error', (err) => {
  console.error('[ERR]', err.message || err)
  process.exit(1)
})
