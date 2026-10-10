import { test } from 'node:test'
import assert from 'node:assert/strict'

import { messageLancement } from './chrome.js'

test('un Chrome introuvable devient une consigne, pas un message de Playwright (T-0283)', () => {
  const brut = new Error(
    "browserType.launch: Chromium distribution 'chrome' is not found at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\nRun \"npx playwright install chrome\"",
  )
  const message = messageLancement(brut)
  assert.match(message, /Google Chrome introuvable/)
  assert.doesNotMatch(message, /npx playwright/)
})

test('un exécutable absent se lit de la même façon', () => {
  assert.match(messageLancement(new Error("browserType.launch: Executable doesn't exist at /x")), /Google Chrome introuvable/)
})

test('une autre panne de lancement garde son message', () => {
  assert.equal(messageLancement(new Error('Target closed')), 'Target closed')
  assert.equal(messageLancement('texte'), 'texte')
})
