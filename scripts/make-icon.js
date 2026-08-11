#!/usr/bin/env node
/**
 * Fabrique `build/icon.icns` à partir d'un dessin décrit ici.
 *
 *   node scripts/make-icon.js
 *
 * L'icône est la marque de l'ovrsee : un œil en grille de pixels 7×5
 * (maquette 2a, refonte T-0050) — mêmes coordonnées que `Logo` dans
 * `app/src/OnboardingArt.tsx`, en hex littéral parce qu'un SVG rendu hors
 * navigateur n'a pas de variables CSS à résoudre. Les deux formes sont à
 * garder d'accord — voir le WHY de ce fichier-là.
 *
 * Le dessin vit dans ce fichier plutôt que comme binaire opaque dans le dépôt :
 * on peut le relire, le corriger, et le régénérer. Playwright fait le rendu —
 * il est déjà là pour le crawl — puis `sips` et `iconutil`, fournis par macOS,
 * déclinent et assemblent.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const ICONSET = join(BUILD, 'icon.iconset')

// Palette du système Ovrsee (T-0045), littérale : ce SVG est rendu hors
// navigateur, il n'a pas les variables CSS de `_ds/ovrsee/styles.css`.
const GROUND = '#08090a'
const PANEL = '#101114'
const DIVIDER = '#1c1d24'
const ACCENT = '#7d76f0'
const OUTER = '#495969' // neutral-700
const MID = '#8799ab' // neutral-500

/**
 * Le dessin, en unités de 1024. Grille de pixels 7×5, module carré, gouttière
 * à 30 % du module (maquette 2a) — mêmes coordonnées que `Logo` dans
 * `app/src/OnboardingArt.tsx`.
 *
 * Volontairement pauvre en détails : dans le Dock, l'icône fait 32 pixels de
 * côté. Un pixel de la grille y vaut environ 2 pixels d'écran — la forme
 * générale (le losange de l'œil) reste lisible, le détail interne non, et
 * ce n'est pas grave : c'est la silhouette qui doit se reconnaître.
 */
const MODULE = 90
const GUTTER = 27
const STEP = MODULE + GUTTER
const GRID_W = 7 * MODULE + 6 * GUTTER
const GRID_H = 5 * MODULE + 4 * GUTTER
const OFFSET_X = (1024 - GRID_W) / 2
const OFFSET_Y = (1024 - GRID_H) / 2

const PIXELS = [
  [0, 2, OUTER], [0, 3, OUTER], [0, 4, OUTER],
  [1, 1, MID], [1, 5, MID],
  [2, 0, MID], [2, 2, ACCENT], [2, 3, ACCENT], [2, 4, ACCENT], [2, 6, MID],
  [3, 1, MID], [3, 5, MID],
  [4, 2, OUTER], [4, 3, OUTER], [4, 4, OUTER],
]

const pixelRects = PIXELS.map(
  ([ligne, colonne, fill]) =>
    `<rect x="${OFFSET_X + colonne * STEP}" y="${OFFSET_Y + ligne * STEP}" width="${MODULE}" height="${MODULE}" fill="${fill}"/>`,
).join('\n    ')

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PANEL}"/>
      <stop offset="100%" stop-color="${GROUND}"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" rx="228" fill="url(#fond)"/>
  <rect x="6" y="6" width="1012" height="1012" rx="224" fill="none"
        stroke="${DIVIDER}" stroke-width="12"/>

  <g>
    ${pixelRects}
  </g>
</svg>`

/** Tailles exigées par un `.iconset` macOS : nom de fichier → côté en pixels. */
const SIZES = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

/**
 * Empaquette des PNG en `.ico` : ICONDIR + une ICONDIRENTRY par image, données
 * PNG brutes à la suite — format supporté nativement depuis Windows Vista, pas
 * besoin de réencoder en bitmap. Pas de dépendance : juste des buffers.
 */
function packIco(pngBuffers) {
  const HEADER = 6
  const ENTRY = 16
  const offset = HEADER + ENTRY * pngBuffers.length

  const header = Buffer.alloc(HEADER)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(pngBuffers.length, 4)

  let cursor = offset
  const entries = pngBuffers.map(({ size, data }) => {
    const entry = Buffer.alloc(ENTRY)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width, 0 = 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height, 0 = 256
    entry.writeUInt8(0, 2) // palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bitcount
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(cursor, 12)
    cursor += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...pngBuffers.map(p => p.data)])
}

async function render() {
  mkdirSync(ICONSET, { recursive: true })
  const master = join(BUILD, 'icon-1024.png')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 1024 },
      deviceScaleFactor: 1,
    })
    // `transparent` pour que les coins arrondis restent transparents.
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg}</body>`,
      { waitUntil: 'load' },
    )
    await page.screenshot({ path: master, omitBackground: true })
  } finally {
    await browser.close()
  }

  for (const [name, size] of SIZES) {
    execFileSync('sips', ['-z', String(size), String(size), master, '--out', join(ICONSET, name)], {
      stdio: 'ignore',
    })
  }

  execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', join(BUILD, 'icon.icns')])

  // Tailles conventionnelles d'un .ico Windows. 48 n'est pas dans l'iconset
  // mac, rendu à part.
  const ICO_SIZES = [16, 32, 48, 256]
  const ico48 = join(ICONSET, 'icon_48x48.png')
  execFileSync('sips', ['-z', '48', '48', master, '--out', ico48], { stdio: 'ignore' })
  const icoSource = { 16: 'icon_16x16.png', 32: 'icon_32x32.png', 48: 'icon_48x48.png', 256: 'icon_256x256.png' }
  const pngBuffers = ICO_SIZES.map(size => ({ size, data: readFileSync(join(ICONSET, icoSource[size])) }))
  writeFileSync(join(BUILD, 'icon.ico'), packIco(pngBuffers))

  rmSync(ICONSET, { recursive: true, force: true })

  // electron-builder lit `build/` (buildResources) et reprend icon.icns /
  // icon.ico automatiquement. Le PNG maître sert aussi de source pour
  // d'autres usages.
  writeFileSync(join(BUILD, 'icon.svg'), svg.trim() + '\n', 'utf8')
  console.log('build/icon.icns et build/icon.ico écrits')
}

render().catch(err => {
  console.error(`échec : ${err?.message ?? err}`)
  process.exit(1)
})
