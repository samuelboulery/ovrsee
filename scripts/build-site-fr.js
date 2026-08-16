#!/usr/bin/env node
/**
 * Génère `site/fr/index.html` depuis `site/index.html` et `site/dict.json`.
 *
 * L'anglais est le texte source — c'est la page servie à la racine. Le français
 * s'obtient en appliquant le dictionnaire, exactement comme `traduire()` le fait
 * au runtime dans `site/app.js` sur les libellés que le gabarit injecte. Même
 * règle des deux côtés : le jour où l'une dévie, `build-site-fr.test.js` le dit.
 *
 * La page est générée à la publication, jamais commitée : une copie figée
 * dériverait de `index.html` sans que rien ne le signale.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site')

const TITRE_FR = 'Ovrsee — gestion de projet pour Claude Code'
const DESCRIPTION_FR =
  'Gestion de projet pour Claude Code : les plans approuvés, les commits qui les ' +
  'réalisent, les tickets à faire — versionnés dans votre dépôt.'
const PARTAGE_FR =
  'Vibecoder vite, sans perdre le fil du projet. Les plans approuvés, les commits ' +
  'qui les réalisent, les tickets à faire — versionnés dans votre dépôt.'

// Ce que le `<head>` doit dire une fois la page servie sous /fr/. Le dictionnaire ne
// couvre que le corps : ces chaînes-là n'existent nulle part ailleurs.
const TÊTE_FR = [
  [/<html lang="en">/, '<html lang="fr">'],
  [/<title>[^<]*<\/title>/, `<title>${TITRE_FR}</title>`],
  [/(<meta name="description" content=")[^"]*(">)/, `$1${DESCRIPTION_FR}$2`],
  [/(<link rel="canonical" href="https:\/\/ovrsee\.app\/)(">)/, '$1fr/$2'],
  [/(<meta property="og:url" content="https:\/\/ovrsee\.app\/)(">)/, '$1fr/$2'],
  [/(<meta property="og:locale" content=")en_US(">)/, '$1fr_FR$2'],
  [/(<meta property="og:locale:alternate" content=")fr_FR(">)/, '$1en_US$2'],
  [/(<meta property="og:title" content=")[^"]*(">)/, `$1${TITRE_FR}$2`],
  [/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${TITRE_FR}$2`],
  [/(<meta property="og:description" content=")[^"]*(">)/, `$1${PARTAGE_FR}$2`],
  [/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${PARTAGE_FR}$2`],
  [
    /(<meta property="og:image:alt" content=")[^"]*(">)/,
    '$1Ovrsee — vibecoder vite, sans perdre le fil du projet.$2',
  ],
  // Dans le JSON-LD : même entité, décrite dans la langue de la page.
  [/("description": ")[^"]*(")/, `$1${DESCRIPTION_FR}$2`],
  [/("inLanguage": ")en(")/, '$1fr-FR$2'],
]

const ENTITÉS = { '&nbsp;': '\u00a0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** Le navigateur lit des nœuds décodés ; le dictionnaire est écrit dans cette langue-là.
 *  Sans ça, `Claude&nbsp;Code` ne rencontre jamais la clé `Claude Code`.
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
  return TÊTE_FR.reduce((acc, [motif, remplacement]) => {
    if (!motif.test(acc)) throw new Error(`motif introuvable dans le <head> : ${motif}`)
    return acc.replace(motif, remplacement)
  }, html)
}

/**
 * @param {string} html source anglaise
 * @param {Record<string, string>} dict
 * @returns {string} la page française
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
  mkdirSync(join(SITE, 'fr'), { recursive: true })
  writeFileSync(join(SITE, 'fr', 'index.html'), construire(html, dict))
  // stdout reste libre : ce script tourne dans des pipelines.
  process.stderr.write(`site/fr/index.html écrit — ${Object.keys(dict).length} entrées\n`)
}
