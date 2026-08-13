import assert from 'node:assert/strict'
import test from 'node:test'

import { extractAttention } from './attention'

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const seq = (genre: string) => `${ESC}]777;ovrsee;${genre}${BEL}`

test('attention : une séquence entière donne un événement et disparaît du flux', () => {
  const { clean, carry, events } = extractAttention('', `avant${seq('stop')}après`)

  assert.deepEqual(events, ['stop'])
  assert.equal(clean, 'avantaprès')
  assert.equal(carry, '')
})

test('attention : une séquence coupée entre deux lectures est recollée', () => {
  const entier = `debut${seq('question')}fin`
  // Coupure au milieu du nom du genre, le cas qu'un simple `includes` raterait.
  const coupure = entier.indexOf('quest') + 3

  const premier = extractAttention('', entier.slice(0, coupure))
  assert.deepEqual(premier.events, [])
  assert.equal(premier.clean, 'debut')
  assert.notEqual(premier.carry, '')

  const second = extractAttention(premier.carry, entier.slice(coupure))
  assert.deepEqual(second.events, ['question'])
  assert.equal(premier.clean + second.clean, 'debutfin')
  assert.equal(second.carry, '')
})

test('attention : un flux sans séquence ressort intact', () => {
  // Des séquences ANSI ordinaires : couleur, effacement, titre de fenêtre.
  const flux = `${ESC}[38;5;140mrouge${ESC}[0m${ESC}[K${ESC}]0;titre${BEL}fin`
  const { clean, carry, events } = extractAttention('', flux)

  assert.deepEqual(events, [])
  assert.equal(clean, flux)
  assert.equal(carry, '')
})

test('attention : deux séquences dans un même morceau donnent deux événements', () => {
  const { clean, events } = extractAttention('', `a${seq('question')}b${seq('stop')}c`)

  assert.deepEqual(events, ['question', 'stop'])
  assert.equal(clean, 'abc')
})

test('attention : le BEL que Claude Code ajoute ne laisse pas de résidu', () => {
  const { clean, events } = extractAttention('', `x${seq('stop')}${BEL}y`)

  assert.deepEqual(events, ['stop'])
  assert.equal(clean, 'xy')
})

test('attention : un ESC isolé en fin de morceau ne bloque pas le flux suivant', () => {
  const premier = extractAttention('', `texte${ESC}`)
  assert.equal(premier.carry, ESC)
  assert.equal(premier.clean, 'texte')

  // Ce n'était pas une de nos séquences : elle doit ressortir telle quelle.
  const second = extractAttention(premier.carry, '[0m')
  assert.deepEqual(second.events, [])
  assert.equal(second.clean, `${ESC}[0m`)
})

test('attention : un ESC sans terminateur au-delà de la retenue ne mange pas le flux', () => {
  const long = `${ESC}]777;ovrsee;${'x'.repeat(120)}`
  const { clean, carry, events } = extractAttention('', long)

  assert.deepEqual(events, [])
  assert.equal(carry, '')
  assert.equal(clean, long)
})
