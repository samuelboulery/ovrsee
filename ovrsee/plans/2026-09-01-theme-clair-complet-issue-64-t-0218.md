---
{
  "status": "open",
  "title": "Thème clair complet — issue #64 / T-0218",
  "opened": "2026-09-01",
  "closed": null,
  "commits": [
    {
      "sha": "f44fd77",
      "date": "2026-09-01",
      "files": [
        "_ds/ovrsee/styles.css",
        "app/src/ActivityPanel.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/Lightbox.tsx",
        "app/src/OnboardingArt.tsx",
        "app/src/PreferencesProfils.tsx",
        "app/src/Shell.tsx",
        "app/src/Welcome.tsx",
        "app/src/markdown.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/ProduitDetail.tsx",
        "app/src/tabs/Tableau.tsx",
        "app/src/tabs/TableauCarte.tsx",
        "app/src/tabs/TableauDetail.tsx",
        "app/src/tabs/TableauEpics.tsx",
        "hooks/contraste.js",
        "hooks/couleurs.test.js",
        "hooks/theme-clair.test.js"
      ]
    },
    {
      "sha": "087ed98",
      "date": "2026-09-01",
      "files": [
        "app/index.html",
        "app/src/App.tsx",
        "app/src/MenuBarPanel.tsx",
        "app/src/Onboarding.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/theme.test.ts",
        "app/src/theme.ts",
        "hooks/i18n.js",
        "hooks/settings.js",
        "hooks/settings.test.js"
      ]
    },
    {
      "sha": "ca65a3a",
      "date": "2026-09-01",
      "files": [
        "app/src/Terminal.tsx",
        "app/src/pty.ts",
        "app/src/useTerminal.ts"
      ]
    },
    {
      "sha": "6a7ec8f",
      "date": "2026-09-01",
      "files": [
        "electron/main.js",
        "electron/preload.cjs",
        "electron/tray.js"
      ]
    },
    {
      "sha": "046cfa9",
      "date": "2026-09-01",
      "files": [
        "CLAUDE.md"
      ]
    }
  ]
}
---

# Thème clair complet — issue #64 / T-0218

## Contexte

Issue #64 : l'interface est illisible en plein jour. Demande explicite : un thème
clair, que **le terminal suive**, et que l'ensemble suive le réglage système.

Le thème clair a existé (`24c3123`, août 2026) puis a été retiré en deux temps —
`2905164` a ôté les options Clair/Système, T-0200 a supprimé le champ `theme` des
préférences. La trace de l'arbitrage est en tête de `app/src/theme.ts:1-8` : « il
promettait un réglage sans effet ». Le ticket T-0218 rouvre la décision, en
l'assumant : la gêne est réelle et quotidienne.

Ce qui rend le travail neuf : le design system a été refondu depuis (T-0045,
84 jetons en `:root` **seul**), et les accents par projet (T-0215) sont arrivés —
six blocs `[data-accent='…']` qui redéfinissent la rampe d'accent, et dont le
sélecteur est **nu** (sans `:root`) parce qu'il sert aussi à peindre les pastilles
de choix. Toute structure de thème doit se glisser à côté sans les casser.

Résultat attendu : trois réglages (clair / sombre / système), bascule sans
rechargement, terminal xterm compris, sombre inchangé au pixel près.

## L'état des lieux, en cinq faits

1. `_ds/ovrsee/styles.css:35-161` — un `:root` unique, 84 jetons. Aucun
   `prefers-color-scheme`, aucun `data-theme`, aucun `color-scheme` **dans tout le
   dépôt**. `_ds/nocturne-*` n'a pas de thème clair récupérable (`themes: []`).
2. `app/src` cite `var(--color-*)` **866 fois** : l'immense majorité suivra une
   redéfinition de jetons, y compris les ascenseurs (`app/index.html:13-18`) et
   toute la chrome du terminal (`Terminal.tsx:144-149`, `695`, `808`…).
3. Ce qui ne suivra pas : le canvas xterm (thème JS posé une seule fois,
   `useTerminal.ts:226`), 4 fichiers à hex littéral, 14 `rgba()` de voiles et
   d'ombres, une poignée de règles de composants calibrées « fond sombre »
   (`styles.css:315-318`, `:387`, `:89`, `:158-160`, `:257`).
