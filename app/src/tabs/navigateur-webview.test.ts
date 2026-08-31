import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { setCurrentLanguage } from '../i18n'
import { CarteElement } from './NavigateurPanneaux'
import { corpsDepuis, describe, type Picked } from './navigateur-webview'

// Les libellés de la carte sont traduits : sans langue fixée, le test dépendrait
// de `navigator.language`, qui n'existe pas forcément sous `node --test`.
setCurrentLanguage('fr')

/**
 * T-0214 : ce qu'on a voulu dire d'un élément se place avant la preuve
 * technique. Le clic sans commentaire reste le cas courant — sa sortie ne
 * bouge pas d'un caractère.
 */

const picked = (): Picked => ({
  selector: 'main > button.cta',
  text: "S'inscrire",
  html: '<button class="cta">S\'inscrire</button>',
  route: '/tarifs',
})

test('describe : sans commentaire, la sortie ne change pas', () => {
  const sortie = describe(picked())

  assert.match(sortie, /^Élément sélectionné dans l'aperçu \(route \/tarifs\) :/)
  assert.match(sortie, /sélecteur : main > button\.cta/)
})

test('describe : le commentaire passe en tête, avant le descriptif', () => {
  const sortie = describe(picked(), 'Ce bouton devrait être à droite')

  assert.match(sortie, /^Ce bouton devrait être à droite\n\nÉlément sélectionné/)
  // Le descriptif technique reste entier sous le commentaire.
  assert.match(sortie, /sélecteur : main > button\.cta/)
})

test("describe : un commentaire d'espaces vaut pas de commentaire", () => {
  assert.equal(describe(picked(), '   \n  '), describe(picked()))
  assert.equal(describe(picked(), ''), describe(picked()))
})

test('describe : le commentaire est débarrassé de ses espaces de bord', () => {
  assert.match(describe(picked(), '  marge fausse  '), /^marge fausse\n\nÉlément/)
})

test('corpsDepuis : sans commentaire, la sortie ne change pas', () => {
  const corps = corpsDepuis(picked())

  assert.match(corps, /^## Contexte\n\nÉlément sélectionné dans l'aperçu, route `\/tarifs`\./)
  assert.match(corps, /```html/)
})

test('corpsDepuis : le commentaire ouvre le contexte', () => {
  const corps = corpsDepuis(picked(), 'Ce bouton devrait être à droite')

  assert.match(corps, /^## Contexte\n\nCe bouton devrait être à droite\n\nÉlément sélectionné/)
  assert.match(corps, /Sélecteur : `main > button\.cta`/)
})

test("corpsDepuis : un commentaire d'espaces vaut pas de commentaire", () => {
  assert.equal(corpsDepuis(picked(), '  '), corpsDepuis(picked()))
})

/**
 * La carte remplace le panneau latéral : elle flotte au-dessus de l'aperçu et
 * n'affiche que le sélecteur — le texte et la route ont disparu, la route
 * étant déjà dans la barre d'URL juste au-dessus.
 */

const carte = (comment = '') =>
  renderToStaticMarkup(
    CarteElement({
      picked: picked(),
      comment,
      onComment: () => {},
      onSend: () => {},
      onTicket: () => {},
      onClose: () => {},
    }),
  )

test('CarteElement : montre le sélecteur, pas la route ni le texte', () => {
  const html = carte()

  assert.match(html, /main &gt; button\.cta/)
  assert.doesNotMatch(html, /\/tarifs/)
  assert.doesNotMatch(html, /inscrire/)
})

test("CarteElement : flotte au-dessus de l'aperçu, en haut à droite", () => {
  const html = carte()

  assert.match(html, /position:absolute/)
  assert.match(html, /right:/)
  // Sans z-index, la carte passerait sous la webview.
  assert.match(html, /z-index/)
})

test('CarteElement : porte la saisie et les deux actions', () => {
  const html = carte('marge fausse')

  assert.match(html, /<textarea/)
  assert.match(html, /marge fausse/)
  assert.match(html, /Créer un ticket/)
})
