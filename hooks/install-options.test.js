/**
 * Les options d'équipement : `git init`, premier commit, `ovrsee.config.json`.
 *
 * Fichier à part, et import dynamique, pour une seule raison : `install()`
 * écrit dans `~/.claude/settings.json`, dont le chemin est figé à l'évaluation
 * du module. Il faut donc détourner `HOME` **avant** que `install.js` soit
 * chargé — un import statique serait remonté en tête du fichier et le vrai
 * profil de l'utilisateur y passerait. C'est aussi pourquoi ces tests ne
 * rejoignent pas `install.test.js`, qui importe le module normalement.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.HOME = mkdtempSync(join(tmpdir(), 'ovrsee-home-'))
// Même précaution pour le magasin de confiance : `install()` ne doit rien y
// écrire, et le vérifier sur le profil réel de la machine serait pire encore.
process.env.OVRSEE_TRUST = join(mkdtempSync(join(tmpdir(), 'ovrsee-trust-')), 'trust.json')

const { install } = await import('./install.js')

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })

/** Un dossier nu, avec un fichier pour avoir quelque chose à committer. */
function dossierNu() {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-opt-'))
  writeFileSync(join(dir, 'README.md'), '# essai\n')
  return dir
}

/** Un dépôt git avec une identité locale — sinon `git commit` refuse. */
function depot() {
  const dir = dossierNu()
  git(['init'], dir)
  git(['config', 'user.email', 'essai@example.invalid'], dir)
  git(['config', 'user.name', 'Essai'], dir)
  return dir
}

test('gitInit transforme un dossier nu en dépôt équipé', () => {
  const dir = dossierNu()

  const done = install(dir, { gitInit: true })

  assert.ok(existsSync(join(dir, '.git')), 'le dépôt existe')
  assert.ok(existsSync(join(dir, 'ovrsee', 'plans')), 'ovrsee/plans/ existe')
  assert.match(done.join('\n'), /dépôt git créé/)
})

test('sans gitInit, un dossier nu fait toujours échouer install', () => {
  const dir = dossierNu()

  assert.throws(() => install(dir), /rev-parse|not a git repository|dépôt/i)
})

test('config écrit les trois champs que le crawler relit', () => {
  const dir = depot()

  install(dir, { config: { dev: 'npm start', baseUrl: 'http://localhost:3000' } })

  const config = JSON.parse(readFileSync(join(dir, 'ovrsee.config.json'), 'utf8'))
  assert.deepEqual(config, {
    dev: 'npm start',
    baseUrl: 'http://localhost:3000',
    entryRoutes: ['/'],
  })
})

test('une configuration déjà là est conservée, jamais écrasée', () => {
  const dir = depot()
  // Le fichier porte aussi les surcharges de préférences du projet : l'écraser
  // pour deux champs en emporterait d'autres, sans rapport avec le crawl.
  writeFileSync(
    join(dir, 'ovrsee.config.json'),
    JSON.stringify({ dev: 'à moi', obsidianVault: '/ailleurs' }),
  )

  const done = install(dir, { config: { dev: 'écrasé', baseUrl: 'http://localhost:1' } })

  const config = JSON.parse(readFileSync(join(dir, 'ovrsee.config.json'), 'utf8'))
  assert.equal(config.dev, 'à moi')
  assert.equal(config.obsidianVault, '/ailleurs')
  assert.match(done.join('\n'), /conservé tel quel/)
})

test('le premier commit précède la pose du hook, et ne contient pas ovrsee/', () => {
  const dir = depot()

  install(dir, { commit: true, config: { dev: 'pnpm dev', baseUrl: 'http://localhost:5173' } })

  // C'est l'assertion qui compte : si `ovrsee/` était dans ce commit, c'est que
  // le hook post-commit et la configuration étaient déjà posés au moment du
  // commit — et le hook aurait lancé un crawl détaché, c'est-à-dire le serveur
  // de développement du projet observé, sans que personne l'ait demandé.
  const fichiers = git(['show', '--name-only', '--format=', 'HEAD'], dir)
  assert.match(fichiers, /README\.md/)
  assert.doesNotMatch(fichiers, /ovrsee/)
})

// L'invariant du cadrage : l'ovrsee lit, il n'exécute que le terminal qu'on lui
// demande. Un dépôt reçu d'ailleurs livre ses propres `.git/hooks`, et `git
// commit` les lance — c'est du code du projet observé, exécuté par l'équipement.
// Même raison que `hooks/git.test.js` : le hook piégé est un script `#!/bin/sh`
// que Windows n'exécute pas. Le test y passerait sans rien prouver.
test(
  'le premier commit n’exécute pas les hooks git du dépôt observé',
  { skip: process.platform === 'win32' ? 'hook en /bin/sh, non portable' : false },
  () => {
    const dir = depot()
    const temoin = join(dir, '..', `temoin-${Date.now()}.txt`)
    const hook = join(dir, '.git', 'hooks', 'pre-commit')
    writeFileSync(hook, `#!/bin/sh\necho execute > ${temoin}\nexit 0\n`)
    chmodSync(hook, 0o755)

    install(dir, { commit: true })

    assert.equal(existsSync(temoin), false, 'le hook du dépôt observé a été exécuté')
  },
)

test("un commit impossible n'empêche pas l'équipement", () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-opt-'))
  git(['init'], dir)
  git(['config', 'user.email', 'essai@example.invalid'], dir)
  git(['config', 'user.name', 'Essai'], dir)
  // Dépôt vide : `git commit` échoue faute de quoi que ce soit à committer.

  const done = install(dir, { commit: true })

  assert.ok(existsSync(join(dir, 'ovrsee', 'plans')), 'équipé malgré tout')
  assert.match(done.join('\n'), /premier commit impossible/)
})

test("install n'accorde aucune confiance — /api/* ne décide pas de ça", () => {
  const dir = depot()

  install(dir, { config: { dev: 'npm start', baseUrl: 'http://localhost:3000' } })

  // `install()` est atteignable depuis `/api/project` action `init`, servie
  // aussi par le dev server Vite en HTTP local non authentifié. Une décision de
  // confiance qui s'obtiendrait par un POST local n'en serait pas une : l'accord
  // passe par le canal IPC `crawl:approve`, et par lui seul.
  assert.equal(existsSync(process.env.OVRSEE_TRUST), false)
})
