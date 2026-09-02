#!/usr/bin/env node
/**
 * Régénère les sept captures du README (`docs/screenshots/<onglet>.webp`).
 *
 * Elles étaient prises à la main, et le montraient : celles de la 1.1 ont vécu
 * trois semaines de plus que l'app, jusqu'à afficher dans le README des défauts
 * déjà corrigés. Un script ne garantit pas qu'on y pense, mais il rend le geste
 * assez court pour qu'on le fasse à chaque release.
 *
 * L'app est lancée **pour de vrai** (`_electron.launch`), pas servie dans un
 * navigateur : hors d'Electron, `Navigateur.tsx` rend `<HorsApplication />` et
 * le terminal intégré n'existe pas. Ce sont justement deux des sept captures.
 *
 * Chaque PNG brut passe ensuite par screenmat, qui pose le cadre arrondi et le
 * fond. Son `--seed` est fixe : sans lui, le fond changerait à chaque passage et
 * les sept images seraient à recommiter pour rien.
 *
 * Prérequis :
 *   pnpm build:ui              — l'app chargée est celle d'`app/dist/`
 *   pnpm dev                   — l'onglet Navigateur pointe sur localhost:5180
 *   le projet ovrsee ouvert en dernier (registre `~/.claude/ovrsee/projects.json`)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron } from 'playwright-core'

import { estPrincipal } from '../hooks/principal.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(RACINE, 'docs', 'screenshots')

/** Les sept onglets, par la route de leur lien dans le rail (`app/src/views.ts`). */
export const ONGLETS = [
  ['apercu', '/'],
  ['navigateur', '/navigateur'],
  ['produit', '/produit'],
  ['historique', '/historique'],
  ['tableau', '/tableau'],
  ['donnees', '/donnees'],
  ['stack', '/stack'],
]

/** La fenêtre du README. Le facteur de l'écran double ces pixels à la capture. */
const LARGEUR = 1440
const HAUTEUR = 940

const SCREENMAT = process.env.SCREENMAT ?? '/Users/sam/code/screenmat/cli/main.ts'
const CADRE = [
  '--frame', 'browser', '--no-title-bar',
  '--ratio', 'auto', '--padding', '0.05',
  '--seed', '7', '--scale', '2', '--format', 'webp',
]

/** Le temps que l'onglet finisse de peindre : graphe, vignettes, terminal. */
const attendre = ms => new Promise(resolve => setTimeout(resolve, ms))

async function capturer() {
  if (!existsSync(join(RACINE, 'app', 'dist', 'index.html'))) {
    throw new Error('app/dist absent — lancer `pnpm build:ui` avant')
  }

  const brut = mkdtempSync(join(tmpdir(), 'ovrsee-shots-'))
  // `--force-device-scale-factor=2` : la fenêtre reste à 1440×940 points et se
  // photographie en 2880×1880 pixels. Sans lui, les captures sont à 1× et le
  // texte du README est illisible dès qu'on les regarde en grand.
  const app = await electron.launch({ args: ['.', '--force-device-scale-factor=2'], cwd: RACINE })
  const page = await app.firstWindow()

  // Le thème du README est le sombre. Le réglage du poste n'est pas touché :
  // `emulateMedia` ment à la requête média du rendu, que `watchSystemTheme`
  // écoute déjà — là où un `nativeTheme.themeSource` forcé se ferait écraser
  // par le premier `app:theme` que le rendu renvoie (« système »).
  await page.emulateMedia({ colorScheme: 'dark' })

  await app.evaluate(({ BrowserWindow }, taille) => {
    const fenetre = BrowserWindow.getAllWindows()[0]
    fenetre.setContentSize(taille.largeur, taille.hauteur)
  }, { largeur: LARGEUR, hauteur: HAUTEUR })

  // L'onglet Navigateur rouvre la dernière adresse visitée
  // (`navigateur.url:<projet>`, `navigateur-webview.ts:69`). Sur un poste qui a
  // servi, c'est un site quelconque : l'oublier fait retomber `startUrl` sur le
  // `baseUrl` du projet, qui est ce que la capture doit montrer.
  await page.evaluate(() => {
    for (const cle of Object.keys(localStorage)) {
      if (cle.startsWith('navigateur.url:')) localStorage.removeItem(cle)
    }
  })
  await page.reload()

  // Le premier montage charge l'instantané du projet, et le terminal ouvre un
  // pty. Sans cette attente, Aperçu se photographie vide.
  await page.waitForSelector('a[href="/produit"]')
  await attendre(6000)

  // `emulateMedia` ne vaut que pour ce rendu-là : le `<webview>` de l'onglet
  // Navigateur est un rendu à part, qui suivrait le poste et s'afficherait en
  // clair au milieu d'une capture sombre. Posé après le montage, sinon le
  // premier `app:theme` du rendu (« système ») l'écrase.
  await app.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = 'dark'
  })

  const faites = []
  for (const [id, route] of ONGLETS) {
    await page.click(`a[href="${route}"]`)
    await attendre(3000)
    const fichier = join(brut, `${id}.png`)
    await page.screenshot({ path: fichier })
    faites.push([id, fichier])
    console.error(`capturé : ${id}`)
  }

  await app.close()
  return faites
}

function habiller(faites) {
  if (!existsSync(SCREENMAT)) {
    console.error(`screenmat introuvable (${SCREENMAT}) — captures brutes laissées dans ${dirname(faites[0][1])}`)
    return
  }
  for (const [id, fichier] of faites) {
    execFileSync('node', [SCREENMAT, fichier, ...CADRE, '--out', join(SORTIE, `${id}.webp`)], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    console.error(`habillé : docs/screenshots/${id}.webp`)
  }
}

if (estPrincipal(import.meta.url)) habiller(await capturer())
