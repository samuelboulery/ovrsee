import assert from 'node:assert/strict'
import test from 'node:test'

import { tokens } from './highlight'

/** L'invariant du module : colorer ne doit jamais réécrire. */
const rendu = (code: string, language?: string) =>
  tokens(code, language)
    .map(token => token.text)
    .join('')

test('highlight : la concaténation des jetons rend le code à l’identique', () => {
  const cas: Array<[string, string | undefined]> = [
    ['const x = 1 // fin\nfoo(x)', 'ts'],
    ['# titre\npnpm install --frozen-lockfile\n', 'bash'],
    ['{ "a": [1, 2], "b": null }', 'json'],
    [':root { --color-bg: #161826; /* fond */ }', 'css'],
    ['def f(x):\n    return x  # oui', 'python'],
    ["const s = 'chaîne non refermée\nconst y = 2", 'js'],
    ['tout ce qu’on veut', 'brainfuck'],
    ['sans langage', undefined],
    ['', 'js'],
  ]

  for (const [code, language] of cas) {
    assert.equal(rendu(code, language), code, `perte sur ${language ?? 'aucun'}`)
  }
})

test('highlight : un langage inconnu rend un seul jeton brut', () => {
  const list = tokens('const x = 1', 'cobol')
  assert.equal(list.length, 1)
  assert.equal(list[0].kind, 'plain')
})

test('highlight : mots-clés, chaînes, nombres et commentaires en JS', () => {
  const list = tokens("const x = 'a' // note", 'ts')
  const kind = (text: string) => list.find(token => token.text === text)?.kind

  assert.equal(kind('const'), 'keyword')
  assert.equal(kind("'a'"), 'string')
  assert.equal(kind('// note'), 'comment')
  assert.equal(tokens('const n = 42', 'ts').find(t => t.text === '42')?.kind, 'number')
})

test('highlight : un appel de fonction se distingue d’un identifiant', () => {
  const list = tokens('resolve(url)', 'js')
  assert.equal(list.find(token => token.text === 'resolve')?.kind, 'call')
  // `url` n'est pas un jeton à lui seul : le texte brut se recolle, et seul ce
  // qui est coloré se détache. C'est voulu — un jeton par caractère neutre
  // serait autant d'éléments React pour rien.
  assert.equal(list.find(token => token.text.includes('url'))?.kind, 'plain')
})

test('highlight : drapeaux du shell et propriétés CSS', () => {
  const shell = tokens('pnpm install --frozen-lockfile', 'bash')
  assert.equal(shell.find(token => token.text === 'pnpm')?.kind, 'keyword')
  assert.equal(shell.find(token => token.text === '--frozen-lockfile')?.kind, 'flag')

  const css = tokens('a { font-size: 12px; }', 'css')
  assert.equal(css.find(token => token.text === 'font-size')?.kind, 'keyword')
})

test('highlight : un commentaire n’ouvre pas de chaîne, une chaîne pas de commentaire', () => {
  const commentaire = tokens("// il n'y a qu'un guillemet", 'js')
  assert.equal(commentaire.length, 1)
  assert.equal(commentaire[0].kind, 'comment')

  const chaine = tokens('const s = "a // b"', 'js')
  assert.equal(chaine.find(token => token.text === '"a // b"')?.kind, 'string')
})
