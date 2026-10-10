/**
 * Le navigateur que pilote le crawl : le Google Chrome installé sur le poste.
 *
 * `playwright-core` voyage dans le paquet, aucun navigateur ne l'accompagne —
 * `channel: 'chrome'` prend celui du système. Sans lui, Playwright lève un
 * message qui envoie installer un Chromium par `npx` : une fausse piste pour
 * qui a installé Ovrsee depuis un DMG (T-0283).
 */

import { chromium } from 'playwright-core'

const INTROUVABLE = /distribution 'chrome' is not found|Executable doesn't exist/i

/**
 * @param {unknown} err l'échec de `chromium.launch`
 * @returns {string}
 */
export function messageLancement(err) {
  const brut = String(err?.message ?? err)
  return INTROUVABLE.test(brut)
    ? 'Google Chrome introuvable — le crawl pilote le Chrome installé sur ce poste. Installez-le, puis relancez.'
    : brut
}

/** `chromium.launch` sur le canal `chrome`, avec un échec qui dit quoi faire. */
export async function lancerChrome(options) {
  try {
    return await chromium.launch({ ...options, channel: 'chrome' })
  } catch (err) {
    throw new Error(messageLancement(err))
  }
}