4. Le chemin est déjà tracé par l'accent de projet :
   `hooks/plans.js:344` → `server/api.js:236` → `App.tsx:265-273` — poser un
   attribut sur `<html>` fait suivre toute la rampe « en une passe de style et
   sans rechargement ». Un thème reproduit ce motif.
5. Deux amorces existent déjà et n'attendent que ça :
   `app/src/tabs/navigateur-webview.ts:87-88` (`appTheme()` lit
   `dataset.theme`, que personne ne pose) et `electron/main.js:587`
   (`nativeTheme.themeSource`, atteint uniquement via `preview:devtools`).

## Trois arbitrages, tranchés

- **La palette se dessine avant de se coder.** Une maquette claire d'abord, sur
  canvas, puis le code (étape 0 ci-dessous).
- **Le défaut est `system`.** C'est la demande de l'issue. Conséquence assumée :
  sur un poste réglé en clair, l'application change d'apparence à la mise à jour.
- **L'accent en clair dérive du palier 800** de la rampe existante, pas de six
  teintes neuves (§1).

## L'approche

### 0. La maquette claire — canvas de design

Trois planches qui recréent l'app **depuis la source**, pas de mémoire : un écran
Aperçu, un écran Tableau, et le panneau terminal ouvert avec une sortie `claude`
colorée — c'est celle qui décide les vingt couleurs ANSI. Valeurs exactes reprises
de `_ds/ovrsee/styles.css` et des composants (rayons, hauteurs de contrôle,
graisses IBM Plex), pour que seule la couleur change entre la maquette et l'app.
Une quatrième planche porte les rampes et les paires de contraste mesurées.

Elle sert à trancher la palette, et ensuite de référence : c'est le pendant clair
de ce que `Ovrsee-A-Nocturne.dc.html` est au sombre. Le code ne commence qu'après
validation.

### 1. La cascade — `_ds/ovrsee/styles.css`

`:root` **reste le thème sombre, inchangé** : c'est ce qui garantit le « pixel
près » et laisse `hooks/accents.test.js` lire ses valeurs comme aujourd'hui. On
ajoute un seul bloc `:root[data-theme='light']` qui redéfinit les jetons de
surface, texte, filet, statut, ombre et voile — jamais un jeton qui n'existerait
que là.

**Le piège à ne pas manquer.** `:root[data-theme='light']` pèse 0,2,0 ;
`[data-accent='ambre']` pèse 0,1,0. Un bloc de thème qui redéfinirait
`--color-accent-*` écraserait donc les six accents de projet — et le sélecteur nu
sert aussi les pastilles de préférences (`PreferencesProjet.tsx:386`), qui
doivent garder leur teinte. Le bloc clair **ne touche à aucun palier de rampe**.

L'accent s'adapte par une indirection, une ligne pour les six teintes :

```css
:root[data-theme='light'] {
  --color-accent: var(--color-accent-800);   /* le 800 du bloc [data-accent] actif */
  --color-accent-wash: var(--color-accent-100);
  --color-accent-line: var(--color-accent-300);
}
```

`var()` se résout dans la cascade de l'élément : `--color-accent-800` vient
toujours du bloc `[data-accent]` en vigueur. Les paliers 800 et 900 sont
aujourd'hui **déclarés et consommés nulle part** (vérifié : zéro `var(--color-accent-800)`
dans `app/src`) — on peut donc les retoucher sans bouger le sombre d'un pixel, ce
qu'il faut faire pour deux d'entre eux : mesuré sur fond blanc, `violet 14,3:1`,
`rose 9,4`, `orange 8,6`, `cyan 5,6`, `ambre 4,7`, **`vert 4,42`** — sous AA de
0,08. Les rôles inverses (`-wash`, `-line`) remplacent les usages directs de
`--color-accent-300/500/700` dans les composants (16 occurrences).

