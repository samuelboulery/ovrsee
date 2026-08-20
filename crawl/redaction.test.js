import { test } from 'node:test'
import assert from 'node:assert/strict'

import { redige } from './index.js'

test('une variable d’environnement sensible perd sa valeur, pas son nom', () => {
  assert.equal(redige('OPENAI_API_KEY=sk-abc123def456ghi'), 'OPENAI_API_KEY=***')
  assert.equal(redige('DATABASE_PASSWORD: hunter2'), 'DATABASE_PASSWORD: ***')
  assert.equal(redige('missing env: SUPABASE_SERVICE_TOKEN=eyJhbGc'), 'missing env: SUPABASE_SERVICE_TOKEN=***')
})

test('les jetons à préfixe connu sont masqués même hors affectation', () => {
  assert.equal(redige('using sk-proj-AbCdEf123456 for auth'), 'using *** for auth')
  assert.equal(redige('token ghp_0123456789abcdefghij expired'), 'token *** expired')
  assert.equal(redige('bearer eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM'), 'bearer ***')
})

test('un mot de passe d’URL disparaît, l’hôte reste lisible', () => {
  assert.equal(
    redige('connect postgres://admin:s3cr3t@db.example.com:5432/app'),
    'connect postgres://admin:***@db.example.com:5432/app',
  )
})

test('l’échec le plus fréquent ressort intact', () => {
  // C'est la raison d'être de cette trace : sans elle, un PATH incomplet se
  // lisait « l'application n'a pas répondu » et envoyait chercher le problème
  // dans le projet observé.
  const dit = 'sh: pnpm: command not found\nerror Command failed with exit code 127.'
  assert.equal(redige(dit), dit)
})

test('une entrée absente ne fait pas lever', () => {
  assert.equal(redige(undefined), '')
  assert.equal(redige(null), '')
})
