/**
 * La confiance d'espace de travail.
 *
 * Le test qui compte est le dernier : un dépôt monté de toutes pièces dont la
 * commande `dev` écrit un fichier témoin, lancé par le vrai crawler, sans
 * accord. Le témoin ne doit pas exister. C'est le seul qui prouve que le ticket
 * est résolu — les autres n'éprouvent que les pièces.
 *
 * `OVRSEE_TRUST` est posé sur un dossier jetable dans CHAQUE cas : sans lui,
 * `pnpm test` approuverait silencieusement les projets du profil réel de la
 * machine — un test qui casse l'outil qu'il vérifie.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { approuver, cleProjet, decision, estApprouve, lireConfiance, trustPath } from './confiance.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Un magasin de confiance jetable, posé pour la durée du cas. */
function magasinNeuf() {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-trust-'))
  process.env.OVRSEE_TRUST = join(dir, 'trust.json')
  return process.env.OVRSEE_TRUST
}

const projetNeuf = () => mkdtempSync(join(tmpdir(), 'ovrsee-projet-'))

test('un projet inconnu n’est pas approuvé', () => {
  magasinNeuf()
  assert.equal(estApprouve(projetNeuf(), 'pnpm dev'), false)
})

test('après approbation, la même chaîne passe', () => {
  magasinNeuf()
  const projet = projetNeuf()

  approuver(projet, 'pnpm dev')

  assert.equal(estApprouve(projet, 'pnpm dev'), true)
})

test('un espace de différence redemande l’accord', () => {
  magasinNeuf()
  const projet = projetNeuf()
  approuver(projet, 'pnpm dev')

  // Aucune normalisation : ce qui est comparé est l'octet exact qui partira à
  // `shellRun()`. Normaliser ouvrirait l'écart entre la forme approuvée et la
  // forme exécutée.
  assert.equal(estApprouve(projet, 'pnpm  dev'), false)
  assert.equal(estApprouve(projet, ' pnpm dev'), false)
  assert.equal(estApprouve(projet, 'PNPM DEV'), false)
  assert.equal(estApprouve(projet, 'pnpm dev && curl x | sh'), false)
})

test('approuver un projet ne dit rien d’un autre', () => {
  magasinNeuf()
  const a = projetNeuf()
  const b = projetNeuf()

  approuver(a, 'pnpm dev')

  assert.equal(estApprouve(b, 'pnpm dev'), false)
})

test('un magasin corrompu refuse, il n’accorde jamais', () => {
  const path = magasinNeuf()
  const projet = projetNeuf()
  approuver(projet, 'pnpm dev')

  for (const bruit of ['{ ceci n’est pas du json', '[]', 'null', '{"projets": 3}']) {
    writeFileSync(path, bruit)
    assert.equal(estApprouve(projet, 'pnpm dev'), false, bruit)
    assert.deepEqual(lireConfiance().projets, {})
  }
})

test('l’accord est écrit hors du dépôt observé', () => {
  magasinNeuf()
  const projet = projetNeuf()

  approuver(projet, 'pnpm dev')

  // Un accord rangé dans le dépôt serait fourni par l'attaquant : un clone
  // hostile embarquerait sa propre approbation, versionnée.
  assert.equal(existsSync(join(projet, 'ovrsee')), false)
  assert.ok(!trustPath().startsWith(projet))
})

// Sans clé commune, l'accord donné dans l'interface — sous le chemin du
// registre — ne vaudrait pas pour le hook `post-commit`, qui part du `cwd`. Le
// projet redemanderait éternellement.
test('la clé de projet concorde quel que soit le chemin emprunté', () => {
  magasinNeuf()
  const projet = projetNeuf()
  mkdirSync(join(projet, 'sous'), { recursive: true })

  approuver(projet, 'pnpm dev')

  assert.equal(estApprouve(join(projet, 'sous', '..'), 'pnpm dev'), true)
  assert.equal(estApprouve(projet + '/', 'pnpm dev'), true)
})

