/**
 * La liste blanche des schémas qu'on remet au système.
 *
 * Ce qui est éprouvé ici est le refus, pas l'acceptation : `shell.openExternal`
 * reçoit une URL qu'une page tierce a pu choisir — l'onglet Navigateur charge
 * ce qu'on lui demande — et c'est la seule chose qui l'empêche de lancer une
 * application du disque.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { ouvrable } from './lien-externe.js'

test('ouvrable accepte http et https, et eux seuls', () => {
  assert.equal(ouvrable('https://exemple.com/page'), true)
  assert.equal(ouvrable('http://localhost:3000/'), true)
})

test('ouvrable refuse les schémas qui sortent vers le disque ou le réseau local', () => {
  assert.equal(ouvrable('file:///Applications/Calculator.app'), false)
  assert.equal(ouvrable('smb://serveur/partage'), false)
  assert.equal(ouvrable('vscode://file/etc/passwd'), false)
  assert.equal(ouvrable('javascript:alert(1)'), false)
  assert.equal(ouvrable('data:text/html,<script>1</script>'), false)
})

test('ouvrable refuse ce qui n’est pas une URL absolue', () => {
  assert.equal(ouvrable('/chemin/relatif'), false)
  assert.equal(ouvrable(''), false)
  assert.equal(ouvrable(null), false)
  assert.equal(ouvrable(undefined), false)
  assert.equal(ouvrable({}), false)
})

test('ouvrable ne se laisse pas berner par un schéma déguisé', () => {
  // Espaces en tête : `new URL` les rogne, donc le schéma reste `file:`.
  assert.equal(ouvrable('  file:///etc/passwd'), false)
  // Un hôte qui ressemble à http ne fait pas un schéma http.
  assert.equal(ouvrable('ftp://http.exemple.com/'), false)
})
