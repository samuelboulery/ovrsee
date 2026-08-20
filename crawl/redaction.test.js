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

test('les préfixes de clés cloud sont masqués hors affectation', () => {
  assert.equal(
    redige('The AWS Access Key Id you provided does not exist: AKIAIOSFODNN7EXAMPLE'),
    'The AWS Access Key Id you provided does not exist: ***',
  )
  assert.equal(redige('using sk_live_51H8xJ2eZabcdef for stripe'), 'using *** for stripe')
  assert.equal(redige('key AIzaSyD-abc123def456ghi789jkl012mno rejected'), 'key *** rejected')
})

test('un objet de config sérialisé en JSON perd ses valeurs sensibles', () => {
  assert.equal(
    redige('{"apiKey":"AIzaSyD-abc","dbPassword":"hunter2 raw","host":"db.example.com"}'),
    '{"apiKey":***,"dbPassword":***,"host":"db.example.com"}',
  )
})

test('une valeur entre guillemets est masquée en entier, espaces compris', () => {
  assert.equal(redige("PASSWORD='hunter 2 raw' next"), 'PASSWORD=*** next')
})

test('un en-tête Authorization perd son credential, pas seulement son schéma', () => {
  // `\S+` ne consommait que le mot-clé : le `***` masquait `Bearer` et laissait
  // le jeton en clair juste à côté — une rédaction en trompe-l'œil (#34).
  assert.equal(redige('AUTHORIZATION=Basic dXNlcjpwYXNzd29yZA=='), 'AUTHORIZATION=***')
  assert.equal(redige('Authorization: Bearer plainSecretToken123456789'), 'Authorization: ***')
  assert.equal(
    redige("curl -H 'Authorization: Digest cnonce=abc123' https://api.example.com/v1"),
    "curl -H 'Authorization: *** https://api.example.com/v1",
  )
})
