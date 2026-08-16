---
{
  "status": "closed",
  "title": "Audit SEO de la vitrine `site/` — constats et correctifs",
  "opened": "2026-08-16",
  "closed": "2026-08-16",
  "commits": [
    {
      "sha": "378ccae",
      "date": "2026-08-16",
      "files": [
        ".github/workflows/site.yml",
        ".gitignore",
        "CHANGELOG.fr.md",
        "CHANGELOG.md",
        "CLAUDE.md",
        "CODE_OF_CONDUCT.fr.md",
        "CODE_OF_CONDUCT.md",
        "CONTRIBUTING.fr.md",
        "CONTRIBUTING.md",
        "README.en.md",
        "README.fr.md",
        "README.md",
        "SECURITY.fr.md",
        "SECURITY.md",
        "hooks/documentation.test.js",
        "hooks/i18n.js",
        "scripts/build-site-en.js",
        "scripts/build-site-en.test.js",
        "scripts/build-site-fr.js",
        "scripts/build-site-fr.test.js",
        "site/app.js",
        "site/dict.json",
        "site/index.html",
        "site/sitemap.xml"
      ]
    }
  ]
}
---

# Audit SEO de la vitrine `site/` — constats et correctifs

## Contexte

La vitrine d'Ovrsee (`site/`) est une page unique en HTML statique écrite à la main,
déployée telle quelle sur GitHub Pages par `.github/workflows/site.yml`, servie sur
`https://ovrsee.app/`. Elle est le seul point d'entrée public du projet depuis que le
dépôt est passé public.

L'audit a été mené en lecture seule : inspection du source (`site/index.html`,
`app.js`, `styles.css`, `dict.json`), du workflow de déploiement, et des réponses HTTP
réelles du site en production.

Résultat : **l'infrastructure est saine, le contenu est sous-exploité.** Rien n'est
cassé côté serveur ; ce qui manque, ce sont les signaux que les moteurs et les moteurs
de réponse (Google, Bing, ChatGPT, Perplexity) attendent d'une page produit — et une
version anglaise adressable, alors que la traduction existe déjà et n'est visible de
personne.

---

## Ce qui est déjà correct (vérifié en production)

| Point | Constat |
|---|---|
| HTTPS | `http://` → `https://` en 301 |
| Domaine canonique | `www.ovrsee.app` → `ovrsee.app` en 301 ; `samuelboulery.github.io/ovrsee/` → `ovrsee.app` en 301. Aucun contenu dupliqué. |
| `<link rel="canonical">` | Présent et exact (`https://ovrsee.app/`) |
| Compression | gzip actif — 136 Ko → 25,5 Ko sur le fil |
| `<title>` | 34 caractères, sous la limite de troncature |
| `<meta name="description">` | 139 caractères, sous la limite |
| Open Graph / Twitter Card | Complets, URL absolues, `og:image` 1200×630 avec `og:image:alt` |
| Polices | Auto-hébergées, `font-display: swap`, licence OFL présente |
| Contenu | 1 380 mots visibles **dans le HTML source** — pas de rendu client obligatoire |
| Dégradation sans JS | `révéler()` pose l'opacité en JS : sans JS, tout reste visible. Correct. |
| Volume de liens | Ancres internes `#top`, `#demo`, `#comment`, `#donnees` — toutes résolvent |

Non actionnable, imposé par GitHub Pages : pas de Brotli, `cache-control: max-age=600`
uniforme (y compris sur les polices).

---

## Constats, par sévérité

### CRITIQUE

**1. La version anglaise est invisible pour les moteurs.**
`site/dict.json` contient 183 traductions FR→EN, appliquées par `traduire()`
(`site/app.js:226`) qui parcourt les nœuds de texte du DOM après rendu. Conséquences :
aucune URL propre, aucun `hreflang`, aucun état persisté, rien à indexer. Google ne
verra jamais la page anglaise — et Claude Code a une audience majoritairement
anglophone. C'est le plus gros gisement de trafic du site, et le travail de traduction
est déjà payé.

### HAUTE

