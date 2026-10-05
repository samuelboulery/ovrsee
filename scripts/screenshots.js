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
 * Chaque PNG brut passe ensuite par screenmat
 * (https://github.com/samuelboulery/screenmat), qui pose le cadre arrondi et le
 * fond. Son `--seed` est fixe : sans lui, le fond changerait à chaque passage et
 * les sept images seraient à recommiter pour rien. `SCREENMAT` désigne le clone
 * de screenmat, comme dans img-creator — pas de chemin de poste en dur :
 *
 *   SCREENMAT=../screenmat pnpm screenshots
 *
 * Sans elle, seules les captures brutes sont écrites (dossier temporaire).
 *
 * Prérequis :
 *   pnpm build:ui              — l'app chargée est celle d'`app/dist/`
 *   le port 5180 libre         — le script lance lui-même `pnpm dev`, que
 *                                l'onglet Navigateur affiche
 *   un dernier crawl réussi    — sinon Produit n'a que des vignettes « scan
 *                                échoué ». Le lancer sous le même registre
 *                                jetable, sans quoi les résumés de pages citent
 *                                le projet que le dev server ouvre en premier.
 *
 * Le projet photographié est ce dépôt, dans son état versionné, et lui seul :
 * app et dev server lisent un registre jetable (`OVRSEE_REGISTRY`) qui ne
 * contient que lui. Le registre du poste ouvrait le dernier projet ouvert —
 * privé le cas échéant — et un crawl non commité pouvait citer d'autres dépôts.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir, userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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

const CADRE = [
  '--frame', 'browser', '--no-title-bar',
  '--ratio', 'auto', '--padding', '0.05',
  '--seed', '7', '--scale', '2', '--format', 'webp',
]

/**
 * Ce que les captures ne montrent pas : le dossier personnel (chemin d'Aperçu,
 * bannière de `claude`), le nom du compte (pied de la barre latérale) et son
 * forfait Claude (bannière). Des sources de RegExp — elles traversent la
 * frontière vers le rendu, où une fonction ne passe pas.
 */
const echapper = texte => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const neutre = ({ home, user }) => [
  [echapper(home), '~'],
  [`\\b${echapper(user)}\\b(?!\\.)`, 'demo'],
  ['\\bClaude (Max|Pro|Team|Enterprise)\\b', 'Claude'],
]

/**
 * Réécrit le texte du rendu tant qu'il vit, et pas une fois : xterm repeint ses
 * lignes à chaque octet, et un remplacement unique serait défait avant la
 * capture. Le rendu xterm est le DOM (aucun addon webgl), donc atteignable.
 * Le nom est aussi menti à `/api/username`, sans quoi l'avatar garde l'initiale.
 */
function neutraliser(regles) {
  if (window.__neutre) return
  window.__neutre = true
  const res = regles.map(([source, par]) => [new RegExp(source, 'gi'), par])
  const propre = texte => res.reduce((t, [re, par]) => t.replace(re, par), texte)
  const nettoyer = racine => {
    const marche = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    for (let n = racine; n; n = marche.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (propre(n.data) !== n.data) n.data = propre(n.data)
        continue
      }
      for (const nom of ['title', 'placeholder', 'aria-label', 'value']) {
        const v = n.getAttribute?.(nom)
        if (v != null && propre(v) !== v) n.setAttribute(nom, propre(v))
      }
      if (n instanceof HTMLInputElement && propre(n.value) !== n.value) n.value = propre(n.value)
    }
  }
  const fetchOrigine = window.fetch
  window.fetch = (url, ...reste) =>
    String(url).endsWith('/api/username') ? Promise.resolve(Response.json({ username: 'demo' })) : fetchOrigine(url, ...reste)
  nettoyer(document)
  new MutationObserver(mutations => mutations.forEach(m => nettoyer(m.target))).observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
  })
}

/** Le temps que l'onglet finisse de peindre : graphe, vignettes, terminal. */
const attendre = ms => new Promise(resolve => setTimeout(resolve, ms))

async function capturer() {
  if (!existsSync(join(RACINE, 'app', 'dist', 'index.html'))) {
    throw new Error('app/dist absent — lancer `pnpm build:ui` avant')
  }
  if (await fetch('http://localhost:5180').then(() => true, () => false)) {
    throw new Error('le port 5180 répond déjà — arrêter le `pnpm dev` en cours')
  }

  const brut = mkdtempSync(join(tmpdir(), 'ovrsee-shots-'))
  const registre = join(brut, 'projects.json')
  writeFileSync(registre, JSON.stringify([{ path: RACINE, name: 'ovrsee' }]))
  const env = { ...process.env, OVRSEE_REGISTRY: registre }

  // `detached` puis `-pid` : tuer `pnpm` seul laisserait vite tenir le port.
  const dev = spawn('pnpm', ['dev'], { cwd: RACINE, env, stdio: 'ignore', detached: true })
  try {
    return await photographier(brut, env)
  } finally {
    process.kill(-dev.pid)
  }
}

async function photographier(brut, env) {
  // `--force-device-scale-factor=2` : la fenêtre reste à 1440×940 points et se
  // photographie en 2880×1880 pixels. Sans lui, les captures sont à 1× et le
  // texte du README est illisible dès qu'on les regarde en grand.
  const app = await electron.launch({ args: ['.', '--force-device-scale-factor=2'], cwd: RACINE, env })
  const page = await app.firstWindow()
  const regles = neutre({ home: homedir(), user: userInfo().username })
  // Avant le `reload` plus bas : le script ne vaut qu'aux documents suivants.
  await page.addInitScript(neutraliser, regles)

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
    // Le `<webview>` du Navigateur est un rendu à part, chargé après le clic :
    // l'init script ne l'atteint pas. Son avatar, chargé avant, sort du cadre.
    await app.evaluate(({ webContents }, source) => Promise.all(
      webContents.getAllWebContents().filter(w => w.getType() === 'webview').map(w => w.executeJavaScript(source)),
    ), `(${neutraliser})(${JSON.stringify(regles)})`)
    await attendre(300)
    const fichier = join(brut, `${id}.png`)
    await page.screenshot({ path: fichier })
    faites.push([id, fichier])
    console.error(`capturé : ${id}`)
  }

  await app.close()
  return faites
}

function habiller(faites) {
  const screenmat = process.env.SCREENMAT && resolve(process.env.SCREENMAT)
  if (!screenmat || !existsSync(join(screenmat, 'cli', 'main.ts'))) {
    console.error(`SCREENMAT ne désigne pas un clone de screenmat — captures brutes laissées dans ${dirname(faites[0][1])}`)
    return
  }
  for (const [id, fichier] of faites) {
    execFileSync('pnpm', ['-s', 'cli', fichier, ...CADRE, '--out', join(SORTIE, `${id}.webp`)], {
      cwd: screenmat,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    console.error(`habillé : docs/screenshots/${id}.webp`)
  }
}

if (estPrincipal(import.meta.url)) habiller(await capturer())