Autres jetons à créer, parce qu'ils sont aujourd'hui des couleurs déguisées :
`--color-on-accent` (le `#0a0a12` de `.btn-primary`, `styles.css:315` et `:387`),
`--color-scrim` (les six `rgba(6,7,14,.88)` et le `.dialog-backdrop` qui détourne
`--color-neutral-900`, `styles.css:489`), `--shadow-menu` / `--shadow-drawer` /
`--shadow-lightbox` (les `rgba(0,0,0,…)` de `Shell.tsx:369`, `Apercu.tsx:427`,
`ProduitDetail.tsx:55`, `Lightbox.tsx:97`), `--ring-selected` (blanc en dur,
`styles.css:89`). Plus `color-scheme: dark` / `light` sur `:root`, absent du dépôt
entier : sans lui, les contrôles natifs, l'autofill et les ascenseurs par défaut
restent clairs en sombre.

Deux règles restent à trancher au cas par cas : `.btn-primary:hover` éclaircit
vers `white` (`styles.css:316`) — geste « fond sombre », à inverser en clair — et
`.lighten { mix-blend-mode: lighten }` (`styles.css:257`), hérité de Nocturne.

### 2. La palette claire — `_ds/ovrsee/styles.css` + `app/src/theme.ts`

Dessinée, pas inversée mécaniquement : c'est l'exigence explicite du ticket, et
c'est ce que la tentative de 2026 avait ratée. Une rampe de surfaces chaudes-neutres
à faible saturation (blanc de carte, gris de panneau, gris de fond applicatif —
l'ordre du sombre s'inverse : en clair le fond applicatif est le plus **sombre**
des trois, les cartes montent vers le blanc), sept niveaux de texte descendant de
`#1a1b22`, quatre filets, et les triplets de statut (`ok/warn/err/plan`) dont les
fonds `-bg` sont aujourd'hui des noirs teintés et deviennent des teintes pâles.

`theme.ts` gagne un `lightTheme` xterm : fond de terminal, avant-plan, curseur,
sélection et **les vingt couleurs ANSI**, choisies pour un fond clair — les
actuelles (`#7fc97f`, `#e0c46f`…) sont calibrées pour du noir et rendent illisible
tout ce que `claude` écrit en couleur.

### 3. Le terminal à chaud — `app/src/useTerminal.ts`

C'est le gros du travail, et c'est le critère qui fait ou défait le ticket.

`getTerminalTheme()` n'est lu qu'à `new XTerm({…})` (`useTerminal.ts:226`). Le
panneau est en `lazy()` et son démontage **ferme les ptys** (`useTerminal.ts:199-213`,
`pty.ts:115-126`) : recréer le terminal pour changer de thème perdrait la session.

La sortie est simple parce que `panes` est déjà une `Map` de tous les xterm
vivants (`useTerminal.ts:245`) et que le pty vit dans le processus principal,
indifférent aux options du rendu :

```ts
// une passe sur les terminaux vivants — le pty n'est pas touché
export function appliquerThemeTerminal(panes: Iterable<{ options: { theme?: unknown } }>, mode: Mode) {
  const theme = getTerminalTheme(mode)
  for (const pane of panes) pane.options.theme = theme
}
```

Appelée depuis un `useEffect` sur le mode résolu ; les terminaux créés ensuite
prennent le mode courant via une ref. xterm 6.0 réaffiche sur affectation de
`options.theme`. Sortie en fonction pure exportée pour qu'un test l'atteigne sans
xterm (voir Vérification).

### 4. Le réglage — `hooks/settings.js` → `PreferencesPanel.tsx`

Exactement le chemin de `langue`, pas celui de l'accent : le thème est une
préférence de poste globale, pas une propriété d'un projet.

- `hooks/settings.js` : `theme: 'system'` dans `DEFAULT_SETTINGS` — le défaut
  tranché, celui que l'issue demande,
  `validerEnum(out, 'theme', partial.theme, ['light', 'dark', 'system'])` dans
  `validateSettings`, et **surtout pas** dans `mergeSettings` — un dépôt cloné n'a
  pas à décider du thème. Mettre à jour le JSDoc du schéma et les deux
  commentaires « champs personnels » (`:8-10`, `:238`). Le champ a déjà existé :
  `settings.js:155` le mentionne comme retiré.
- `app/src/data.ts:223` : `theme: string` dans `SettingsType`.
- `hooks/i18n.js` : `pref.theme_light`, `pref.theme_system` (fr et en) ;
  `pref.theme` et `pref.theme_dark` existent déjà (`:52-53`, `:841-842`).
