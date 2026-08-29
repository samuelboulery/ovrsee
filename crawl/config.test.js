/**
 * Un crawl sans configuration s'écrit.
 *
 * C'est le message qui remontait en boucle dans le terminal — « configuration
 * absente : … » — sans que rien dans l'interface ne le rattrape. Il doit
 * atterrir dans `scans.jsonl`, parce que c'est de là que l'interface le tire
 * (`scanFailed`) : sans cette ligne, un projet sans configuration paraîtrait
 * simplement n'avoir jamais été scanné.
 *
 * Le crawler n'atteint jamais le navigateur ici — il renonce avant, faute de
 * configuration puis faute de serveur. C'est ce qui rend ces tests lançables en
 * CI, sans Chrome ni application à démarrer.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { approuver } from './confiance.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Un magasin de confiance jetable. Sans `OVRSEE_TRUST`, ces tests liraient —
 * et écriraient — le profil réel de la machine ; et le crawler refuserait
 * d'exécuter la commande, ce qui masquerait l'échec qu'on veut éprouver.
 */
function magasinNeuf() {
  process.env.OVRSEE_TRUST = join(mkdtempSync(join(tmpdir(), 'ovrsee-trust-')), 'trust.json')
  return process.env.OVRSEE_TRUST
}

test('sans ovrsee.config.json, le scan échoué est consigné', () => {
  const magasin = magasinNeuf()
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-crawl-'))

  // Sort en 0 : l'échec est une donnée, pas un plantage — le hook post-commit
  // ne doit pas faire échouer un commit parce qu'un scan n'a pas pu tourner.
  execFileSync(process.execPath, [join(HERE, 'index.js'), dir], {
    stdio: 'ignore',
    env: { ...process.env, OVRSEE_TRUST: magasin },
  })

  const lignes = readFileSync(join(dir, 'ovrsee', 'pages', 'scans.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l))

  assert.equal(lignes.length, 1)
  assert.equal(lignes[0].ok, false)
  assert.match(lignes[0].error, /configuration absente/)
})

test("une commande dev introuvable dit laquelle, pas seulement qu'on a attendu", () => {
  const magasin = magasinNeuf()
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-crawl-dev-'))
  const dev = 'ovrsee-commande-absente-pour-le-test'
  writeFileSync(
    join(dir, 'ovrsee.config.json'),
    JSON.stringify({
      dev,
      // Un port qu'on n'ouvre pas : l'attente doit expirer.
      baseUrl: 'http://localhost:5399',
      entryRoutes: ['/'],
      // Pas serré à la milliseconde : ce qu'on attend ici n'est pas le délai,
      // c'est que `zsh -lic` ait eu le temps d'imprimer son `command not found`.
      // À 1500 ms, la suite complète le prenait de vitesse une fois sur deux.
      readyTimeoutMs: 6000,
    }),
  )

  // L'échec éprouvé ici est celui de la commande, pas celui de la confiance :
  // le dépôt est donc approuvé d'abord.
  approuver(dir, dev)
  execFileSync(process.execPath, [join(HERE, 'index.js'), dir], {
    stdio: 'ignore',
    env: { ...process.env, OVRSEE_TRUST: magasin },
  })

  const scan = JSON.parse(
    readFileSync(join(dir, 'ovrsee', 'pages', 'scans.jsonl'), 'utf8').trim(),
  )
  assert.equal(scan.ok, false)

  // Le délai dépassé, c'est le symptôme. La cause est le nom qui n'existe pas,
  // et c'est elle qui doit être écrite : sans elle, l'échec le plus fréquent —
  // un PATH sans `pnpm`, quand l'ovrsee est lancé depuis le Finder — envoyait
  // chercher le problème dans le projet observé.
  assert.match(scan.error, /n'a pas répondu/)
  assert.match(scan.error, new RegExp(dev))
})