// Windows ne crée un lien symbolique qu'avec des privilèges ; le cas y est donc
// borné plutôt que rendu vert par hasard.
test('un chemin symbolique désigne le même projet', { skip: process.platform === 'win32' }, () => {
  magasinNeuf()
  const projet = projetNeuf()
  const lien = join(mkdtempSync(join(tmpdir(), 'ovrsee-lien-')), 'projet')
  symlinkSync(projet, lien)

  approuver(lien, 'pnpm dev')

  // C'est le cas de macOS : `/tmp/x` et `/private/tmp/x` sont le même dossier.
  assert.equal(cleProjet(lien), cleProjet(projet))
  assert.equal(estApprouve(projet, 'pnpm dev'), true)
})

test('decision : quatre cas, et un seul lance', () => {
  assert.equal(decision({ approuve: true, tty: true }), 'lancer')
  assert.equal(decision({ approuve: true, tty: false }), 'lancer')
  // Un humain est là : on demande.
  assert.equal(decision({ approuve: false, tty: true }), 'demander')
  // Personne pour répondre — le hook `post-commit`. On refuse, on ne
  // s'auto-approuve pas et on ne bloque pas sur une question que nul ne lira.
  assert.equal(decision({ approuve: false, tty: false }), 'refuser')
})

// --- ce que le ticket demande ---------------------------------------------

test("sans accord, la commande dev n'est pas exécutée du tout", () => {
  const magasin = magasinNeuf()
  const projet = projetNeuf()
  const temoin = join(projet, 'TEMOIN')

  writeFileSync(
    join(projet, 'ovrsee.config.json'),
    JSON.stringify({
      // Le dépôt hostile en une ligne : reçu, inscrit, crawlé, il écrivait ce
      // fichier sans que personne l'ait autorisé.
      dev: `node -e "require('fs').writeFileSync('TEMOIN','1')"`,
      baseUrl: 'http://localhost:5398',
      entryRoutes: ['/'],
      readyTimeoutMs: 1000,
    }),
  )

  // `stdio: 'ignore'` : pas de TTY, exactement comme le hook `post-commit`.
  // `process.stdin.isTTY` y vaut `undefined`, pas `false`.
  execFileSync(process.execPath, [join(HERE, 'index.js'), projet], {
    cwd: projet,
    stdio: 'ignore',
    // Sort en 0 : un scan refusé est une donnée, pas un plantage — sans quoi le
    // hook `post-commit` ferait échouer le commit.
    env: { ...process.env, OVRSEE_TRUST: magasin },
  })

  assert.equal(existsSync(temoin), false, 'la commande dev ne doit pas avoir tourné')

  const scan = JSON.parse(
    readFileSync(join(projet, 'ovrsee', 'pages', 'scans.jsonl'), 'utf8').trim(),
  )
  assert.equal(scan.ok, false)
  assert.match(scan.error, /non approuvée/)
})

test('avec accord, la garde laisse passer et le crawl échoue plus loin', () => {
  const magasin = magasinNeuf()
  const projet = projetNeuf()
  const dev = 'ovrsee-commande-absente-pour-le-test'

  writeFileSync(
    join(projet, 'ovrsee.config.json'),
    JSON.stringify({ dev, baseUrl: 'http://localhost:5397', entryRoutes: ['/'], readyTimeoutMs: 1000 }),
  )
  approuver(projet, dev)

  execFileSync(process.execPath, [join(HERE, 'index.js'), projet], {
    cwd: projet,
    stdio: 'ignore',
    env: { ...process.env, OVRSEE_TRUST: magasin },
  })

  // Le crawl échoue — la commande n'existe pas — mais plus sur la confiance :
  // la garde n'a pas fermé la porte à un projet approuvé.
  const scan = JSON.parse(
    readFileSync(join(projet, 'ovrsee', 'pages', 'scans.jsonl'), 'utf8').trim(),
  )
  assert.equal(scan.ok, false)
  assert.doesNotMatch(scan.error, /non approuvée/)
})