**2. `robots.txt` absent** — `https://ovrsee.app/robots.txt` renvoie 404. Pas
bloquant en soi (l'absence vaut autorisation), mais c'est le seul endroit où déclarer
le sitemap et arbitrer les crawlers d'IA.

**3. `sitemap.xml` absent** — 404. Faible enjeu à une page, réel dès qu'il y en a deux.

**4. Aucune donnée structurée JSON-LD.** Pas de `SoftwareApplication`, pas de
`WebSite`. C'est ce qui alimente les résultats enrichis et, surtout, ce que les moteurs
de réponse lisent en priorité pour décrire un produit. Le site coche toutes les cases
du type (nom, catégorie, OS, prix, dépôt, licence) et n'en déclare aucune.

**5. Zéro repère sémantique.** Le document compte 414 `<div>`, 255 `<span>`, et
**aucun** `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<ul>`, `<li>`,
`<button>`. Héritage de l'export Claude Design. Coût : structure illisible pour les
robots comme pour les lecteurs d'écran, et navigation au clavier dégradée.

### MOYENNE

**6. Faux titre de section.** `site/index.html:203` — `<h2>ovrsee</h2>` est le nom de
dépôt affiché *dans la maquette de l'application*. Google le lit comme un titre de
section de la page. Doit être un `<span>`.

**7. Le mot-clé cible est absent du `<title>` et du `<h1>`.** Titre actuel :
« Ovrsee, piloter un projet vibecodé ». Le terme que les gens tapent — « Claude Code » —
n'apparaît que dans la surtitre et la description. Correctif à moindre coût : le
`<title>`, pas le `<h1>` (dont la promesse de marque est bonne).

**8. Pas de `preload` sur la police du LCP.** Le plus grand élément peint est le `<h1>`
en IBM Plex Sans ; le `.woff2` n'est découvert qu'après le parse de `styles.css`.

**9. Sept `{{ … }}` dans le HTML brut** (`{{ v.label }}`, `{{ viewTitle }}`,
`{{ statusLeft }}`…). Google exécute le JS et les résout ; les crawlers qui ne
l'exécutent pas (dont plusieurs crawlers d'IA) lisent les accolades telles quelles.

**10. Script mort.** `site/index.html:924` — `<script type="text/x-dc" data-dc-script
data-props="…">`, résidu de l'export Claude Design. Jamais exécuté, ~1 Ko à supprimer.

### BASSE

