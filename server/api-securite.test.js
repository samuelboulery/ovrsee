/**
 * Les routes `/api/*` face à un dépôt observé hostile et à une page tierce
 * (audit de sécurité, T-0274). Le dev server Vite sert ces routes en HTTP
 * local non authentifié : une page web visitée pendant `pnpm dev` peut y
 * envoyer des GET sans préflight, et un dépôt peut versionner des liens.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'

import { fetchHandler, nodeMiddleware, resolve } from './api.js'
import { registerProject } from '../hooks/plans.js'
import { readGraph, snapshot } from '../hooks/snapshot.js'

const url = path => new URL(path, 'http://localhost')

/** Un projet équipé, inscrit à un registre neuf, et un dossier hors du dépôt. */
const projet = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-secu-'))
  const dehors = mkdtempSync(join(tmpdir(), 'ovrsee-secu-dehors-'))
  mkdirSync(join(dir, 'ovrsee', 'pages', 'shots', 'accueil'), { recursive: true })
  writeFileSync(join(dir, 'ovrsee', 'pages', 'shots', 'accueil', '2026-08-08-abc.png'), 'png')
  writeFileSync(join(dehors, 'id_ed25519'), 'CLE PRIVEE')
  process.env.OVRSEE_REGISTRY = join(mkdtempSync(join(tmpdir(), 'ovrsee-reg-')), 'projects.json')
  registerProject(dir)
  return { dir, dehors }
}

const q = (route, dir, file) =>
  url(`${route}?path=${encodeURIComponent(dir)}${file === undefined ? '' : `&file=${encodeURIComponent(file)}`}`)

// --- lectures qui suivaient les liens --------------------------------------

test('/api/shot refuse une capture liée hors du dépôt', () => {
  const { dir, dehors } = projet()
  symlinkSync(join(dehors, 'id_ed25519'), join(dir, 'ovrsee', 'pages', 'shots', 'accueil', 'x.png'))
  assert.equal(resolve(q('/api/shot', dir, 'shots/accueil/x.png'), dir).status, 404)
})

test('/api/shot refuse un dossier ou un fichier qui n’est pas une capture', () => {
  const { dir } = projet()
  writeFileSync(join(dir, 'ovrsee', 'pages', 'pages.json'), '{}')
  for (const file of ['shots', 'shots/accueil', 'pages.json']) {
    assert.equal(resolve(q('/api/shot', dir, file), dir).status, 404, file)
  }
  assert.ok('file' in resolve(q('/api/shot', dir, 'shots/accueil/2026-08-08-abc.png'), dir))
})

test('/api/media refuse une image liée hors du dépôt, et un dossier', () => {
  const { dir, dehors } = projet()
  mkdirSync(join(dir, 'docs', 'dossier.png'), { recursive: true })
  symlinkSync(join(dehors, 'id_ed25519'), join(dir, 'docs', 'logo.png'))
  assert.equal(resolve(q('/api/media', dir, 'docs/logo.png'), dir).status, 404)
  assert.equal(resolve(q('/api/media', dir, 'docs/dossier.png'), dir).status, 404)
})

test('le README et le graphe ne sont pas lus à travers un lien qui sort du dépôt', () => {
  const { dir, dehors } = projet()
  symlinkSync(join(dehors, 'id_ed25519'), join(dir, 'README.md'))
  writeFileSync(join(dehors, 'settings.json'), JSON.stringify({ nodes: [], env: { CLE: 'secret' } }))
  mkdirSync(join(dir, 'graphify-out'))
  symlinkSync(join(dehors, 'settings.json'), join(dir, 'graphify-out', 'graph.json'))

  assert.equal(snapshot(dir).readme, null)
  assert.equal(readGraph(dir, {}).graph, null)
})

// --- le serveur ne tombe pas -----------------------------------------------

/** Un projet dont la lecture lève : `ovrsee/.active` est un lien, que l'écriture refuse. */
const projetQuiLeve = () => {
  const { dir, dehors } = projet()
  symlinkSync(dehors, join(dir, 'ovrsee', '.active'))
  writeFileSync(join(dir, 'ovrsee', '.active-plan'), 'x.md\n')
  return dir
}

