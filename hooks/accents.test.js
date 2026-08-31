import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { ACCENT_DEFAUT, ACCENTS, validerAccent } from './accents.js'

/**
 * La palette d'accent par projet (T-0215).
 *
 * Deux choses qu'aucun autre test ne dit : que la liste fermée de `accents.js`
 * et les blocs du design system se recouvrent exactement — un identifiant sans
 * bloc rendrait une teinte choisissable et sans effet — et que chaque teinte
 * tient le contraste sur le fond sombre. Un accent est à la fois une couleur de
 * texte (liens, onglet actif) et un fond de bouton primaire portant un libellé
 * sombre : les deux sens se mesurent.
 *
 * Vit dans `hooks/` et non dans `app/src` pour la même raison que
 * `couleurs.test.js` : lire un fichier demande les types Node, que `app/src`
 * n'a pas.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(racine, '_ds', 'ovrsee', 'styles.css'), 'utf8')

/** Les paliers de rampe attendus, ceux que le `:root` déclare pour le violet. */
const PALIERS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

/** La surface la plus claire de l'interface : le pire fond pour un texte accent. */
const SURFACE_CARD = '#131519'
/** Le libellé d'un `.btn-primary`, posé sur l'accent. */
const TEXTE_SUR_ACCENT = '#0a0a12'
/** WCAG AA pour du texte — l'accent en sert. */
const SEUIL = 4.5

/** Le bloc `[data-accent='x'] { … }` du design system, ou null. */
const bloc = nom => css.match(new RegExp(`\\[data-accent='${nom}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? null

/** La valeur d'un jeton dans un bloc — ou dans le `:root` pour le défaut. */
const jeton = (source, nom) => source.match(new RegExp(`${nom}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? null

/** Luminance relative WCAG. */
const luminance = hex => {
  const canaux = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2]
}

const contraste = (a, b) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (clair + 0.05) / (sombre + 0.05)
}

test('chaque accent hors défaut a son bloc dans le design system', () => {
  for (const nom of ACCENTS.filter(n => n !== ACCENT_DEFAUT)) {
    const regles = bloc(nom)
    assert.ok(regles, `pas de bloc [data-accent='${nom}'] dans _ds/ovrsee/styles.css`)
    assert.ok(jeton(regles, '--color-accent'), `${nom} ne définit pas --color-accent`)
    for (const palier of PALIERS) {
      assert.ok(jeton(regles, `--color-accent-${palier}`), `${nom} n'a pas le palier ${palier}`)
    }
  }
})

test('le défaut ne redéfinit rien : il rend la teinte de marque', () => {
  // Son bloc ne sert qu'aux pastilles de choix — l'élément racine n'en porte
  // jamais l'attribut. S'il recopiait le violet, les deux dériveraient.
  const regles = bloc(ACCENT_DEFAUT)
  assert.ok(regles)
  assert.match(regles, /--color-accent:\s*var\(--color-brand\)/)
  assert.equal(jeton(regles, '--color-accent'), null, 'aucun hex dans le bloc du défaut')
})

test('aucun bloc du design system ne manque à la liste fermée', () => {
  const declares = [...css.matchAll(/\[data-accent='([a-z]+)'\]/g)].map(m => m[1])
  for (const nom of new Set(declares)) assert.ok(ACCENTS.includes(nom), `${nom} n'est pas dans ACCENTS`)
})

test('chaque accent tient le contraste sur le fond sombre, dans les deux sens', () => {
  const racineCss = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]

  for (const nom of ACCENTS) {
    // Le défaut passe par `--color-brand`, que rien ne surcharge.
    const couleur =
      nom === ACCENT_DEFAUT ? jeton(racineCss, '--color-brand') : jeton(bloc(nom), '--color-accent')

    const surFond = contraste(couleur, SURFACE_CARD)
    assert.ok(surFond >= SEUIL, `${nom} (${couleur}) : ${surFond.toFixed(2)}:1 sur une carte`)

    const enFond = contraste(couleur, TEXTE_SUR_ACCENT)
    assert.ok(enFond >= SEUIL, `${nom} (${couleur}) : ${enFond.toFixed(2)}:1 sous un libellé de bouton`)
  }
})

test('validerAccent : admis, inconnu, absent', () => {
  assert.equal(validerAccent('rose'), 'rose')
  assert.equal(validerAccent('mauve'), null)
  assert.equal(validerAccent(undefined), null)
  assert.equal(validerAccent(42), null)
})
