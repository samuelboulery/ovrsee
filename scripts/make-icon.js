#!/usr/bin/env node
/**
 * Fabrique `build/icon.icns` et `build/icon.ico` à partir de `build/icon.svg`.
 *
 *   node scripts/make-icon.js
 *
 * **`build/icon.svg` est la source.** Il l'était déjà en fait — le script le
 * décrivait en dur puis l'écrivait — mais il ne l'était pas en droit : on
 * corrigeait le dessin dans ce fichier-ci. Depuis T-0202, le dessin se corrige
 * dans le SVG, et ce script ne fait plus que décliner et assembler.
 *
 * Conséquence sur le lien avec `Logo` (`app/src/OnboardingArt.tsx`) : les deux
 * portaient les mêmes coordonnées, écrites deux fois. Elles restent à garder
 * d'accord, mais le SVG fait désormais foi — voir le WHY de `OnboardingArt`.
 *
 * L'icône est la marque de l'ovrsee : un œil en grille de pixels 7×5
 * (maquette 2a, refonte T-0050). Volontairement pauvre en détails : dans le
 * Dock, elle fait 32 pixels de côté. La silhouette (le losange de l'œil) doit
 * se reconnaître, le détail interne non.
 *
 * `sips` et `iconutil`, fournis par macOS, suffisent : `sips` lit le SVG
 * directement. Le passage par un navigateur — Playwright, lancé pour rendre un
 * SVG déjà sur le disque — a disparu avec T-0202.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const ICONSET = join(BUILD, 'icon.iconset')
const SOURCE = join(BUILD, 'icon.svg')

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

function render() {
  readFileSync(SOURCE) // échoue net et tôt si la source manque

  mkdirSync(ICONSET, { recursive: true })
  const master = join(BUILD, 'icon-1024.png')

  // Le maître est rasterisé une fois depuis le SVG ; les déclinaisons le
  // réduisent, lui. Rasteriser chaque taille directement depuis le SVG
  // donnerait des petits formats plus nets — et différents de ceux qu'on
  // expédie depuis T-0050. Ce n'est pas ce ticket-ci qui change l'icône.
  //
  // `-z` seul ne convertit pas : sans `-s format png`, sips écrirait un SVG
  // redimensionné sous un nom en `.png`.
  execFileSync('sips', ['-s', 'format', 'png', '-z', '1024', '1024', SOURCE, '--out', master], {
    stdio: 'ignore',
  })

  const png = (size, out) =>
    execFileSync('sips', ['-z', String(size), String(size), master, '--out', out], { stdio: 'ignore' })

  for (const [name, size] of SIZES) png(size, join(ICONSET, name))

  execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', join(BUILD, 'icon.icns')])

  // Tailles conventionnelles d'un .ico Windows. 48 n'est pas dans l'iconset
  // mac, rendu à part.
  const ICO_SIZES = [16, 32, 48, 256]
  const ico48 = join(ICONSET, 'icon_48x48.png')
  png(48, ico48)
  const icoSource = { 16: 'icon_16x16.png', 32: 'icon_32x32.png', 48: 'icon_48x48.png', 256: 'icon_256x256.png' }
  const pngBuffers = ICO_SIZES.map(size => ({ size, data: readFileSync(join(ICONSET, icoSource[size])) }))
  writeFileSync(join(BUILD, 'icon.ico'), packIco(pngBuffers))

  rmSync(ICONSET, { recursive: true, force: true })

  // electron-builder lit `build/` (buildResources) et reprend icon.icns /
  // icon.ico automatiquement. Le PNG maître sert aussi de source pour
  // d'autres usages.
  console.log('build/icon.icns et build/icon.ico écrits')
}

try {
  render()
} catch (err) {
  console.error(`échec : ${err?.message ?? err}`)
  process.exit(1)
}