test('une exception de resolve() devient un 500 sous Vite, sans faire tomber le serveur', async () => {
  const dir = projetQuiLeve()
  const res = new PassThrough()
  let statut
  let corps = ''
  res.setHeader = () => {}
  res.end = texte => {
    statut = res.statusCode
    corps = texte
  }
  await nodeMiddleware(dir)(
    { url: `/api/project?path=${encodeURIComponent(dir)}`, method: 'GET', headers: {} },
    res,
    () => {},
  )
  assert.equal(statut, 500)
  assert.doesNotMatch(corps, /lien symbolique|\/var\/|\/tmp\//, 'aucun détail interne dans la réponse')
})

test('une exception de resolve() devient un 500 sous Electron', async () => {
  const dir = projetQuiLeve()
  const reponse = await fetchHandler(url(`/api/project?path=${encodeURIComponent(dir)}`), dir, null)
  assert.equal(reponse.status, 500)
})

test('un fichier qui disparaît entre la résolution et la lecture ne fait pas tomber Vite', async () => {
  const { dir } = projet()
  const res = new PassThrough()
  res.setHeader = () => {}
  const fichier = join(dir, 'ovrsee', 'pages', 'shots', 'accueil', '2026-08-08-abc.png')
  // Remplacé par un dossier après coup : `createReadStream` lève EISDIR.
  const req = { url: `/api/shot?path=${encodeURIComponent(dir)}&file=shots/accueil/2026-08-08-abc.png`, method: 'GET', headers: {} }
  const middleware = nodeMiddleware(dir)
  const { rmSync } = await import('node:fs')
  const enCours = middleware(req, res, () => {})
  rmSync(fichier)
  mkdirSync(fichier)
  await enCours
  await new Promise(fini => setTimeout(fini, 50))
  assert.ok(true, 'le processus est toujours là')
})

// --- page tierce -----------------------------------------------------------

test('une requête cross-site est refusée, même en GET sans Origin', () => {
  const { dir } = projet()
  for (const site of ['cross-site', 'same-site']) {
    const r = resolve(url('/api/projects'), dir, { method: 'GET', headers: { 'sec-fetch-site': site } })
    assert.equal(r.status, 403, site)
  }
  for (const site of ['same-origin', 'none', undefined]) {
    const r = resolve(url('/api/projects'), dir, { method: 'GET', headers: site ? { 'sec-fetch-site': site } : {} })
    assert.ok(!r.status || r.status === 200, String(site))
  }
})

test('sous Vite, X-Ovrsee doit porter le jeton du serveur, pas une constante', () => {
  const { dir } = projet()
  const corps = { action: 'create', titre: 'x' }
  const avec = valeur =>
    resolve(url(`/api/tickets?path=${encodeURIComponent(dir)}`), dir, {
      method: 'POST',
      headers: { origin: 'http://localhost:5180', 'x-ovrsee': valeur },
      body: corps,
      jeton: 'jeton-du-serveur',
    })
  assert.equal(avec('1').status, 403)
  assert.notEqual(avec('jeton-du-serveur').status, 403)
})

test('un corps découpé au milieu d’un caractère est relu intact', async () => {
  const { dir } = projet()
  // Un vrai flux, comme `IncomingMessage` : c'est lui qui sait décoder.
  const req = new PassThrough()
  Object.assign(req, {
    url: `/api/tickets?path=${encodeURIComponent(dir)}`,
    method: 'POST',
    headers: { origin: 'http://localhost:5180', 'x-ovrsee': '1', 'content-type': 'application/json' },
  })
  let corps = ''
  const res = { statusCode: 200, setHeader: () => {}, end: texte => (corps = texte) }
  const fini = nodeMiddleware(dir)(req, res, () => {})
  const octets = Buffer.from(JSON.stringify({ action: 'create', titre: 'Égalité' }))
  const coupe = octets.indexOf(0xc3) + 1 // au milieu du É
  req.write(octets.subarray(0, coupe))
  req.end(octets.subarray(coupe))
  await fini
  assert.match(corps, /Égalité/)
})

test('une URL que `new URL` refuse ne fait pas tomber le dev server', async () => {
  // `<img src="http://localhost:5180//">` depuis n'importe quelle page : le
  // middleware est async, et sa promesse rejetée tuait le processus.
  for (const chemin of ['//', '//[', '/\\', 'http://']) {
    let statut
    const res = { setHeader: () => {}, end: () => (statut = res.statusCode) }
    await nodeMiddleware()({ url: chemin, method: 'GET', headers: {} }, res, () => (statut = 'next'))
    assert.ok(statut === 400 || statut === 'next', `${chemin} → ${statut}`)
  }
})

test('les journaux et le tableau de ovrsee/ ne se lisent pas à travers un lien qui sort', async () => {
  // Un `scans.jsonl` lié vers `~/.claude/history.jsonl` rendait l'historique
  // des prompts dans `/api/project` et au MCP.
  const { readBoard } = await import('../hooks/board.js')
  const { readOvrsee } = await import('../hooks/brief.js')
  const { dir, dehors } = projet()
  writeFileSync(join(dehors, 'h.jsonl'), '{"secret":"SECRET-JSONL"}\n')
  writeFileSync(join(dehors, 'b.json'), '{"colonnes":[{"id":"SECRETCOL","titre":"x"}]}')
  writeFileSync(join(dehors, 'p.json'), '{"pages":[{"path":"/SECRET-PAGE"}]}')
  symlinkSync(join(dehors, 'h.jsonl'), join(dir, 'ovrsee', 'pages', 'scans.jsonl'))
  symlinkSync(join(dehors, 'h.jsonl'), join(dir, 'ovrsee', 'audits.jsonl'))
  symlinkSync(join(dehors, 'b.json'), join(dir, 'ovrsee', 'board.json'))
  symlinkSync(join(dehors, 'p.json'), join(dir, 'ovrsee', 'pages', 'pages.json'))

  assert.doesNotMatch(JSON.stringify(snapshot(dir)), /SECRET/)
  assert.doesNotMatch(JSON.stringify(readBoard(join(dir, 'ovrsee'))), /SECRET/)
  assert.doesNotMatch(JSON.stringify(readOvrsee(dir)), /SECRET/)
})

test('/api/shot compare à la racine du dépôt, pas à un ovrsee/pages lié ailleurs', () => {
  const { dehors } = projet()
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-secu-'))
  mkdirSync(join(dir, 'ovrsee'))
  mkdirSync(join(dehors, 'Pictures'))
  writeFileSync(join(dehors, 'Pictures', 'prive.png'), 'png')
  symlinkSync(join(dehors, 'Pictures'), join(dir, 'ovrsee', 'pages'))
  registerProject(dir)
  assert.equal(resolve(q('/api/shot', dir, 'prive.png'), dir).status, 404)
})
