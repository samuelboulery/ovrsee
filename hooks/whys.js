/**
 * Les commentaires `WHY:` qui justifient une dépendance.
 *
 * L'onglet Stack promettait depuis le début de remonter à « un commentaire
 * `# WHY:` ou à un plan ». Le premier n'existait pas, et le second était une
 * recherche de sous-chaîne : un plan qui citait `node-pty` en passant devenait
 * la raison de `node-pty`. Une mention n'est pas une justification, et une
 * fausse raison est pire que « aucune raison tracée » — c'est exactement la
 * dérive que le cadrage désigne comme ce qui détruit la confiance (§2).
 *
 * La règle est donc étroite, et volontairement : **une raison est un
 * commentaire `WHY:` posé juste au-dessus de l'import du paquet.** Rien
 * d'autre ne compte. Adjacence textuelle, pas de devinette.
 *
 * ```js
 * // WHY: le seul pty qui compile en arm64 sans toolchain.
 * import { spawn } from 'node-pty'
 * ```
 *
 * Limité aux imports JavaScript et TypeScript : c'est ce que l'ovrsee sait
 * lire aujourd'hui. Un projet Python affichera « aucune raison tracée », ce qui
 * est vrai, plutôt qu'une raison inventée.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

/** Dossiers qu'on ne parcourt jamais : engendrés, tiers, ou volumineux. */
const IGNORES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'release',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  'graphify-out',
  'obsidian',
  '.test-build',
])

const EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])

/** Au-delà, on a affaire à un fichier engendré, pas à du code qu'on commente. */
const MAX_BYTES = 512 * 1024

/** Garde-fou : un dépôt monstrueux ne doit pas bloquer l'ouverture d'un projet. */
const MAX_FILES = 4000

/** `WHY:` en commentaire de ligne (`//`, `#`) ou de bloc (`*`). */
const WHY = /^\s*(?:\/\/|#|\*|\/\*)\s*WHY:\s*(.+?)\s*(?:\*\/)?\s*$/

/** La continuation d'un commentaire, pour les raisons qui tiennent sur deux lignes. */
const SUITE = /^\s*(?:\/\/|#|\*)\s*(.+?)\s*(?:\*\/)?\s*$/

/**
 * Le spécificateur importé par une ligne, s'il y en a un.
 *
 * `import x from 'a'`, `import 'a'`, `export * from 'a'`, `require('a')`,
 * `import('a')` — les cinq formes qui apparaissent en tête de fichier.
 * L'import à effet de bord (`import 'a'`, sans `from`) compte : c'est celui
 * d'une feuille de style ou d'un polyfill, et il mérite autant une raison.
 */
const SPEC = /(?:from\s*|require\s*\(\s*|import\s*\(?\s*)['"]([^'"]+)['"]/

/**
 * Le nom de paquet d'un spécificateur, ou null pour un chemin relatif.
 *
 * `@xterm/xterm/css/xterm.css` → `@xterm/xterm`. `node:fs` → null : ce n'est
 * pas une dépendance déclarée.
 */
export function packageOf(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) return null
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null
  if (specifier.startsWith('node:')) return null

  const parts = specifier.split('/')
  if (specifier.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null
  }
  return parts[0] || null
}

/**
 * Les raisons trouvées dans un fichier : nom de paquet → raison.
 *
 * Le commentaire doit précéder immédiatement l'import — au plus une ligne vide
 * entre les deux, pour tolérer le style qui aère. Au-delà, l'adjacence ne veut
 * plus rien dire et on retombe dans la devinette.
 */
export function whysInSource(source) {
  const lignes = source.split('\n')
  const out = new Map()

  for (let i = 0; i < lignes.length; i += 1) {
    const spec = lignes[i].match(SPEC)
    if (!spec) continue
    const paquet = packageOf(spec[1])
    if (!paquet || out.has(paquet)) continue

    // Remonter les lignes de commentaire au-dessus de l'import, jusqu'au
    // `WHY:`. Les lignes qui suivent le `WHY:` en sont la suite.
    const suites = []
    for (let j = i - 1; j >= 0 && i - j <= 6; j -= 1) {
      const ligne = lignes[j]
      if (ligne.trim() === '' && suites.length === 0) continue

      const why = ligne.match(WHY)
      if (why) {
        out.set(paquet, [why[1], ...suites.reverse()].join(' ').trim())
        break
      }

      const suite = ligne.match(SUITE)
      if (!suite) break
      suites.push(suite[1])
    }
  }

  return out
}

/**
 * Toutes les raisons d'un dépôt : nom de paquet → raison.
 *
 * Le premier `WHY:` rencontré gagne. Deux commentaires pour un même paquet
 * seraient déjà une contradiction ; en choisir un au hasard n'aiderait
 * personne, mais le parcours est déterministe (dossiers triés), donc au moins
 * l'affichage ne change pas d'une lecture à l'autre.
 */
export function readWhys(root) {
  const out = {}
  let restant = MAX_FILES

  const parcourir = dir => {
    if (restant <= 0) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    } catch {
      return
    }

    for (const entry of entries) {
      if (restant <= 0) return
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue
      if (IGNORES.has(entry.name)) continue

      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        parcourir(full)
        continue
      }
      if (!EXTENSIONS.has(extname(entry.name))) continue

      try {
        if (statSync(full).size > MAX_BYTES) continue
        restant -= 1
        for (const [paquet, raison] of whysInSource(readFileSync(full, 'utf8'))) {
          if (!(paquet in out)) out[paquet] = raison
        }
      } catch {
        // Un fichier illisible n'est pas une raison de ne rien rendre.
      }
    }
  }

  parcourir(root)
  return out
}
