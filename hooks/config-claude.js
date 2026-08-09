/**
 * Lecture de la configuration Claude Code.
 *
 * Lit agents, commands, plugins, hooks et variables d'env depuis `~/.claude/`
 * et `~/.claude/settings.json`, en appliquant un masquage des secrets côté
 * serveur avant que la route ne réponde. Aucun secret ne doit traverser l'API.
 *
 * Utilise `COCKPIT_CONFIG_CLAUDE_DIR` pour les tests — le même pattern que
 * `COCKPIT_SKILLS_DIR` dans `skills.js`.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Où Claude Code stocke sa configuration. */
const configDir = () =>
  process.env.COCKPIT_CONFIG_CLAUDE_DIR ?? join(homedir(), '.claude')

/**
 * Liste blanche de clés dont les valeurs scalaires peuvent être affichées.
 * Pour les conteneurs (objets, tableaux), on parcourt toujours en profondeur.
 */
const WHITELIST_KEYS = new Set([
  'name',
  'description',
  'tools',
  'model',
  'type',
  'timeout',
  'command',
  'statusMessage',
  'matcher',
])

/**
 * Masque les valeurs scalaires non blanches par "****".
 * Les conteneurs se parcourent toujours en profondeur.
 * Les clés elles-mêmes restent toujours visibles.
 *
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function maskSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(item => maskSecrets(item))

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    // Conteneurs (objets, tableaux) : toujours parcourir en profondeur
    if (value !== null && typeof value === 'object') {
      result[key] = Array.isArray(value)
        ? value.map(item => (item !== null && typeof item === 'object' ? maskSecrets(item) : item))
        : maskSecrets(value)
    } else {
      // Scalaires : masquer si clé non blanche
      result[key] = WHITELIST_KEYS.has(key) ? value : '****'
    }
  }
  return result
}

/**
 * Parse le frontmatter YAML minimal d'un fichier markdown.
 * Retourne l'objet parsé, ou null si pas de frontmatter.
 *
 * @param {string} content
 * @returns {Record<string, unknown> | null}
 */
function parseFrontmatter(content) {
  const lines = content.split('\n')
  if (lines[0] !== '---') return null

  let endIdx = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) return null

  const frontmatterText = lines.slice(1, endIdx).join('\n')
  const result = {}

  const frontLines = frontmatterText.split('\n')
  for (let i = 0; i < frontLines.length; i += 1) {
    const line = frontLines[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (/^\s/.test(line)) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    if (key.length === 0) continue

    const rawValue = line.slice(colonIdx + 1).trim()

    // Handle inline lists [a, b]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const items = rawValue
        .slice(1, -1)
        .split(',')
        .map(s => {
          const trimmed = s.trim()
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1)
          }
          if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
            return trimmed.slice(1, -1)
          }
          return trimmed
        })
        .filter(item => item.length > 0)
      result[key] = items
    } else if (rawValue.length > 0) {
      // Scalar value
      let value = rawValue
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      result[key] = value
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

/**
 * Lit les agents d'Obsidian.
 *
 * @returns {Array<{name: string, description?: string, tools?: string[], model?: string, timeout?: number}>}
 */
export function readAgents() {
  const agentsPath = join(configDir(), 'agents')
  if (!existsSync(agentsPath)) return []

  const agents = []
  try {
    const files = readdirSync(agentsPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const filePath = join(agentsPath, file)
      try {
        const content = readFileSync(filePath, 'utf8')
        const frontmatter = parseFrontmatter(content)
        if (frontmatter) {
          const name = file.replace(/\.md$/, '')
          agents.push({
            name,
            ...maskSecrets(frontmatter),
          })
        }
      } catch {
        // Ignore unreadable files
      }
    }
  } catch {
    // Ignore if agents directory is unreadable
  }

  return agents
}

/**
 * Lit les commands.
 *
 * @returns {Array<{name: string, description?: string}>}
 */
export function readCommands() {
  const commandsPath = join(configDir(), 'commands')
  if (!existsSync(commandsPath)) return []

  const commands = []
  try {
    const files = readdirSync(commandsPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const filePath = join(commandsPath, file)
      try {
        const content = readFileSync(filePath, 'utf8')
        const frontmatter = parseFrontmatter(content)
        if (frontmatter) {
          const name = file.replace(/\.md$/, '')
          commands.push({
            name,
            ...maskSecrets(frontmatter),
          })
        }
      } catch {
        // Ignore unreadable files
      }
    }
  } catch {
    // Ignore if commands directory is unreadable
  }

  return commands
}

/**
 * Lit le statut des plugins depuis `installed_plugins.json`.
 *
 * @returns {Array<{name: string, status: string}>}
 */
export function readPlugins() {
  const pluginsPath = join(configDir(), 'plugins', 'installed_plugins.json')
  if (!existsSync(pluginsPath)) return []

  try {
    const content = readFileSync(pluginsPath, 'utf8')
    const data = JSON.parse(content)
    if (data && typeof data === 'object') {
      return Object.entries(data).map(([name, status]) => ({
        name,
        status: String(status),
      }))
    }
  } catch {
    // Ignore if file is unreadable or invalid JSON
  }

  return []
}

/**
 * Lit et structure les hooks depuis settings.json.
 *
 * Retourne un objet : matcher → la structure des hooks masquée en profondeur
 * Ex: { SessionStart: { hooks: [{type: 'command', matcher: '...', command: 'node'}] } }
 *
 * @returns {Record<string, unknown>}
 */
export function readHooks() {
  const settingsPath = join(configDir(), 'settings.json')
  if (!existsSync(settingsPath)) return {}

  try {
    const content = readFileSync(settingsPath, 'utf8')
    const settings = JSON.parse(content)
    const hooks = settings.hooks || {}

    // Appliquer maskSecrets sur la structure entière pour préserver les conteneurs
    return maskSecrets(hooks)
  } catch {
    // Ignore if settings.json is unreadable
    return {}
  }
}

/**
 * Lit les variables d'env depuis settings.json.
 * Les noms de clés sont affichés, les valeurs masquées systématiquement.
 *
 * @returns {Record<string, string>}
 */
export function readEnv() {
  const settingsPath = join(configDir(), 'settings.json')
  if (!existsSync(settingsPath)) return {}

  try {
    const content = readFileSync(settingsPath, 'utf8')
    const settings = JSON.parse(content)
    const env = settings.env || {}

    const result = {}
    for (const key of Object.keys(env)) {
      result[key] = '****'
    }

    return result
  } catch {
    // Ignore if settings.json is unreadable
    return {}
  }
}

/**
 * Agrège toute la configuration Claude Code.
 *
 * @returns {{agents: Array, commands: Array, plugins: Array, hooks: Record, env: Record}}
 */
export function readConfigClaude() {
  return {
    agents: readAgents(),
    commands: readCommands(),
    plugins: readPlugins(),
    hooks: readHooks(),
    env: readEnv(),
  }
}
