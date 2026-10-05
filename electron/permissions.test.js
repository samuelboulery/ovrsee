import assert from 'node:assert/strict'
import test from 'node:test'

import { durcirWebview, ouvertureSurGeste, PARTITION_NAVIGATEUR, poserPermissions, requeteAutorisee } from './permissions.js'

/** Une `session` d'Electron factice, qui retient les gestionnaires posés. */
function sessionFactice() {
  const sessions = {}
  const fabriquer = () => ({
    setPermissionRequestHandler(f) {
      this.demande = (permission) => {
        let accord
        f(null, permission, ok => (accord = ok))
        return accord
      }
    },
    setPermissionCheckHandler(f) {
      this.verifie = permission => f(null, permission)
    },
    webRequest: { onBeforeRequest() {} },
    on() {},
  })
  return {
    sessions,
    defaultSession: (sessions.defaut = fabriquer()),
    fromPartition: nom => (sessions[nom] ??= fabriquer()),
  }
}

test('la page observée ne reçoit aucune permission (T-0273)', () => {
  const session = sessionFactice()
  poserPermissions(session)
  const nav = session.sessions[PARTITION_NAVIGATEUR]
  for (const p of ['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'media', 'openExternal', 'geolocation']) {
    assert.equal(nav.demande(p), false, p)
    assert.equal(nav.verifie(p), false, p)
  }
})

test('l’interface garde copier et notifier, rien d’autre', () => {
  const session = sessionFactice()
  poserPermissions(session)
  const defaut = session.sessions.defaut
  assert.equal(defaut.demande('clipboard-sanitized-write'), true)
  assert.equal(defaut.verifie('notifications'), true)
  for (const p of ['clipboard-read', 'media', 'openExternal']) assert.equal(defaut.demande(p), false, p)
})

test('un webview hors de la session Navigateur, ou sur un schéma local, est refusé', () => {
  const ok = (params, prefs = {}) => durcirWebview(prefs, params)
  assert.equal(ok({ partition: PARTITION_NAVIGATEUR, src: 'http://localhost:5173/' }), true)
  assert.equal(ok({ partition: PARTITION_NAVIGATEUR, src: 'about:blank' }), true)
  assert.equal(ok({ partition: '', src: 'http://localhost:5173/' }), false, 'session par défaut')
  assert.equal(ok({ partition: 'persist:autre', src: 'http://localhost/' }), false)
  for (const src of ['file:///etc/passwd', 'ovrsee://app/', 'javascript:alert(1)', undefined]) {
    assert.equal(ok({ partition: PARTITION_NAVIGATEUR, src }), false, String(src))
  }
})

test('les préférences du webview sont reposées, quoi qu’ait écrit le rendu', () => {
  const prefs = { preload: '/x.js', nodeIntegration: true, webSecurity: false, sandbox: false, webviewTag: true, safeDialogs: false, enableBlinkFeatures: 'X' }
  durcirWebview(prefs, { partition: PARTITION_NAVIGATEUR, src: 'http://localhost/' })
  assert.equal('preload' in prefs, false)
  assert.equal(prefs.nodeIntegration, false)
  assert.equal(prefs.webSecurity, true)
  assert.equal(prefs.sandbox, true)
  assert.equal(prefs.webviewTag, false)
  assert.equal(prefs.safeDialogs, true)
  assert.equal('enableBlinkFeatures' in prefs, false)
})

test('window.open de la page observée exige un geste récent, et pas plus d’un toutes les 2 s', () => {
  let maintenant = 10_000
  const garde = ouvertureSurGeste(() => maintenant)
  assert.equal(garde.autorisee(), false, 'sans geste')
  garde.saisie('mouseMove')
  assert.equal(garde.autorisee(), false, 'survoler n’est pas un geste')
  garde.saisie('mouseDown')
  assert.equal(garde.autorisee(), true)
  garde.saisie('mouseDown')
  assert.equal(garde.autorisee(), false, 'plafond')
  maintenant += 2500
  assert.equal(garde.autorisee(), false, 'le geste a plus d’une seconde')
  garde.saisie('keyDown')
  assert.equal(garde.autorisee(), true)
})

test('la session du Navigateur ne charge que le web', () => {
  for (const url of ['http://localhost:5173/', 'https://x.dev/a', 'ws://localhost:5173/', 'about:blank', 'data:image/png;base64,AA', 'blob:http://localhost/1', 'devtools://devtools/x']) {
    assert.equal(requeteAutorisee(url), true, url)
  }
  for (const url of ['file:///etc/hosts', 'ovrsee://app/', 'chrome://gpu', 'smb://x']) {
    assert.equal(requeteAutorisee(url), false, url)
  }
})
