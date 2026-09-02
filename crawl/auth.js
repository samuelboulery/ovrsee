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

import { spawn } from 'node:child_process'

import { git } from '../hooks/git.js'
import { createInterface } from 'node:readline/promises'
import { chmodSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { chromium } from 'playwright-core'

import { cleanEnv, shellRun } from '../hooks/shell.js'
import { assurerConfiance, DEV_DEFAUT } from './confiance.js'

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
    git(root, ['check-ignore', '-q', statePath], { stdio: 'ignore' })
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

  // Deuxième site d'exécution de la commande `dev`, et celui qu'aucune
  // interface n'appelle — donc celui qu'on oublie. La garde y est la même que
  // dans `crawl/index.js`, et porte sur la chaîne exacte passée à `shellRun`.
  // Ici un humain est toujours devant : la question se pose en TTY.
  const dev = config.dev ?? DEV_DEFAUT
  await assurerConfiance(root, dev)

  // Même invocation que le crawl (`crawl/index.js`), et pour les mêmes deux
  // raisons : `sh -c` n'a pas le PATH de pnpm hors d'un terminal, et une
  // commande `dev` qui meurt sous `stdio: 'ignore'` ne laisse rien à lire — on
  // cherche alors le problème dans le projet observé.
  const [fichier, args, options] = shellRun(dev)
  const app = spawn(fichier, args, {
    ...options,
    cwd: root,
    env: cleanEnv(),
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  app.on('error', err => console.error(`commande dev : ${err?.message ?? err}`))
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

    const cible = join(root, statePath)
    await context.storageState({ path: cible })
    // Playwright écrit sous l'umask courant, soit 0644 en général. Le fichier
    // porte un jeton de session valide : le refuser à git ne suffit pas s'il
    // reste lisible par un autre compte de la machine.
    chmodSync(cible, 0o600)
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