**11.** Sept `target="_blank"` sans `rel="noopener noreferrer"` (les navigateurs
modernes l'impliquent — hygiène, pas classement).
**12.** `twitter:site` / `twitter:creator` absents : aucune attribution au partage.
**13.** `og:image:type` absent.
**14.** Pas de page 404 personnalisée (`site/404.html`).

---

## Correctifs

### A. Page anglaise adressable — `/en/`

Décision retenue : **génération au déploiement**, source unique = `index.html` + `dict.json`.
Une page EN commitée dériverait silencieusement.

- **`scripts/build-site-en.js`** (nouveau, ~60 lignes, zéro dépendance) : lit
  `site/index.html` et `site/dict.json`, remplace chaque texte entre `>` et `<` dont la
  version trimmée est une clé du dictionnaire — même règle que `traduire()`
  (`site/app.js:226`), pour que les deux chemins ne puissent pas diverger. Réécrit
  ensuite le `<head>` : `lang="en"`, `<title>`, `description`, `og:*`, `twitter:*`,
  `canonical` → `/en/`, `og:locale` → `en_US`. Écrit `site/en/index.html`.
- **`scripts/build-site-en.test.js`** (nouveau) : vérifie que la sortie contient
  `lang="en"`, le canonical `/en/`, le `<h1>` traduit, et **aucune** clé française du
  dictionnaire restée dans le corps. Style `node:test` / `node:assert` du projet, sans
  framework.
- **`package.json`** : ajouter `scripts/*.test.js` au glob de `test`.
- **`.github/workflows/site.yml`** : une étape `node scripts/build-site-en.js` entre le
  checkout et `upload-pages-artifact`, et ajouter `scripts/build-site-en.js` au filtre
  `paths`. Ajouter `site/en/` au `.gitignore`.
- **`site/app.js`** : l'état initial est figé sur `lang: 'fr'` (`site/app.js:18`). Sur
  `/en/`, `traduire()` appliquerait alors la table inverse et **retraduirait la page en
  français**. Corriger en dérivant la langue de `document.documentElement.lang`.
  `traduire()` reste nécessaire : les libellés de vues injectés viennent de `VUES` /
  `MÉTA` (`site/app.js:23`, `:45`), en français dans le code.
- **`site/index.html`** : la bascule FR/EN devient deux vrais liens (`/` et `/en/`) au
  lieu des `onClick="{{ pickFr }}"`. Retirer `pickFr` / `pickEn` de `valeurs()`.
- **`hreflang`** sur les deux pages : `fr`, `en`, `x-default` → FR.
- **Chemins d'assets** : passer `styles.css`, `app.js`, `favicon.*`,
  `apple-touch-icon.png` en absolus depuis la racine (`/styles.css`…) dans
  `index.html`, pour que la page EN les résolve sans réécriture. `styles.css` reste à
  la racine, ses `@font-face` relatives ne bougent pas.

### B. Découvrabilité

- **`site/robots.txt`** (nouveau) : `User-agent: * / Allow: /` + `Sitemap:
  https://ovrsee.app/sitemap.xml`.
- **`site/sitemap.xml`** (nouveau) : deux URL, `/` et `/en/`, avec `xhtml:link`
  alternates.

### C. `<head>` de `site/index.html`

- Un bloc `<script type="application/ld+json">` avec un `@graph` :
  `SoftwareApplication` (nom, description, `applicationCategory:
  DeveloperApplication`, `operatingSystem: macOS, Windows`, `offers` à 0,
  `downloadUrl` vers les Releases, `license` — **reprendre la licence réelle de
  `LICENSE`, ne rien affirmer d'autre**) + `WebSite`.
- `<link rel="preload" href="/fonts/IBMPlexSans.woff2" as="font" type="font/woff2" crossorigin>`.
- `<title>` → « Ovrsee — gestion de projet pour Claude Code » (43 car.). Le `<h1>` ne
  change pas.
- `og:image:type`, `twitter:site` / `twitter:creator` (à fournir, sinon omis).

### D. Structure de `site/index.html`

Changer les balises ouvrantes/fermantes des `<div>` existants, en gardant les styles
inline — diff minimal, rendu identique :

- barre collante → `<header>` contenant un `<nav>` pour les liens de section ;
- du hero à l'avant-dernier bloc → `<main>` ;
- chaque bloc porteur d'un `<h2>` → `<section aria-labelledby="…">` ;
- dernier bloc (« Le code est sur GitHub ») → `<footer>` ;
- `site/index.html:203` : `<h2>ovrsee</h2>` → `<span>` ;
- supprimer le `<script type="text/x-dc">` (`site/index.html:924`) ;
- `rel="noopener noreferrer"` sur les sept `target="_blank"`.

### E. Traçabilité

Créer un ticket via le skill `ovrsee-tickets` avant de toucher au code — le gate
hors-plan l'exige, et deux plans sont déjà ouverts sur la barre de menu.
Commits séparés : `chore(site): …` pour le balisage, `feat(site): version anglaise
indexable` pour `/en/`.

---

## Vérification

**Local**

```bash
node scripts/build-site-en.js       # génère site/en/index.html
pnpm test                           # inclut scripts/build-site-en.test.js
pnpm lint                           # oxlint couvre site/
cd site && python3 -m http.server 8080
```

Les chemins d'assets devenant absolus, il faut servir depuis la racine de `site/` —
ouvrir le fichier en `file://` ne suffit plus. Vérifier à `http://localhost:8080/` :
rendu FR inchangé, bascule EN qui **navigue** vers `/en/`, page EN entièrement en
anglais, `document.documentElement.lang === 'en'`, démo interactive fonctionnelle des
deux côtés.

**Après déploiement** (`site.yml` se déclenche sur push `main` touchant `site/**`)

```bash
curl -sI https://ovrsee.app/robots.txt   # 200
curl -sI https://ovrsee.app/sitemap.xml  # 200
curl -sI https://ovrsee.app/en/          # 200
curl -s  https://ovrsee.app/en/ | grep -E 'lang=|canonical|hreflang'
```

**Outils externes**

- Rich Results Test / Schema Markup Validator sur `https://ovrsee.app/` — le
  `SoftwareApplication` doit passer sans erreur.
- PageSpeed Insights avant/après le `preload` : le LCP est le `<h1>`, l'écart doit être
  visible.
- Google Search Console : ajouter la propriété `ovrsee.app`, soumettre le sitemap,
  vérifier que `/en/` est reconnue comme alternative et non comme doublon.

---

## Hors périmètre

Le contenu éditorial (`<h1>`, argumentaire, ajout de pages type changelog ou
documentation) n'est pas touché — sauf le `<title>`. Le nombre de mots (1 380) suffit
pour une page produit ; ce qui manque, ce sont les signaux, pas la prose.
