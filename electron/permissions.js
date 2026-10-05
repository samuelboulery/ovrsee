/**
 * Ce que les pages affichées ont le droit de demander au système.
 *
 * Sans gestionnaire, Electron **accorde** toute permission demandée : la page
 * observée, chargée dans le webview de l'onglet Navigateur, pouvait lire le
 * presse-papier, ouvrir la caméra ou poser des notifications sans qu'aucune
 * question ne paraisse (T-0273). Cette page est du code qu'on n'a pas écrit.
 *
 * Deux sessions, deux règles :
 * - `persist:navigateur`, celle du webview : tout est refusé ;
 * - la session par défaut, celle de `ovrsee://app` et du popover : seulement
 *   ce que l'interface emploie — copier, et notifier la fin d'une session.
 */

import { ouvrable } from './lien-externe.js'

export const PARTITION_NAVIGATEUR = 'persist:navigateur'

/** Les permissions dont l'interface a besoin, et elles seules. */
export const PERMISES = new Set(['clipboard-sanitized-write', 'notifications'])

/**
 * Pose les gestionnaires sur les deux sessions.
 *
 * @param {typeof import('electron').session} session
 */
export function poserPermissions(session) {
  const navigateur = session.fromPartition(PARTITION_NAVIGATEUR)
  navigateur.setPermissionRequestHandler((_contenu, _permission, repondre) => repondre(false))
  navigateur.setPermissionCheckHandler(() => false)

  session.defaultSession.setPermissionRequestHandler((_contenu, permission, repondre) => repondre(PERMISES.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_contenu, permission) => PERMISES.has(permission))
}

/**
 * Durcit un webview au moment où le rendu l'attache, ou le refuse.
 *
 * L'invité est attaché par le rendu : c'est ici qu'on décide de ses
 * privilèges, pas dans les attributs de la balise. Sans cela, un rendu
 * compromis attacherait une page distante avec `nodeIntegration`. Le reste de
 * l'objet vient aussi de l'attribut `webpreferences`, donc du rendu : ne
 * remettre que trois clés laissait lever `webSecurity`. On repose tout ce qui
 * compte.
 *
 * Refusé : une autre session que celle du Navigateur — la session par défaut
 * est celle de l'interface, avec ses permissions —, ou une adresse ni http ni
 * https (`file:`, `ovrsee:`).
 *
 * @param {Record<string, unknown>} webPreferences modifié en place, comme Electron l'attend
 * @param {{ src?: string, partition?: string }} params
 * @returns {boolean} false si l'attache doit être annulée
 */
export function durcirWebview(webPreferences, params) {
  delete webPreferences.preload
  Object.assign(webPreferences, {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    nodeIntegrationInSubFrames: false,
    experimentalFeatures: false,
  })
  return params?.partition === PARTITION_NAVIGATEUR && (params.src === 'about:blank' || ouvrable(params.src))
}
