import assert from 'node:assert/strict'
import test from 'node:test'
import { t, setCurrentLanguage, currentLanguage, translations } from './i18n'
import type { TranslationKey } from './i18n'

/**
 * Le trousseau vient du dictionnaire, pas d'une liste tenue à la main : une
 * liste ne casse jamais quand on oublie de l'alimenter, et une clé jamais
 * listée n'était jamais testée.
 *
 * La parité fr/en est vérifiée par `hooks/i18n.test.js` ; ce qui reste ici,
 * c'est que `t()` rende bien une chaîne non vide dans les deux langues.
 */
test('i18n: toutes les clés rendent une chaîne non vide dans les deux langues', () => {
  const keys = Object.keys(translations.fr) as TranslationKey[]
  assert(keys.length > 0, 'dictionnaire vide')

  for (const lang of ['fr', 'en'] as const) {
    setCurrentLanguage(lang)
    for (const key of keys) {
      const result = t(key)
      assert(typeof result === 'string', `Valeur non-string en ${lang} pour ${key}`)
      assert(result.length > 0, `Valeur vide en ${lang} pour ${key}`)
    }
  }
})

test('i18n: substitution de paramètres', () => {
  setCurrentLanguage('fr')
  const result = t('msg.days_ago', { n: 3 })
  assert.match(result, /il y a 3 jours/)

  setCurrentLanguage('en')
  const resultEn = t('msg.days_ago', { n: 3 })
  assert.match(resultEn, /3 days ago/)
})

test('i18n: langue courante par défaut', () => {
  // Réinitialise
  setCurrentLanguage(null)
  const lang = currentLanguage()
  assert(['fr', 'en'].includes(lang), `Langue invalide: ${lang}`)
})
