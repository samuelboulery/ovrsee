/**
 * Module d'internationalisation FR/EN pour l'interface React.
 *
 * Réexporte les traductions de `hooks/i18n.js` et ajoute la gestion
 * de `currentLanguage()` qui lit depuis les paramètres utilisateur.
 */

import type { Language, TranslationKey } from '../../hooks/i18n'
import { formatDate, t as tBase, translations } from '../../hooks/i18n'

export type { Language, TranslationKey }
export { formatDate, translations }

/** Stockage interne de la langue courante */
let storedLanguage: Language | null = null

/**
 * Définit la langue courante (appelé après le chargement des paramètres).
 *
 * @param lang 'fr' ou 'en'
 */
export function setCurrentLanguage(lang: string | null): void {
  if (lang === 'en' || lang === 'fr') {
    storedLanguage = lang
  } else {
    // Réinitialiser à la détection navigateur si valeur inconnue
    storedLanguage = null
  }
}

/**
 * Récupère la langue courante.
 *
 * Si définie explicitement via `setCurrentLanguage()`, retourne cette valeur.
 * Sinon, détecte depuis `navigator.language`.
 *
 * @returns 'fr' ou 'en'
 */
export function currentLanguage(): Language {
  if (storedLanguage) return storedLanguage

  const browserLang = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en'
  return browserLang === 'fr' ? 'fr' : 'en'
}

/**
 * Récupère une traduction (wrapper TypeScript autour de tBase).
 *
 * @param key - Clé de traduction
 * @param params - Paramètres nommés pour remplacer ${nom} dans la chaîne
 * @returns La chaîne traduite avec les paramètres substitués
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return tBase(key, currentLanguage(), params)
}
