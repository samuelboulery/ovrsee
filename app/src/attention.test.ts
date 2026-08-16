import assert from 'node:assert/strict'
import test from 'node:test'

import { extractAttention } from './attention'

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const seq = (genre: string) => `${ESC}]777;ovrsee;${genre}${BEL}`

/**
 * Même encodage que `sequence()` dans `hooks/ovrsee-notify.js` : UTF-8 puis
 * base64. Écrit avec les primitives du navigateur, celles-là mêmes que
 * `decode()` emploie dans l'autre sens.
 */
const seqDetail = (genre: string, detail: string) => {
  const octets = new TextEncoder().encode(detail)
  const binaire = Array.from(octets, o => String.fromCharCode(o)).join('')
  return `${ESC}]777;ovrsee;${genre};${btoa(binaire)}${BEL}`
}

/** Les genres seuls, quand le détail n'est pas ce qu'on éprouve. */
const genres = (events: readonly { kind: string }[]) => events.map(e => e.kind)

test('attention : une séquence entière donne un événement et disparaît du flux', () => {
  const { clean, carry, events } = extractAttention('', `avant${seq('stop')}après`)

  assert.deepEqual(events, [{ kind: 'stop', detail: null }])
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
  assert.deepEqual(genres(second.events), ['question'])
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

  assert.deepEqual(genres(events), ['question', 'stop'])
  assert.equal(clean, 'abc')
})

test('attention : le BEL que Claude Code ajoute ne laisse pas de résidu', () => {
  const { clean, events } = extractAttention('', `x${seq('stop')}${BEL}y`)

  assert.deepEqual(genres(events), ['stop'])
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
  const long = `${ESC}]777;ovrsee;${'x'.repeat(800)}`
  const { clean, carry, events } = extractAttention('', long)

  assert.deepEqual(events, [])
  assert.equal(carry, '')
  assert.equal(clean, long)
})

test('attention : le détail encodé ressort décodé', () => {
  const message = 'Claude needs your permission to use Bash'
  const { clean, events } = extractAttention('', `a${seqDetail('question', message)}b`)

  assert.deepEqual(events, [{ kind: 'question', detail: message }])
  assert.equal(clean, 'ab')
})

test('attention : un détail non-ASCII survit à l’aller-retour', () => {
  // Le base64 encode des octets : sans passer par UTF-8 des deux côtés, un
  // accent ressortirait en mojibake.
  const message = 'Autoriser « rm » — vraiment ?'
  const { events } = extractAttention('', seqDetail('question', message))

  assert.deepEqual(events, [{ kind: 'question', detail: message }])
})

test('attention : un base64 illisible laisse le signal sans détail', () => {
  // La séquence est consommée quand même : la retirer du flux importe plus que
  // son détail, et un résidu s'afficherait dans le terminal.
  const { clean, events } = extractAttention('', `a${ESC}]777;ovrsee;question;=====${BEL}b`)

  assert.deepEqual(events, [{ kind: 'question', detail: null }])
  assert.equal(clean, 'ab')
})

test('attention : une séquence avec détail coupée en deux est recollée', () => {
  const entier = `debut${seqDetail('question', 'permission to use Bash')}fin`
  // Coupure au milieu de la charge base64, après le point-virgule.
  const coupure = entier.indexOf(';', entier.indexOf('question')) + 6

  const premier = extractAttention('', entier.slice(0, coupure))
  assert.deepEqual(premier.events, [])
  assert.equal(premier.clean, 'debut')

  const second = extractAttention(premier.carry, entier.slice(coupure))
  assert.deepEqual(second.events, [{ kind: 'question', detail: 'permission to use Bash' }])
  assert.equal(premier.clean + second.clean, 'debutfin')
})
