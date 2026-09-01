import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { contraste } from './contraste.js'

/**
 * Le thème clair (T-0227, issue #64).
 *
 * Trois choses qu'aucun autre test ne dit.
 *
 * D'abord qu'aucun jeton n'a sa seule définition dans un bloc de thème : un
 * jeton absent du `:root` disparaîtrait purement et simplement en sombre, et
 * rien ne le signalerait — une couleur manquante rend `transparent`.
 *
 * Ensuite que le bloc clair ne touche à aucun palier de rampe d'accent.
 * `:root[data-theme='light']` pèse 0,2,0 quand `[data-accent='ambre']` pèse
 * 0,1,0 : y redéfinir un palier écraserait les six accents de projet. Le clair
 * ne change pas la rampe, il change le palier qu'on y prend.
 *
 * Enfin que la palette claire tient. La règle n'est pas « AA dans l'absolu » —
 * le sombre lui-même ne tient pas 4,5:1 sur ses trois derniers niveaux de
 * texte. Elle est à parité : chaque niveau clair tient au moins ce que tient
 * son homologue sombre, mesuré sur la pire surface de son propre thème.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(racine, '_ds', 'ovrsee', 'styles.css'), 'utf8')

const bloc = selecteur => {
  const trouve = css.match(new RegExp(`${selecteur}\\s*\\{([\\s\\S]*?)\\n\\}`))
  assert.ok(trouve, `bloc ${selecteur} introuvable dans _ds/ovrsee/styles.css`)
  return trouve[1]
}

/** Les déclarations `--jeton: valeur;` d'un bloc, en table. */
const jetons = source =>
  Object.fromEntries([...source.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))

const SOMBRE = jetons(bloc(':root'))
const CLAIR = jetons(bloc(":root\\[data-theme='light'\\]"))

/** La pire surface d'un thème pour y poser du texte. */
const PIRE = { sombre: SOMBRE['--color-surface-control'], clair: CLAIR['--color-bg'] }

const NIVEAUX = [
  '--color-text',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-quaternary',
  '--color-text-discrete',
  '--color-text-faint',
  '--color-text-ghost',
]

test('aucun jeton n’a sa seule définition dans un bloc de thème', () => {
  const orphelins = Object.keys(CLAIR).filter(nom => !(nom in SOMBRE))
  assert.deepEqual(orphelins, [], 'ces jetons manquent au :root et vaudraient transparent en sombre')
})

test('le bloc clair ne redéfinit aucun palier de rampe d’accent', () => {
  // La liste n'est pas écrite ici : elle se lit dans les blocs d'accent, moins
  // `--color-accent` lui-même, qui est précisément le levier (test suivant).
  // Un palier qu'ils gagneraient un jour serait protégé sans qu'on y pense.
  const paliers = new Set(
    [...css.matchAll(/\[data-accent='[a-z]+'\]\s*\{([^}]*)\}/g)]
      .flatMap(m => Object.keys(jetons(m[1])))
      .filter(nom => nom !== '--color-accent'),
  )
  const empietes = Object.keys(CLAIR).filter(nom => paliers.has(nom))
  assert.deepEqual(empietes, [], 'redéfinir un palier écraserait les six accents de projet')
})

test('en clair, l’accent descend dans la rampe du projet, il ne la quitte pas', () => {
  // Un hex ici rendrait les six projets de la même couleur. La valeur doit
  // citer un palier : c'est le bloc `[data-accent]` en vigueur qui le fournit,
  // donc la teinte du projet est conservée. Même exigence pour les rôles.
  for (const role of ['--color-accent', '--color-accent-ink', '--color-accent-fill',
                      '--color-accent-edge', '--color-accent-line']) {
    assert.match(CLAIR[role], /^var\(--color-accent-\d00\)$/, `${role} doit citer un palier`)
  }
})

test('chaque accent tient le contraste sur le fond clair, dans les deux sens', () => {
  // Le pendant du test de `accents.test.js`, qui ne mesure que sur fond sombre
  // et resterait vert avec une palette claire illisible.
  const palier = CLAIR['--color-accent'].match(/(\d00)/)[1]
  const racineJetons = jetons(bloc(':root'))

  for (const trouve of css.matchAll(/\[data-accent='([a-z]+)'\]\s*\{([^}]*)\}/g)) {
    const [, nom, regles] = trouve
    // Le violet ne redéfinit pas sa rampe : elle est celle du `:root`.
    const couleur = jetons(regles)[`--color-accent-${palier}`] ?? racineJetons[`--color-accent-${palier}`]

    const surFond = contraste(couleur, CLAIR['--color-bg'])
    assert.ok(surFond >= 4.5, `${nom} (${couleur}) : ${surFond.toFixed(2)}:1 sur le fond clair`)

    const sousLibelle = contraste(couleur, CLAIR['--color-on-accent'])
    assert.ok(sousLibelle >= 4.5, `${nom} (${couleur}) : ${sousLibelle.toFixed(2)}:1 sous un libellé de bouton`)
  }
})

test('chaque niveau de texte tient en clair ce qu’il tient en sombre', () => {
  for (const niveau of NIVEAUX) {
    const enClair = contraste(CLAIR[niveau], PIRE.clair)
    const enSombre = contraste(SOMBRE[niveau], PIRE.sombre)
    assert.ok(
      enClair >= enSombre,
      `${niveau} : ${enClair.toFixed(2)}:1 en clair contre ${enSombre.toFixed(2)}:1 en sombre`,
    )
  }
})

test('les surfaces claires vont bien du fond vers la carte', () => {
  // L'ordre du sombre s'inverse : en clair, le fond applicatif est le plus
  // sombre des trois et les cartes montent vers le blanc. Une carte plus
  // sombre que son fond, et toute l'élévation se lit à l'envers.
  const l = nom => contraste(CLAIR[nom], '#000000')
  assert.ok(l('--color-surface-card') > l('--color-surface-panel'), 'la carte doit être plus claire que le panneau')
  assert.ok(l('--color-surface-panel') > l('--color-surface'), 'le panneau doit être plus clair que les rails')
  assert.ok(l('--color-surface') > l('--color-bg'), 'les rails doivent être plus clairs que le fond applicatif')
})

test('les deux thèmes déclarent leur color-scheme', () => {
  // Sans lui, les contrôles natifs, l'autofill et les ascenseurs par défaut
  // gardent l'apparence du thème système, pas celle de l'application.
  assert.match(bloc(':root'), /color-scheme:\s*dark/)
  assert.match(bloc(":root\\[data-theme='light'\\]"), /color-scheme:\s*light/)
})
