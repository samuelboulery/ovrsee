/**
 * Tests pour config-claude.js
 *
 * Utilise OVRSEE_CONFIG_CLAUDE_DIR pour isoler les tests du ~/.claude/ réel.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { readAgents, readCommands, readPlugins, readHooks, readEnv, readConfigClaude } from './config-claude.js'

const setupTestDir = () => {
  const testDir = mkdtempSync(join(tmpdir(), 'ovrsee-config-test-'))
  process.env.OVRSEE_CONFIG_CLAUDE_DIR = testDir
  return testDir
}

const cleanup = (dir) => {
  delete process.env.OVRSEE_CONFIG_CLAUDE_DIR
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

test('readAgents parses agent frontmatter correctly', () => {
  const testDir = setupTestDir()
  try {
    const agentsDir = join(testDir, 'agents')
    mkdirSync(agentsDir, { recursive: true })

    const agentContent = `---
name: test-agent
description: A test agent
tools: [bash, read]
model: sonnet
timeout: 30
---

This is the body of the agent.
`
    writeFileSync(join(agentsDir, 'test-agent.md'), agentContent)

    const agents = readAgents()

    assert.equal(agents.length, 1)
    assert.equal(agents[0].name, 'test-agent')
    assert.equal(agents[0].description, 'A test agent')
    assert.deepEqual(agents[0].tools, ['bash', 'read'])
    assert.equal(agents[0].model, 'sonnet')
    assert.equal(agents[0].timeout, '30')
  } finally {
    cleanup(testDir)
  }
})

test('readCommands parses command frontmatter correctly', () => {
  const testDir = setupTestDir()
  try {
    const commandsDir = join(testDir, 'commands')
    mkdirSync(commandsDir, { recursive: true })

    const commandContent = `---
name: test-cmd
description: A test command
---

Command body
`
    writeFileSync(join(commandsDir, 'test-cmd.md'), commandContent)

    const commands = readCommands()

    assert.equal(commands.length, 1)
    assert.equal(commands[0].name, 'test-cmd')
    assert.equal(commands[0].description, 'A test command')
  } finally {
    cleanup(testDir)
  }
})

test('readPlugins reads installed_plugins.json', () => {
  const testDir = setupTestDir()
  try {
    const pluginsDir = join(testDir, 'plugins')
    mkdirSync(pluginsDir, { recursive: true })

    const pluginsData = {
      'plugin-a': 'enabled',
      'plugin-b': 'disabled',
    }
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), JSON.stringify(pluginsData))

    const plugins = readPlugins()

    assert.equal(plugins.length, 2)
    const byName = Object.fromEntries(plugins.map(p => [p.name, p.status]))
    assert.equal(byName['plugin-a'], 'enabled')
    assert.equal(byName['plugin-b'], 'disabled')
  } finally {
    cleanup(testDir)
  }
})

test('readHooks structures hooks from settings.json', () => {
  const testDir = setupTestDir()
  try {
    const settingsData = {
      hooks: {
        'SessionStart': [
          {
            matcher: '*',
            hooks: [
              { type: 'command', command: 'echo start' },
            ],
          },
        ],
        'PostToolUse': [
          {
            matcher: 'all',
            hooks: [
              { type: 'javascript', code: 'console.log("hi")' },
            ],
          },
        ],
      },
    }
    writeFileSync(join(testDir, 'settings.json'), JSON.stringify(settingsData))

    const hooks = readHooks()

    assert.ok(hooks['SessionStart'])
    assert.ok(Array.isArray(hooks['SessionStart']))
    assert.equal(hooks['SessionStart'].length, 1)
    assert.equal(hooks['SessionStart'][0].matcher, '*')
    assert.ok(hooks['SessionStart'][0].hooks)
    assert.equal(hooks['SessionStart'][0].hooks[0].type, 'command')

    assert.ok(hooks['PostToolUse'])
    assert.equal(hooks['PostToolUse'][0].matcher, 'all')
    assert.equal(hooks['PostToolUse'][0].hooks[0].type, 'javascript')
  } finally {
    cleanup(testDir)
  }
})

test('readEnv masks all values', () => {
  const testDir = setupTestDir()
  try {
    const settingsData = {
      env: {
        'API_KEY': 'secret-value-12345',
        'DATABASE_URL': 'postgres://user:pass@localhost/db',
      },
    }
    writeFileSync(join(testDir, 'settings.json'), JSON.stringify(settingsData))

    const env = readEnv()

    assert.equal(env['API_KEY'], '****')
    assert.equal(env['DATABASE_URL'], '****')
    assert.ok('API_KEY' in env)
    assert.ok('DATABASE_URL' in env)
  } finally {
    cleanup(testDir)
  }
})

test('readConfigClaude aggregates all config', () => {
  const testDir = setupTestDir()
  try {
    const agentsDir = join(testDir, 'agents')
    mkdirSync(agentsDir, { recursive: true })
    writeFileSync(
      join(agentsDir, 'test-agent.md'),
      '---\nname: agent1\ndescription: Test\n---\nBody'
    )

    const commandsDir = join(testDir, 'commands')
    mkdirSync(commandsDir, { recursive: true })
    writeFileSync(
      join(commandsDir, 'test-cmd.md'),
      '---\nname: cmd1\n---\nBody'
    )

    const settingsData = {
      hooks: {
        'SessionStart': [{ type: 'command' }],
      },
      env: {
        'SECRET_VAR': 'secret',
      },
    }
    writeFileSync(join(testDir, 'settings.json'), JSON.stringify(settingsData))

    const config = readConfigClaude()

    assert.ok(config.agents)
    assert.ok(config.commands)
    assert.ok(config.plugins)
    assert.ok(config.hooks)
    assert.ok(config.env)

    assert.equal(config.agents.length, 1)
    assert.equal(config.commands.length, 1)
    assert.ok(config.hooks['SessionStart'])
    assert.equal(config.env['SECRET_VAR'], '****')
  } finally {
    cleanup(testDir)
  }
})

test('masking respects whitelist for agent properties', () => {
  const testDir = setupTestDir()
  try {
    const agentsDir = join(testDir, 'agents')
    mkdirSync(agentsDir, { recursive: true })

    const agentContent = `---
name: masked-agent
description: Test agent
tools: [bash]
model: sonnet
secret_token: very-secret-value-12345
---

Body
`
    writeFileSync(join(agentsDir, 'masked-agent.md'), agentContent)

    const agents = readAgents()

    assert.equal(agents.length, 1)
    const agent = agents[0]

    assert.equal(agent.name, 'masked-agent')
    assert.equal(agent.description, 'Test agent')
    assert.deepEqual(agent.tools, ['bash'])
    assert.equal(agent.model, 'sonnet')
    assert.equal(agent.secret_token, '****')
  } finally {
    cleanup(testDir)
  }
})

test('gracefully handles missing directories', () => {
  const testDir = setupTestDir()
  try {
    const agents = readAgents()
    const commands = readCommands()
    const plugins = readPlugins()
    const hooks = readHooks()
    const env = readEnv()

    assert.deepEqual(agents, [])
    assert.deepEqual(commands, [])
    assert.deepEqual(plugins, [])
    assert.deepEqual(hooks, {})
    assert.deepEqual(env, {})
  } finally {
    cleanup(testDir)
  }
})

test('handles malformed frontmatter gracefully', () => {
  const testDir = setupTestDir()
  try {
    const agentsDir = join(testDir, 'agents')
    mkdirSync(agentsDir, { recursive: true })

    const agentContent = `---
this is not valid yaml: [incomplete

More invalid stuff
---

Body
`
    writeFileSync(join(agentsDir, 'bad-agent.md'), agentContent)

    const agents = readAgents()
    assert.ok(Array.isArray(agents))
  } finally {
    cleanup(testDir)
  }
})

test('hook structure is preserved with scalars masked', () => {
  const testDir = setupTestDir()
  try {
    const settingsData = {
      hooks: {
        'SessionStart': [
          {
            matcher: 'workspace1',
            hooks: [
              {
                type: 'command',
                command: 'node /path/to/script.js',
                internal_token: 'secret-12345',
              },
            ],
          },
        ],
        'PostToolUse': [
          {
            matcher: 'eslint',
            hooks: [
              {
                type: 'javascript',
                code: 'console.log("checking")',
                api_key: 'hidden-secret',
              },
            ],
          },
        ],
      },
    }
    writeFileSync(join(testDir, 'settings.json'), JSON.stringify(settingsData))

    const hooks = readHooks()

    // Structure doit être préservée
    assert.ok(hooks['SessionStart'])
    assert.ok(Array.isArray(hooks['SessionStart']))
    assert.equal(hooks['SessionStart'].length, 1)

    const hookItem = hooks['SessionStart'][0]
    // Clé matcher doit être visible (blanche)
    assert.equal(hookItem.matcher, 'workspace1')
    // Tableau hooks doit être préservé
    assert.ok(hookItem.hooks)
    const hook = hookItem.hooks[0]
    // Clés blanches doivent être visibles
    assert.equal(hook.type, 'command')
    assert.equal(hook.command, 'node /path/to/script.js')
    // Clés non blanches doivent être masquées
    assert.equal(hook.internal_token, '****')

    // Autre matcher
    assert.ok(hooks['PostToolUse'])
    const hookItem2 = hooks['PostToolUse'][0]
    assert.equal(hookItem2.matcher, 'eslint')
    const hook2 = hookItem2.hooks[0]
    assert.equal(hook2.type, 'javascript')
    assert.equal(hook2.api_key, '****')
  } finally {
    cleanup(testDir)
  }
})

test('nested secrets in hooks are masked while preserving structure', () => {
  const testDir = setupTestDir()
  try {
    const settingsData = {
      hooks: {
        'CustomEvent': [
          {
            matcher: 'test',
            hooks: [
              {
                type: 'command',
                command: 'npm run test',
                config: {
                  description: 'test config',
                  secret_url: 'https://api.example.com/secret',
                  nested_config: {
                    description: 'nested description',
                    auth_token: 'hidden-12345',
                  },
                },
              },
            ],
          },
        ],
      },
    }
    writeFileSync(join(testDir, 'settings.json'), JSON.stringify(settingsData))

    const hooks = readHooks()
    const hookItem = hooks['CustomEvent'][0]
    const hook = hookItem.hooks[0]

    // Structure préservée
    assert.ok(hook.config)
    assert.ok(hook.config.nested_config)
    // Clés blanches visibles
    assert.equal(hook.config.description, 'test config')
    assert.equal(hook.config.nested_config.description, 'nested description')
    // Clés non blanches masquées
    assert.equal(hook.config.secret_url, '****')
    assert.equal(hook.config.nested_config.auth_token, '****')
  } finally {
    cleanup(testDir)
  }
})
