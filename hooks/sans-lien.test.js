import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendFileNoFollow, assurerSansLien } from './sans-lien.js'

/**
 * Un dépôt observé peut versionner des liens symboliques n'importe où sous
 * `ovrsee/` — le lien est en place dès le `git clone`. Une écriture qui le suit
 * sort du dépôt : `ovrsee/pages/scans.jsonl -> ../../.git/hooks/post-commit`
 * faisait ajouter du texte du dépôt à un script exécuté au commit suivant.
 */
const depot = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-sans-lien-'))
  mkdirSync(join(root, '.git'))
  mkdirSync(join(root, 'ovrsee', 'pages'), { recursive: true })
  return root
}

test('appendFileNoFollow ajoute à un fichier ordinaire, et le crée au besoin', () => {
  const root = depot()
  const f = join(root, 'ovrsee', 'pages', 'scans.jsonl')
  appendFileNoFollow(f, 'a\n')
  appendFileNoFollow(f, 'b\n')
  assert.equal(readFileSync(f, 'utf8'), 'a\nb\n')
})

test('appendFileNoFollow refuse un fichier cible qui est un lien, et n’écrit rien dans sa cible', () => {
  const root = depot()
  const victime = join(root, 'post-commit')
  writeFileSync(victime, '#!/bin/sh\n')
  symlinkSync(victime, join(root, 'ovrsee', 'pages', 'scans.jsonl'))

  assert.throws(() => appendFileNoFollow(join(root, 'ovrsee', 'pages', 'scans.jsonl'), '$(id)\n'), /lien symbolique/)
  assert.equal(readFileSync(victime, 'utf8'), '#!/bin/sh\n')
})

test('assurerSansLien refuse un lien sur un dossier ancêtre jusqu’à ovrsee/ compris', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-sans-lien-'))
  const ailleurs = join(root, 'ailleurs')
  mkdirSync(join(ailleurs, 'pages'), { recursive: true })
  mkdirSync(join(root, 'depot', '.git'), { recursive: true })
  symlinkSync(ailleurs, join(root, 'depot', 'ovrsee'))

  assert.throws(() => assurerSansLien(join(root, 'depot', 'ovrsee', 'pages', 'scans.jsonl')), /lien symbolique/)
  assert.throws(
    () => appendFileNoFollow(join(root, 'depot', 'ovrsee', 'pages', 'scans.jsonl'), 'x\n'),
    /lien symbolique/,
  )
})

test('assurerSansLien laisse passer un chemin ordinaire, existant ou non', () => {
  const root = depot()
  assurerSansLien(join(root, 'ovrsee', 'pages', 'scans.jsonl'))
  assurerSansLien(join(root, 'ovrsee', 'tickets', 'images', 'x.png'))
})

test('assurerSansLien ne remonte pas au-dessus de ovrsee/ : le chemin du dépôt peut passer par un lien', () => {
  // `/tmp` est lui-même un lien sous macOS, et un dépôt peut vivre sous un
  // dossier lié : seul ce que le dépôt versionne est en cause.
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-sans-lien-'))
  mkdirSync(join(root, 'vrai', 'ovrsee', 'pages'), { recursive: true })
  symlinkSync(join(root, 'vrai'), join(root, 'lie'))

  assurerSansLien(join(root, 'lie', 'ovrsee', 'pages', 'scans.jsonl'))
})

test('assurerSansLien ne s’arrête pas à un sous-dossier nommé ovrsee (route /ovrsee)', () => {
  // `pageSlug('/ovrsee')` vaut `ovrsee` : la capture vit sous `shots/ovrsee/`.
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-sans-lien-'))
  mkdirSync(join(root, '.git'))
  const ailleurs = join(root, 'ailleurs')
  mkdirSync(join(ailleurs, 'shots', 'ovrsee'), { recursive: true })
  mkdirSync(join(root, 'ovrsee'))
  symlinkSync(ailleurs, join(root, 'ovrsee', 'pages'))

  assert.throws(
    () => assurerSansLien(join(root, 'ovrsee', 'pages', 'shots', 'ovrsee', '2026-10-05-abc.png')),
    /lien symbolique/,
  )
})

test('assurerSansLien ne remonte pas hors d’un dépôt : ~/.claude lié par des dotfiles reste permis', () => {
  // Un `ovrsee/` sans `.git` à côté n'est pas celui d'un dépôt observé — c'est
  // `~/.claude/ovrsee`. Seul le dossier immédiat compte, comme avant.
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-sans-lien-'))
  mkdirSync(join(root, 'dotfiles', '.claude', 'ovrsee'), { recursive: true })
  symlinkSync(join(root, 'dotfiles', '.claude'), join(root, '.claude'))

  assurerSansLien(join(root, '.claude', 'ovrsee', 'trust.json'))
})
