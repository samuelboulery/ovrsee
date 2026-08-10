#!/usr/bin/env node
/**
 * Enregistre une session pour que le crawl atteigne les pages protégées.
 *
 *   node crawl/auth.js [chemin-du-dépôt]
 *
 * Ouvre un navigateur VISIBLE sur l'application, laisse l'utilisateur se
 * connecter à la main, puis enregistre l'état de session (cookies et
 * localStorage) dans le fichier déclaré par `auth.storageState`.
 *
 * Aucun identifiant ne transite par ce script et aucun n'est stocké en clair :
 * seul le jeton de session résultant est écrit, dans un fichier que le crawl
 * exige de voir ignoré par git avant de l'utiliser.
 */

import { execFileSync, spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { chromium } from 'playwright-core'

const root = resolve(process.argv[2] ?? process.cwd())
const config = JSON.parse(readFileSync(join(root, 'ovrsee.config.json'), 'utf8'))

const statePath = config.auth?.storageState
if (!statePath) {
  console.error('ovrsee.config.json ne déclare pas auth.storageState — rien à enregistrer.')
  process.exit(1)
}

/**
 * Sécurité : ce fichier contient un jeton de session valide. Refuser de le
 * créer tant qu'il n'est pas ignoré par git est la seule protection efficace —
 * une fois committé, il est dans l'historique pour de bon.
 */
function assertIgnored() {
  try {
    execFileSync('git', ['check-ignore', '-q', statePath], { cwd: root, stdio: 'ignore' })
  } catch {
    console.error(
      `\n${statePath} n'est pas ignoré par git.\n` +
        `Il contiendra un jeton de session valide. Ajoutez-le au .gitignore avant de continuer :\n\n` +
        `  echo '${statePath}' >> ${join(root, '.gitignore')}\n`,
    )
    process.exit(1)
  }
}

async function main() {
  assertIgnored()

  const app = spawn(config.dev, { cwd: root, shell: true, stdio: 'ignore', detached: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: false })

  try {
    const context = await browser.newContext({ viewport: config.viewport ?? null })
    const page = await context.newPage()

    // Attente simple : l'utilisateur est devant l'écran, il verra la page se
    // charger. Pas besoin de sonder le serveur.
    await page.goto(config.baseUrl, { waitUntil: 'load', timeout: 120_000 }).catch(() => {})

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    console.log(`\nConnectez-vous dans la fenêtre ouverte sur ${config.baseUrl}.`)
    await rl.question('Une fois connecté, appuyez sur Entrée pour enregistrer la session… ')
    rl.close()

    await context.storageState({ path: join(root, statePath) })
    console.log(`session enregistrée dans ${statePath}`)
    console.log('Le prochain crawl atteindra les pages protégées.')
  } finally {
    await browser.close().catch(() => {})
    if (app.pid) {
      try {
        process.kill(-app.pid, 'SIGTERM')
      } catch {
        app.kill('SIGTERM')
      }
    }
  }
}

main().catch(err => {
  console.error(`échec : ${err?.message ?? err}`)
  process.exit(1)
})