- `app/src/PreferencesPanel.tsx:152-162` : la `Row` statique « Sombre » devient un
  `<Segmented>` à trois crans — le composant existe
  (`PreferencesControls.tsx:149`), c'est celui de la langue juste en dessous. Le
  commentaire « Clair et Système retirés » disparaît.

### 5. L'application, sans rechargement ni flash

`applyTheme(pref)` pose **toujours** `document.documentElement.dataset.theme` à la
valeur *résolue* (`'light'` ou `'dark'`), jamais l'attribut retiré : une seule
règle CSS suffit, et `appTheme()` (`navigateur-webview.ts:87`) fonctionne tel
quel. En mode `system`, un `matchMedia('(prefers-color-scheme: light)')` avec
`addEventListener('change', …)` réapplique — c'est ce qui satisfait « suive le
mode système » sans rechargement.

- `App.tsx` : un `useEffect` sur `settings.theme` qui applique et s'abonne (à
  côté de celui de l'accent, `App.tsx:265-273`, même motif).
- `MenuBarPanel.tsx:249` : le popover de la barre de menu est un second rendu de
  la même origine (`main.tsx:31`) qui lit déjà `fetchSettings()` — il doit
  appliquer aussi, sinon il reste sombre dans une app claire.
- Anti-flash : `applyTheme` recopie la préférence dans
  `localStorage['ovrsee.theme']`, et un court script inline en tête d'`index.html`
  la relit avant le premier paint (repli `matchMedia`). `app/index.html:9` passe de
  `background: #08090a` à `var(--color-bg)`, et la page gagne
  `<meta name="color-scheme" content="light dark">`.

### 6. Electron

- `electron/main.js:187` et `electron/tray.js:130` : `backgroundColor: '#0e0f18'`
  en dur — valeur qui ne correspond à rien (ni `--color-bg` `#08090a`, ni le body).
  Elle se lit désormais depuis `readSettings()`, déjà importé dans `main.js`.
- `nativeTheme.themeSource` sort du chemin DevTools : un `app.setTheme(mode)` dans
  le namespace `app` de `preload.cjs:83`, appelé par `applyTheme`. C'est ce qui
  met menus natifs, dialogues et ascenseurs de l'OS au diapason —
  `electron/main.js:575-586` dit déjà que le réglage vaut pour toute
  l'application. `preview:devtools` garde son paramètre.

### 7. Les couleurs en dur

Quatre hex applicatifs seulement, mais quinze `rgba()` — et c'est l'inverse de ce
qu'on croit : les `rgba()` sont le vrai trou, parce que le garde-fou ne connaît
que le hex.

- `ActivityPanel.tsx:27` `#3a3c47` (série « commits », le seul des trois qui ne
  soit pas déjà un jeton) → un jeton.
- `tabs/Produit.tsx:515,518` `#4d5060` : le commentaire dit que `var()` n'est pas
  fiable en attribut de présentation SVG — c'est vrai de l'attribut, pas de la
  propriété CSS. Passer par `style={{ fill: 'var(--color-border-selected)' }}`.
- `tabs/Navigateur.tsx:539` et `navigateur-webview.ts:225,227` `#ffffff` : fond du
  webview Chromium, qui n'est pas l'ovrsee — reste littéral (déjà dans
  `EXCEPTIONS`), mais à revoir : en clair, le blanc n'est plus une anomalie.
- `navigateur-webview.ts:125-126` (`#7d76f0`, `rgba(125,118,240,.18)`) : injecté
  dans le DOM de la **page observée**, qui ne lit pas nos jetons — reste littéral,
  mais choisi lisible sur une page claire comme sombre.
- Les quinze `rgba()` : six voiles `rgba(6,7,14,.88)` recopiés à l'identique
  (`PreferencesPanel.tsx:645`, `CommandPalette.tsx:165`, `Onboarding.tsx:411`,
  `Lightbox.tsx:66`, `TableauDetail.tsx:491`, `ProduitDetail.tsx:227`) →
  `--color-scrim` ; cinq ombres noires (`Shell.tsx:369`, `Lightbox.tsx:97`,
  `Apercu.tsx:427,484`, `ProduitDetail.tsx:55`, dont trois recopient déjà
  `--shadow-lg`) → les `--shadow-*` ; et `Lightbox.tsx:166-169`
  (`rgba(19,20,31,.8)`, `rgba(233,233,237,.92/.4)`) — **les seules couleurs de
  texte en dur de tout `app/src`**, celles qui deviendraient franchement illisibles.
