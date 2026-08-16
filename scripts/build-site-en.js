#!/usr/bin/env node
/**
 * Génère `site/en/index.html` depuis `site/index.html` et `site/dict.json`.
 *
 * Le français est le texte source ; l'anglais n'existait qu'au runtime, appliqué
 * nœud de texte par nœud de texte par `traduire()` (`site/app.js`). Utile pour un
 * visiteur, invisible pour un moteur : pas d'URL, donc rien à indexer.
 *
 * Ce script applique la même substitution, hors navigateur, sur le texte entre `>`
 * et `<`. Volontairement la même règle que `traduire()` — un texte qui se traduit
 * dans la page se traduit ici, et réciproquement. Le jour où l'une des deux dévie,
 * `build-site-en.test.js` le dit.
 *
 * La page est générée à la publication, jamais commitée : une copie figée
 * dériverait de `index.html` sans que rien ne le signale.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site')

const TITRE_EN = 'Ovrsee — project management for Claude Code'
const DESCRIPTION_EN =
  'Project management for Claude Code: the plans you approved, the commits that carry ' +
  'them out, the tickets left to do — versioned in your own repository.'
const PARTAGE_EN =
  'Vibecode fast, without losing track of the project. The plans you approved, the ' +
  'commits that carry them out, the tickets left to do — versioned in your own repository.'

// Ce que le `<head>` doit dire une fois la page servie sous /en/. Le dictionnaire ne
// couvre que le corps : ces chaînes-là n'existent nulle part ailleurs.
const TÊTE_EN = [
  [/<html lang="fr">/, '<html lang="en">'],
  [/<title>[^<]*<\/title>/, `<title>${TITRE_EN}</title>`],
  [/(<meta name="description" content=")[^"]*(">)/, `$1${DESCRIPTION_EN}$2`],
  [/(<link rel="canonical" href="https:\/\/ovrsee\.app\/)(">)/, '$1en/$2'],
  [/(<meta property="og:url" content="https:\/\/ovrsee\.app\/)(">)/, '$1en/$2'],
  [/(<meta property="og:locale" content=")fr_FR(">)/, '$1en_US$2'],
  [/(<meta property="og:locale:alternate" content=")en_US(">)/, '$1fr_FR$2'],
  [/(<meta property="og:title" content=")[^"]*(">)/, `$1${TITRE_EN}$2`],
  [/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${TITRE_EN}$2`],
  [/(<meta property="og:description" content=")[^"]*(">)/, `$1${PARTAGE_EN}$2`],
  [/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${PARTAGE_EN}$2`],
  [
    /(<meta property="og:image:alt" content=")[^"]*(">)/,
    '$1Ovrsee — vibecode fast, without losing track of the project.$2',
  ],
  // Dans le JSON-LD : même entité, décrite dans la langue de la page.
  [/("description": ")[^"]*(")/, `$1${DESCRIPTION_EN}$2`],
  [/("inLanguage": ")fr-FR(")/, '$1en$2'],
]

const ENTITÉS = { '&nbsp;': '\u00a0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** Le navigateur lit des nœuds décodés ; le dictionnaire est écrit dans cette langue-là.
 *  Sans ça, `Claude&nbsp;Code` ne rencontre jamais la clé `Claude Code`.
 *  @param {string} s @returns {string} */
const décoder = s => s.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, m => ENTITÉS[m])

/** @param {string} s @returns {string} */
const encoder = s =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;')

/**
 * Applique le dictionnaire au texte entre balises, comme `traduire()` le fait sur les
 * nœuds de texte du DOM : la clé est la valeur trimmée, et seule cette portion est
 * remplacée — les blancs autour tiennent la mise en page.
 *
 * Le ré-encodage ne touche que les segments traduits : un segment laissé tel quel sort
 * bit pour bit comme il est entré, entités numériques comprises.
 *
 * @param {string} html
 * @param {Record<string, string>} dict
 * @returns {string}
 */
export function traduire(html, dict) {
  return html.replace(/>([^<>]+)</g, (entier, brut) => {
    const décodé = décoder(brut)
    const texte = décodé.trim()
    const cible = dict[texte]
    return cible && cible !== texte ? '>' + encoder(décodé.replace(texte, cible)) + '<' : entier
  })
}

/**
 * @param {string} html
 * @returns {string}
 */
function réécrireTête(html) {
  return TÊTE_EN.reduce((acc, [motif, remplacement]) => {
    if (!motif.test(acc)) throw new Error(`motif introuvable dans le <head> : ${motif}`)
    return acc.replace(motif, remplacement)
  }, html)
}

/**
 * @param {string} html source française
 * @param {Record<string, string>} dict
 * @returns {string} la page anglaise
 */
export function construire(html, dict) {
  const tête = réécrireTête(html)

  // Le corps seul : traduire le `<head>` réécrirait des URL et des `content` de méta.
  const coupe = tête.indexOf('</head>')
  if (coupe === -1) throw new Error('pas de </head> dans la page source')
  return tête.slice(0, coupe) + traduire(tête.slice(coupe), dict)
}

/** @returns {{ html: string, dict: Record<string, string> }} */
export function sources() {
  return {
    html: readFileSync(join(SITE, 'index.html'), 'utf8'),
    dict: JSON.parse(readFileSync(join(SITE, 'dict.json'), 'utf8')),
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { html, dict } = sources()
  mkdirSync(join(SITE, 'en'), { recursive: true })
  writeFileSync(join(SITE, 'en', 'index.html'), construire(html, dict))
  // stdout reste libre : ce script tourne dans des pipelines.
  process.stderr.write(`site/en/index.html écrit — ${Object.keys(dict).length} entrées\n`)
}
