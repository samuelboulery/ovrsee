import assert from 'node:assert/strict'
import test from 'node:test'

import { appliquerThemeTerminal, darkTheme, getTerminalTheme, resolveTheme, themeSourcePour } from './theme'

/**
 * `_ds/ovrsee/styles.css` EST le thème sombre (système Ovrsee, T-0045) : le
 * module n'en redéfinit aucun jeton. Il ne porte que ce que le CSS ne peut pas
 * porter — la palette du canvas xterm, qui est un objet JavaScript.
 *
 * Une version de ce module recopiait les quatre-vingt-dix jetons du design
 * system pour les « thématiser », et l'accent changeait de teinte au passage :
 * l'apparence par défaut changeait sans que personne l'ait demandé. Ces
 * valeurs sont donc gardées sous surveillance.
 */
test('la palette sombre garde les valeurs de la maquette', () => {
  assert.equal(darkTheme.bgPrimary, '#0b0c0e', 'fond des panneaux')
  assert.equal(darkTheme.xtermCursor, '#7d76f0', 'le curseur porte la couleur de marque')
})

/**
 * La résolution du réglage (T-0228). L'attribut `data-theme` porte toujours la
 * valeur résolue, jamais « système » : une seule règle CSS suffit alors. Ce qui
 * part à Electron, à l'inverse, est le réglage — voir `themeSourcePour`.
 */
test('resolveTheme : un choix explicite ignore le système', () => {
  assert.equal(resolveTheme('light', false), 'light')
  assert.equal(resolveTheme('dark', true), 'dark')
})

test('resolveTheme : « système » suit la préférence du poste', () => {
  assert.equal(resolveTheme('system', true), 'light')
  assert.equal(resolveTheme('system', false), 'dark')
})

test('resolveTheme : une valeur inconnue ou absente retombe sur le système', () => {
  // Le défaut de `hooks/settings.js` est `system` ; une valeur venue d'un
  // profil abîmé ne doit pas laisser l'interface sans thème du tout.
  assert.equal(resolveTheme(undefined, true), 'light')
  assert.equal(resolveTheme('clair', false), 'dark')
})

/**
 * Ce qui part au processus principal (T-0242).
 *
 * `app:theme` en fait un `nativeTheme.themeSource`, et un `themeSource` forcé
 * surcharge `prefers-color-scheme` DANS LE RENDU. Envoyer le thème résolu de
 * « système » figeait donc la requête média sur ce que le rendu venait d'y
 * écrire : `watchSystemTheme` ne recevait plus aucun `change`, et basculer
 * l'apparence du poste ne faisait plus rien tant que l'app tournait.
 */
test('themeSourcePour : « système » part tel quel, sinon Electron fige le suivi', () => {
  assert.equal(themeSourcePour('system'), 'system')
  assert.equal(themeSourcePour(undefined), 'system')
  assert.equal(themeSourcePour('clair'), 'system')
})

test('themeSourcePour : un choix explicite part tel quel', () => {
  assert.equal(themeSourcePour('light'), 'light')
  assert.equal(themeSourcePour('dark'), 'dark')
})

/**
 * La bascule à chaud du terminal (T-0229) — le critère qui fait ou défait
 * l'issue #64.
 *
 * Le thème xterm n'était lu qu'à `new XTerm({…})` et jamais réappliqué. Le
 * recréer n'est pas une option : démonter le panneau ferme les ptys et tue la
 * session. Une affectation de `options.theme` suffit à réafficher, et le pty
 * vit dans le processus principal — il n'est pas touché.
 *
 * Sortie en fonction pure pour qu'un test l'atteigne sans xterm : `app/src`
 * est compilé et exécuté par `node --test`, sans DOM ni canvas.
 */
test('getTerminalTheme : les vingt couleurs, dans les deux thèmes', () => {
  const sombre = getTerminalTheme('dark')
  const clair = getTerminalTheme('light')

  assert.equal(Object.keys(sombre).length, 20)
  assert.deepEqual(Object.keys(clair), Object.keys(sombre), 'une clé manquante rendrait la main à xterm')
  assert.equal(sombre.background, '#0b0c0e')
  assert.equal(sombre.cursor, '#7d76f0')
  assert.notEqual(clair.background, sombre.background)
})

test('appliquerThemeTerminal : repose le thème sur chaque terminal vivant', () => {
  const panes = [{ options: { theme: getTerminalTheme('dark') } }, { options: {} }]

  appliquerThemeTerminal(panes, 'light')

  for (const pane of panes) {
    assert.equal(pane.options.theme?.background, getTerminalTheme('light').background)
  }
})

test('appliquerThemeTerminal : sans terminal ouvert, il ne fait rien', () => {
  // Le panneau est en `lazy()` : au démarrage, aucun xterm n'existe encore.
  appliquerThemeTerminal([], 'light')
})
