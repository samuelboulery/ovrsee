import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { construire, estampiller, sources, traduire } from './build-site-fr.js'

const { html, dict, version } = sources()
const fr = construire(estampiller(html, version), dict)

test('la page générée se déclare française et canonique sous /fr/', () => {
  assert.match(fr, /<html lang="fr">/)
  assert.match(fr, /<link rel="canonical" href="https:\/\/ovrsee\.app\/fr\/">/)
  assert.match(fr, /<meta property="og:url" content="https:\/\/ovrsee\.app\/fr\/">/)
  assert.match(fr, /<meta property="og:locale" content="fr_FR">/)
})

test('les deux versions se citent mutuellement', () => {
  for (const page of [html, fr]) {
    assert.match(page, /<link rel="alternate" hreflang="en" href="https:\/\/ovrsee\.app\/">/)
    assert.match(page, /<link rel="alternate" hreflang="fr" href="https:\/\/ovrsee\.app\/fr\/">/)
    assert.match(page, /<link rel="alternate" hreflang="x-default" href="https:\/\/ovrsee\.app\/">/)
  }
})

test('le titre principal est traduit', () => {
  assert.match(fr, /<h1[^>]*>Vibecoder vite,/)
  assert.ok(!fr.includes('Vibecode fast,'), 'le titre anglais subsiste')
})

// Le vrai critère : plus rien de traduisible. Si `traduire()` a encore quelque chose à
// faire sur sa propre sortie, c'est qu'une chaîne anglaise est passée à travers.
test('aucune chaîne du dictionnaire ne reste à traduire', () => {
  assert.equal(traduire(fr, dict), fr)
})

test('la source anglaise n’est pas modifiée', () => {
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<link rel="canonical" href="https:\/\/ovrsee\.app\/">/)
})

// Les chemins d'assets doivent être absolus, sinon `/fr/` les cherche sous `/fr/`.
test('les assets sont référencés depuis la racine', () => {
  for (const chemin of ['/styles.css', '/app.js', '/favicon.svg', '/fonts/IBMPlexSans.woff2']) {
    assert.ok(fr.includes(`"${chemin}"`), `chemin relatif restant : ${chemin}`)
  }
})

test('la bascule de langue est faite de liens, pas de gestionnaires', () => {
  assert.match(fr, /<a href="\/" hreflang="en"/)
  assert.match(fr, /<a href="\/fr\/" hreflang="fr"/)
  assert.ok(!fr.includes('pickFr'), 'la bascule JS subsiste')
})

// Le piège : `traduire()` (`site/app.js`) applique la table inverse quand la langue
// n'est pas le français. Figée sur une valeur en dur, la page française repasserait
// en anglais au premier rendu.
test('la langue de rendu est dérivée du document', () => {
  const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8')
  assert.match(app, /lang: document\.documentElement\.lang === 'fr' \? 'fr' : 'en'/)
})

// La version en dur avait dérivé de trois releases avant qu'on la voie : les deux
// endroits qui l'affichent sont estampillés depuis `package.json`, pas à la main.
test('les deux emplacements portent la version du paquet', () => {
  const balises = html.match(/data-version>[^<]*</g) ?? []
  assert.equal(balises.length, 2, 'un emplacement de version a perdu son data-version')
  for (const page of [estampiller(html, version), fr]) {
    for (const trouvé of page.match(/data-version>([^<]*)</g) ?? []) {
      assert.equal(trouvé, `data-version>v${version}<`)
    }
  }
})

// La régression du jour : une vue listée dans la colonne de gauche mais sans
// maquette derrière — le clic ne faisait rien, en silence.
test('les sept vues de la démo ont chacune leur maquette', () => {
  for (const vue of ['Apercu', 'Navigateur', 'Produit', 'Historique', 'Tableau', 'Donnees', 'Stack']) {
    assert.ok(html.includes(`data-if="is${vue}"`), `pas de maquette pour la vue ${vue}`)
  }
})

// Le patron d'une répétition porte son `display` dans son `style` : le clone doit le
// garder. L'effacer faisait retomber en `block` les colonnes du graphique d'activité,
// dont les barres s'empilaient alors depuis le haut sans que rien n'échoue.
test('le moteur de gabarit n’efface pas le display des clones', () => {
  const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8')
  assert.ok(!/clone\.style\.display\s*=/.test(app), 'le clone se voit réassigner un display')
})
