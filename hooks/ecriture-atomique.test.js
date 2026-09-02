/**
 * Trois fichiers portent un état qu'une écriture interrompue détruit sans un
 * mot : les préférences du poste, les jetons d'intégration, et le `.gitignore`
 * du dépôt observé. Les trois se relisent avec un `catch` qui retombe sur un
 * défaut — donc une écriture coupée ne se voit pas, elle se traduit en
 * « l'utilisateur n'avait rien réglé ».
 *
 * Pour les intégrations, c'est pire qu'une perte locale : `writeIntegrations`
 * relit tout le fichier pour n'y remplacer qu'une entrée. Un fichier illisible
 * rend `{}`, et la sauvegarde suivante efface les jetons de **tous** les autres
 * projets.
 *
 * Ces tests ne simulent pas une coupure de courant — ils vérifient le seul
 * geste qui l'empêche : écrire à côté puis renommer, et refuser un lien
 * symbolique. Un fichier temporaire laissé derrière dirait l'inverse.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const bac = () => mkdtempSync(join(tmpdir(), 'ovrsee-atomique-'))

/** Aucun `*.tmp-*` ne doit survivre à une écriture réussie. */
const sansTemporaire = (dir, quoi) => {
  const restes = readdirSync(dir).filter(n => n.includes('.tmp-'))
  assert.deepEqual(restes, [], `${quoi} a laissé un fichier temporaire`)
}

test('les préférences s’écrivent par renommage, et refusent un lien symbolique', async () => {
  const dir = bac()
  const cible = join(dir, 'settings.json')
  process.env.OVRSEE_SETTINGS = cible
  const { writeSettings, readSettings } = await import('./settings.js')

  writeSettings({ theme: 'light' })
  assert.equal(readSettings().theme, 'light')
  sansTemporaire(dir, 'writeSettings')

  rmSync(cible)
  symlinkSync(join(dir, 'ailleurs.json'), cible)
  assert.throws(() => writeSettings({ theme: 'dark' }), /lien symbolique/)
  assert.equal(existsSync(join(dir, 'ailleurs.json')), false, 'le lien a été suivi')

  delete process.env.OVRSEE_SETTINGS
  rmSync(dir, { recursive: true, force: true })
})

test('les intégrations s’écrivent par renommage, et refusent un lien symbolique', async () => {
  const dir = bac()
  const cible = join(dir, 'integrations.json')
  process.env.OVRSEE_INTEGRATIONS = cible
  const { writeIntegrations, readIntegrations } = await import('./integrations.js')

  const entree = { id: 'a', provider: 'vercel', label: 'Prod', url: 'https://vercel.com/x/y' }
  writeIntegrations('/un/projet', [entree])
  assert.equal(readIntegrations('/un/projet').length, 1)
  sansTemporaire(dir, 'writeIntegrations')

  rmSync(cible)
  symlinkSync(join(dir, 'ailleurs.json'), cible)
  assert.throws(() => writeIntegrations('/un/projet', [entree]), /lien symbolique/)
  assert.equal(existsSync(join(dir, 'ailleurs.json')), false, 'le lien a été suivi')

  delete process.env.OVRSEE_INTEGRATIONS
  rmSync(dir, { recursive: true, force: true })
})

test('le .gitignore du dépôt observé s’écrit par renommage', async () => {
  const dir = bac()
  mkdirSync(join(dir, 'ovrsee'), { recursive: true })
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n')
  const { syncGitignore } = await import('./gitignore-sync.js')

  syncGitignore(dir)

  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /node_modules/)
  sansTemporaire(dir, 'syncGitignore')
  rmSync(dir, { recursive: true, force: true })
})
