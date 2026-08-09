import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { translations } from './i18n.js'

const ici = dirname(fileURLToPath(import.meta.url))

/**
 * `hooks/i18n.d.ts` énumère les clés à la main.
 *
 * C'est une duplication, et elle n'est pas évitable : le dictionnaire doit
 * rester en JavaScript simple pour que le processus principal d'Electron le
 * lise sans compilation, et un `.d.ts` ne sait pas dériver un type d'un `.js`
 * non typé. Faute de pouvoir la supprimer, on la met sous surveillance : une
 * clé ajoutée d'un côté et pas de l'autre casse ici, pas six mois plus tard
 * devant un utilisateur anglophone.
 */
test('la déclaration TypeScript énumère exactement les clés du dictionnaire', () => {
  const declaration = readFileSync(join(ici, 'i18n.d.ts'), 'utf8')
  const declarees = new Set([...declaration.matchAll(/\|\s*'([^']+)'/g)].map(m => m[1]))
  const reelles = new Set(Object.keys(translations.fr))

  const manquantes = [...reelles].filter(k => !declarees.has(k)).sort()
  const fantomes = [...declarees].filter(k => !reelles.has(k) && k.includes('.')).sort()

  assert.deepEqual(manquantes, [], 'clés du dictionnaire absentes de i18n.d.ts')
  assert.deepEqual(fantomes, [], 'clés déclarées dans i18n.d.ts qui n’existent plus')
})

test('les deux langues portent exactement les mêmes clés', () => {
  const fr = Object.keys(translations.fr).sort()
  const en = Object.keys(translations.en).sort()
  assert.deepEqual(
    fr.filter(k => !translations.en[k]),
    [],
    'clés françaises sans traduction anglaise',
  )
  assert.deepEqual(
    en.filter(k => !translations.fr[k]),
    [],
    'clés anglaises sans original français',
  )
})

/** Une clé absente doit donner un texte laid, jamais vider l'écran. */
test('t() se replie au lieu de lever', async () => {
  const { t } = await import('./i18n.js')
  assert.equal(typeof t('clef.qui.n.existe.pas', 'en'), 'string')
})
