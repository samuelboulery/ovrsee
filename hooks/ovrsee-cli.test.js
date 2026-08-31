import assert from 'node:assert/strict'
import test from 'node:test'

import { argumentsClose } from './ovrsee-cli.js'

// Le bug qui a motivé cette extraction : sans `--commit`, `indexOf` rend -1 et
// `-1 + 1` désigne le premier argument — le plan visé se faisait écarter, et la
// commande retombait sur « tous les plans ouverts ». Invisible tant qu'il n'y en
// avait qu'un à clore.
test('argumentsClose garde le plan visé quand --commit est absent', () => {
  assert.deepEqual(argumentsClose(['2026-08-31-un-plan.md']), {
    aide: false,
    cible: '2026-08-31-un-plan.md',
    sha: null,
  })
})

test('argumentsClose sans argument ne vise rien — la commande clôt tout', () => {
  assert.deepEqual(argumentsClose([]), { aide: false, cible: null, sha: null })
})

test('argumentsClose sépare le plan de la valeur de --commit', () => {
  assert.deepEqual(argumentsClose(['un-plan.md', '--commit', 'abc1234']), {
    aide: false,
    cible: 'un-plan.md',
    sha: 'abc1234',
  })
  // Et dans l'autre ordre : la valeur du drapeau n'est jamais prise pour le plan.
  assert.deepEqual(argumentsClose(['--commit', 'abc1234', 'un-plan.md']), {
    aide: false,
    cible: 'un-plan.md',
    sha: 'abc1234',
  })
})

test('argumentsClose refuse --commit sans valeur', () => {
  assert.throws(() => argumentsClose(['un-plan.md', '--commit']), /usage/)
})

test('argumentsClose refuse --commit sans plan à rattacher', () => {
  assert.throws(() => argumentsClose(['--commit', 'abc1234']), /exige le plan/)
})

test('argumentsClose : --help demande l’aide et rien d’autre', () => {
  for (const drapeau of ['--help', '-h']) {
    assert.deepEqual(argumentsClose(['un-plan.md', drapeau]), {
      aide: true,
      cible: null,
      sha: null,
    })
  }
})
