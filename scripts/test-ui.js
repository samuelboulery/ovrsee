#!/usr/bin/env node
/**
 * Compile `app/src` puis lance ses tests.
 *
 * `node --test` ne lit ni le TypeScript ni le JSX. Plutôt que d'ajouter un
 * second lanceur de tests au projet, on traduit `app/src` en JavaScript dans un
 * dossier jetable et on fait tourner `node --test` dessus — le même lanceur que
 * `hooks/`, `crawl/` et `server/`.
 *
 * Le `package.json` déposé dans le dossier de sortie est ce qui rend la chose
 * possible : le dépôt est en `"type": "module"`, donc Node exigerait une
 * extension sur chaque import (`./data.js`), que `tsc` n'écrit pas. Marquer le
 * seul dossier de sortie comme CommonJS règle la résolution sans toucher au
 * code source.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'app', '.test-build')

const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit', encoding: 'utf8' })

// Repartir d'un dossier vide : un fichier compilé lors d'une configuration
// précédente resterait sinon dans la liste des tests, et mentirait longtemps.
rmSync(out, { recursive: true, force: true })

run('node', [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.test.json'])

writeFileSync(join(out, 'package.json'), '{ "type": "commonjs" }\n', 'utf8')

/** Les fichiers `*.test.js` du dossier compilé, en chemins relatifs à la racine. */
function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return tests(full)
    return entry.name.endsWith('.test.js') ? [relative(root, full)] : []
  })
}

const found = existsSync(out) ? tests(out) : []
if (found.length === 0) {
  process.stderr.write('[test-ui] aucun test compilé dans app/.test-build/\n')
  process.exit(1)
}

run('node', ['--test', ...found])
