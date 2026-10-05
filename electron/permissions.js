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
  // Un rendu peut renaviguer le webview après l'attache (`loadURL('file://…')`),
  // que `will-navigate` ne voit pas : la session coupe tout ce qui n'est pas web.
  navigateur.webRequest.onBeforeRequest(({ url }, repondre) => repondre({ cancel: !requeteAutorisee(url) }))
  // Un `<a download>` cliqué par script ouvrait « Enregistrer sous » sans geste.
  navigateur.on('will-download', event => event.preventDefault())

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
  // Pas de remise à zéro : l'objet porte aussi des clés internes du webview
  // (instance, type), et le vider empêchait tout chargement. On efface ce que
  // l'attribut peut ajouter de dangereux, et on repose le reste.
  for (const cle of ['preload', 'enableBlinkFeatures', 'nodeIntegrationInWorker', 'plugins']) delete webPreferences[cle]
  Object.assign(webPreferences, {
    webviewTag: false,
    safeDialogs: true,
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

/** Ce que la page observée a le droit de charger : le web, et rien du poste. */
const SCHEMAS_WEB = new Set(['http:', 'https:', 'ws:', 'wss:', 'about:', 'data:', 'blob:', 'devtools:'])

/** @param {string} url */
export function requeteAutorisee(url) {
  try {
    return SCHEMAS_WEB.has(new URL(url).protocol)
  } catch {
    return false
  }
}

/** Ce qui compte comme un geste : un clic, une touche, un toucher. Pas un survol. */
const GESTES = new Set(['mouseDown', 'rawKeyDown', 'keyDown', 'touchStart'])

/**
 * `window.open` de la page observée : seulement juste après un geste, et pas
 * plus d'une fois toutes les 2 s. Sans geste, une page ouvrait en boucle des
 * onglets du navigateur système — hameçonnage, ou GET vers `127.0.0.1:*`.
 *
 * @param {() => number} [maintenant]
 */
export function ouvertureSurGeste(maintenant = Date.now) {
  let geste = -Infinity
  let derniere = -Infinity
  return {
    /** @param {string} type */
    saisie(type) {
      if (GESTES.has(type)) geste = maintenant()
    },
    autorisee() {
      const t = maintenant()
      if (t - geste > 1000 || t - derniere < 2000) return false
      derniere = t
      return true
    },
  }
}

/**
 * Garde un webview attaché : ses ouvertures de fenêtre passent par le geste,
 * et seules http et https sortent vers le système (`lien-externe.js`) — une
 * autre URL lancerait l'application enregistrée pour son schéma.
 *
 * @param {Electron.WebContents} invite
 * @param {(url: string) => void} ouvrir `shell.openExternal`
 */
export function garderInvite(invite, ouvrir) {
  const garde = ouvertureSurGeste()
  invite.on('input-event', (_event, saisie) => garde.saisie(saisie.type))
  invite.setWindowOpenHandler(({ url }) => {
    if (ouvrable(url) && garde.autorisee()) ouvrir(url)
    return { action: 'deny' }
  })
}
