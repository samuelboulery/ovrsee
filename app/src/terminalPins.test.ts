import assert from 'node:assert/strict'
import test from 'node:test'

import { pinFor, pinKey, readPins, togglePin, writePins, type Pins } from './terminalPins'

test('pinKey : une clé par couple onglet/disposition', () => {
  assert.equal(pinKey('tableau', 'bottom'), 'tableau:bottom')
  assert.notEqual(pinKey('tableau', 'bottom'), pinKey('tableau', 'side'))
  assert.notEqual(pinKey('tableau', 'bottom'), pinKey('produit', 'bottom'))
})

test('pinFor : rend la taille épinglée, undefined sinon', () => {
  const pins: Pins = { 'tableau:bottom': 380 }
  assert.equal(pinFor(pins, 'tableau', 'bottom'), 380)
  assert.equal(pinFor(pins, 'produit', 'bottom'), undefined)
  assert.equal(pinFor(pins, 'tableau', 'side'), undefined)
})

test('pinFor : « plein » n\'a pas de taille propre, donc jamais d\'épingle', () => {
  // Même si le magasin en portait une, elle ne doit pas s'appliquer : le
  // panneau plein prend tout l'espace, il n'a pas de hauteur à figer.
  const pins: Pins = { 'tableau:full': 380 }
  assert.equal(pinFor(pins, 'tableau', 'full'), undefined)
})

test('togglePin : pose puis retire, sans muter l\'entrée', () => {
  const vide: Pins = {}
  const pose = togglePin(vide, 'tableau', 'bottom', 380)
  assert.deepEqual(pose, { 'tableau:bottom': 380 })
  assert.deepEqual(vide, {}, 'le magasin d\'origine reste intact')

  const retire = togglePin(pose, 'tableau', 'bottom', 380)
  assert.deepEqual(retire, {})
  assert.deepEqual(pose, { 'tableau:bottom': 380 }, 'le magasin d\'origine reste intact')
})

test('togglePin : les pages ne se marchent pas dessus', () => {
  const pins = togglePin(togglePin({}, 'tableau', 'bottom', 380), 'produit', 'bottom', 520)
  assert.deepEqual(pins, { 'tableau:bottom': 380, 'produit:bottom': 520 })

  const sansTableau = togglePin(pins, 'tableau', 'bottom', 380)
  assert.deepEqual(sansTableau, { 'produit:bottom': 520 })
})

/**
 * Un `localStorage` de test — Node n'en fournit pas de stable.
 *
 * On relit le descripteur plutôt que la propriété : Node déclare bien un
 * `globalThis.localStorage`, mais son accesseur avertit sur stderr tant que
 * `--localstorage-file` n'est pas passé.
 */
function stubStorage(depart: string | null) {
  let valeur = depart
  const precedent = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => valeur,
      setItem: (_cle: string, brut: string) => {
        valeur = brut
      },
    },
  })
  return {
    lu: () => valeur,
    rendre: () => {
      if (precedent) Object.defineProperty(globalThis, 'localStorage', precedent)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    },
  }
}

test('readPins : un magasin absent ou illisible rend un objet vide', () => {
  for (const brut of [null, 'pas du json', '[]', '"chaîne"']) {
    const stockage = stubStorage(brut)
    try {
      assert.deepEqual(readPins(), {}, `magasin : ${String(brut)}`)
    } finally {
      stockage.rendre()
    }
  }
})

test('readPins : écarte les tailles qui ne sont pas des pixels valides', () => {
  const stockage = stubStorage(
    JSON.stringify({ 'tableau:bottom': 380, 'produit:bottom': -1, 'stack:bottom': 'haut', 'donnees:side': null }),
  )
  try {
    assert.deepEqual(readPins(), { 'tableau:bottom': 380 })
  } finally {
    stockage.rendre()
  }
})

test('writePins puis readPins : aller-retour fidèle', () => {
  const stockage = stubStorage('{}')
  try {
    writePins({ 'tableau:bottom': 380, 'produit:side': 520 })
    assert.deepEqual(readPins(), { 'tableau:bottom': 380, 'produit:side': 520 })
  } finally {
    stockage.rendre()
  }
})