- `hooks/couleurs.test.js` : étendre la regex aux `rgba()`/`rgb()`/`hsl()`, sans
  quoi tout le travail ci-dessus peut se déferaire sans qu'un test bronche ; élaguer
  `FICHIERS_PORTES` — sur ses 20 entrées, **17 ne contiennent plus aucun hex** et
  restent dispensées du contrôle pour rien (dont `App.tsx`, `Terminal.tsx`,
  `Onboarding.tsx`) ; réécrire l'en-tête, qui affirme encore que la raison du
  garde-fou a été retirée. Noter que l'exemption se fait par `basename` sans
  chemin — volontaire (Windows), mais large.
- `app/src/theme.ts:79-88` : les dix jetons `--theme-xterm-*` injectés n'ont
  **aucun consommateur** — les supprimer plutôt que les doubler par thème. Seul
  `--theme-bg-lightbox` est lu (`Lightbox.tsx:97`, `ProduitDetail.tsx:286`).
- Réécrire les commentaires périmés : `theme.ts:1-8`, `theme.test.ts:7-8`,
  `styles.css:96-98` (qui cite un `nocturneClair` disparu).

## Ordre d'exécution

`0` maquette → `1`+`2` la cascade et la palette (le sombre doit rester identique
à ce stade : c'est le moment où on le vérifie) → `4`+`5` le réglage et son
application → `3` le terminal à chaud → `7` les couleurs en dur et le garde-fou →
`6` Electron. Chaque étape est commitable seule ; `T-0218` passe en `en-cours` au
départ, et la PR cite l'issue #64.

## Vérification

Tests (`node:test`, aucun framework — `pnpm test`) :

- `hooks/theme-clair.test.js`, neuf : aucun jeton défini uniquement dans le bloc
  clair ; le bloc clair ne redéfinit aucun palier `--color-accent-*` (c'est la
  règle qui protège les six accents) ; les sept niveaux de texte tiennent 4,5:1
  sur les surfaces claires. Réutilise `luminance`/`contraste` de
  `hooks/accents.test.js:44-55`.
- `hooks/accents.test.js` : un second cas « chaque accent tient le contraste sur
  le fond clair », mesuré sur le palier 800 et sur `--color-on-accent`. Son
  angle mort actuel est exactement celui-là : il ne mesure que contre
  `SURFACE_CARD = '#131519'`, donc il resterait **vert avec une palette claire
  illisible**. Attention aussi à sa mécanique : il extrait le `:root` par
  `/:root\s*\{([\s\S]*?)\n\}/` — le bloc clair doit venir **après**, et le `:root`
  sombre garder son accolade fermante en colonne 0.
- `app/src/theme.test.ts` : les valeurs sombres inchangées (le test existant),
  `resolveTheme` sur les trois préférences, et `appliquerThemeTerminal` sur un
  faux pane `{ options: {} }` — c'est le contrôle qui échoue si la bascule à chaud
  se recasse.
- `hooks/settings.test.js` : `theme` validé, valeur inconnue ramenée au défaut,
  non surchargeable par `ovrsee.config.json`.

Puis `pnpm lint`, `pnpm typecheck`, `pnpm build:ui`, et la CI (les tests tournent
aussi sous Windows).

À l'œil, `pnpm electron` — rien de ce qui suit n'est couvert par les tests :

1. Les trois réglages dans Préférences ; en `système`, changer le thème de macOS
   fenêtre ouverte et voir l'interface suivre.
2. Le terminal : basculer pendant qu'une session `claude` tourne — le fond, le
   texte et **l'historique déjà affiché** doivent changer sans que la session
   meure. Puis replier/déplier le panneau.
3. Les sept onglets, la lightbox, la palette de commandes, les modales, la
   présentation de premier lancement, le popover de la barre de menu.
4. Un projet avec un accent non violet (ambre, puis cyan) en clair : la teinte
   doit rester la sienne, et les pastilles de choix garder leurs six couleurs.
5. Les DevTools du Navigateur, et un rechargement à froid pour vérifier
   l'absence de flash sombre.
