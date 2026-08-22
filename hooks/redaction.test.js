import { test } from 'node:test'
import assert from 'node:assert/strict'

import { redige } from './redaction.js'

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
    "curl -H 'Authorization: ***",
  )
})

test('un en-tête Authorization est masqué en entier, schéma inconnu compris', () => {
  // `\S+` s'arrêtait au premier mot : un Digest multi-champs livrait `response`
  // (le hash dérivé du mot de passe) et une signature SigV4 sortait en clair
  // à côté d'un `***` qui donnait le change (#36).
  assert.equal(
    redige('Authorization: Digest username="Mufasa", realm="testrealm@host.com", nonce="dcd98b71", response="6629fae49393a05397450978507c4ef1"'),
    'Authorization: ***',
  )
  assert.equal(
    redige('Authorization: AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20260820/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=5d672d79'),
    'Authorization: ***',
  )
  assert.equal(redige('Authorization: Negotiate YIIFvQYJKoZIhvcSAQICAQ=='), 'Authorization: ***')
  // La ligne suivante reste lisible : la rédaction s'arrête à la fin de ligne.
  assert.equal(
    redige('Authorization: Bearer abc123\nGET /v1/pages 401'),
    'Authorization: ***\nGET /v1/pages 401',
  )
})

test('une affectation masquée n’emporte pas le diagnostic qui la suit', () => {
  // Masquer jusqu'à la fin de ligne effaçait l'hôte et le code retour qui
  // partagent la ligne, y compris derrière un faux positif (#39).
  assert.equal(
    redige('DEBUG: TOKEN_REFRESH_INTERVAL=300 seconds, next check at 10:00 host=db.example.com'),
    'DEBUG: TOKEN_REFRESH_INTERVAL=*** seconds, next check at 10:00 host=db.example.com',
  )
  assert.equal(
    redige('connect failed: DB_PASSWORD=hunter2, host=db.example.com, code=ECONNREFUSED'),
    'connect failed: DB_PASSWORD=***, host=db.example.com, code=ECONNREFUSED',
  )
})

test('redige masque un bloc PEM en entier', () => {
  const pem =
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\nhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----'
  assert.equal(redige(`fatal: cannot read key\n${pem}\nexit 1`), 'fatal: cannot read key\n***\nexit 1')
  assert.equal(
    redige('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----'),
    '***',
  )
})

test('redige masque les jetons npm, GitLab et Slack', () => {
  assert.equal(redige('npm ERR! npm_abcdefghij0123456789 refusé'), 'npm ERR! *** refusé')
  assert.equal(redige('remote: glpat-AbCdEfGhIjKlMnOpQrSt'), 'remote: ***')
  assert.equal(redige('slack: xoxb-1234567890-abcdef'), 'slack: ***')
})

test('redige laisse lisible ce qui n’est pas un secret', () => {
  // Le diagnostic est la raison d'être de la trace : un mot qui commence par
  // `npm_` mais qui n'a pas la longueur d'un jeton reste entier.
  assert.equal(redige('npm_config_registry vide'), 'npm_config_registry vide')
  assert.equal(redige('pnpm: command not found'), 'pnpm: command not found')
})
