import assert from 'node:assert/strict'
import test from 'node:test'

import { translations } from './i18n.js'

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

/**
 * `t()` ne substitue que `${nom}`. Une traduction qui écrit `{nom}` ne lève pas :
 * elle rend l'accolade telle quelle, et personne ne s'en aperçoit — sauf
 * l'utilisateur de lecteur d'écran qui a entendu « Renommer la session {label} »
 * pendant des semaines.
 *
 * L'invariant vaut mieux que la liste des clés à paramètres : il couvre celles
 * qui n'existent pas encore.
 */
test('aucune traduction ne porte de paramètre non interpolable', () => {
  const fautives = []
  for (const [langue, dictionnaire] of Object.entries(translations)) {
    for (const [cle, valeur] of Object.entries(dictionnaire)) {
      if (typeof valeur !== 'string') continue
      for (const [, avant] of valeur.matchAll(/(.?)\{\w+\}/g)) {
        if (avant !== '$') fautives.push(`${langue}/${cle} : ${valeur}`)
      }
    }
  }
  assert.deepEqual(fautives, [], 'écrire ${param}, pas {param}')
})
