#!/usr/bin/env node
/**
 * Enregistre une session pour que le crawl atteigne les pages protégées.
 *
 *   node crawl/auth.js [chemin-du-dépôt]
 *
 * Ouvre un navigateur VISIBLE sur l'application, laisse l'utilisateur se
 * connecter à la main, puis enregistre l'état de session (cookies et
 * localStorage) hors du dépôt, dans `~/.claude/ovrsee/auth/` (T-0275).
 *
 * Aucun identifiant ne transite par ce script et aucun n'est stocké en clair :
 * seul le jeton de session résultant est écrit, lisible par son seul
 * propriétaire. Le dépôt n'en contient jamais un octet — ni `.gitignore` à
 * tenir, ni `git add -f` à craindre.
 */

import { spawn } from 'node:child_process'

import { createInterface } from 'node:readline/promises'
import { join, resolve } from 'node:path'

import { lancerChrome } from './chrome.js'

import { cleanEnv, killTree, shellRun } from '../hooks/shell.js'
import { assurerConfiance, DEV_DEFAUT } from './confiance.js'
import { ecrireSession, sessionPath } from './session.js'
import { urlLocale } from './routes.js'
import { readJsonDuDepot } from '../hooks/json.js'

const root = resolve(process.argv[2] ?? process.cwd())
const config = readJsonDuDepot(root, join(root, 'ovrsee.config.json'))
if (!config || typeof config !== 'object') {
  console.error('ovrsee.config.json absent ou illisible.')
  process.exit(1)
}
// Même borne que le crawl : le navigateur ne s'ouvre que sur ce poste.
if (!urlLocale(config.baseUrl)) {
  console.error('baseUrl refusé : le crawl ne vise que ce poste (localhost, 127.0.0.1, ::1).')
  process.exit(1)
}

async function main() {
  // Deuxième site d'exécution de la commande `dev`, et celui qu'aucune
  // interface n'appelle — donc celui qu'on oublie. La garde y est la même que
  // dans `crawl/index.js`, et porte sur la chaîne exacte passée à `shellRun`.
  // Ici un humain est toujours devant : la question se pose en TTY.
  const dev = config.dev ?? DEV_DEFAUT
  await assurerConfiance(root, dev)

  // Avant `dev` : un Chrome absent ne doit pas laisser derrière lui un
  // serveur lancé pour rien (T-0283).
  const browser = await lancerChrome({ headless: false })

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
    // `detached` est déjà dans `options` : `shellRun` le décide par plateforme,
    // et le forcer ici renvoyait sous Windows la sortie de `dev` dans une
    // console à part — invisible pour l'humain qui attend devant celle-ci.
  })
  app.on('error', err => console.error(`commande dev : ${err?.message ?? err}`))

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

    // Écrit par nous, pas par Playwright : son `path` suivrait un lien, et le
    // fichier naîtrait sous l'umask courant — lisible par les autres comptes.
    ecrireSession(root, JSON.stringify(await context.storageState(), null, 2))
    console.log(`session enregistrée dans ${sessionPath(root)}`)
    console.log('Le prochain crawl atteindra les pages protégées.')
  } finally {
    await browser.close().catch(() => {})
    killTree(app)
  }
}

main().catch(err => {
  console.error(`échec : ${err?.message ?? err}`)
  process.exit(1)
})
