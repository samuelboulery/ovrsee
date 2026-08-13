---
{
  "status": "open",
  "title": "Remonter le contraste de l'interface",
  "opened": "2026-08-13",
  "closed": null,
  "commits": []
}
---

# Remonter le contraste de l'interface

## Contexte

L'interface est très sombre et très resserrée : huit niveaux de surface tiennent
entre `#08090a` et `#24252c`, et les filets (`#17181d`, `#1c1d22`) sont presque
invisibles sur les fonds qu'ils séparent. Résultat, les cartes, les contrôles et
les lignes de liste se fondent les uns dans les autres.

Côté texte, les quatre derniers niveaux de la hiérarchie échouent WCAG AA sur
`#0b0c0e` :

| Jeton | Valeur | Ratio |
|---|---|---|
| `--color-text-quaternary` | `#62666e` | ~2,4:1 |
| `--color-text-discrete` | `#55585f` | ~1,9:1 |
| `--color-text-faint` | `#4e5158` | ~1,7:1 |
| `--color-text-ghost` | `#3f424a` | ~1,3:1 |

Objectif : remontée **modérée** — chaque élément se détache, l'app reste sombre
et calme. L'accent (`#7d76f0`) et les statuts (ok/warn/err/plan) ne bougent pas.

## Difficulté : les jetons sont dupliqués en dur

`_ds/ovrsee/styles.css` se déclare source de vérité, mais ~30 % des couleurs sont
recopiées en hex littéral dans les composants (`app/src/App.tsx`,
`app/src/Terminal.tsx`, `app/src/tabs/*.tsx`, `app/src/theme.ts`…). Chaque valeur
retouchée dans le CSS doit donc l'être partout ailleurs, sinon l'écart se voit
tout de suite (une carte au nouveau fond à côté d'un filet resté à l'ancien).

Les hex en dur sont exactement les valeurs des jetons — un remplacement littéral
suffit, pas de migration vers `var(--…)` (hors périmètre).

## Table de correspondance

Appliquée à `_ds/ovrsee/styles.css` **et** à toute occurrence littérale sous
`app/src/` (y compris `app/src/theme.ts`).

**Surfaces** — `--color-bg`, `--color-surface`, `--color-surface-panel` inchangés
(le fond et les rails restent l'ancrage sombre) :

```
--color-surface-card      #0c0d10 → #101216
--color-surface-control   #101114 → #171920
--color-surface-hover     #131418 → #1b1d24
--color-surface-elevated  #16171d → #202229
--color-surface-active    #1c1d24 → #262832
--color-surface-segment   #24252c → #2f313b
```

**Filets** — le gain principal pour « distinguer les éléments » :

```
--color-border-chrome     #17181d → #22242b
--color-border-card       #1c1d22 → #2b2d35
--color-border-control    #24252b → #363841
--color-border-selected   #383a44 → #4d5060
```

**Texte** — `--color-text` (`#f2f3f5`) et `--color-text-secondary` (`#b6bac1`)
inchangés, déjà AAA/AA :

```
--color-text-tertiary     #9096a0 → #a2a8b2   (5,2:1 → 6,6:1)
--color-text-quaternary   #62666e → #7f858f   (2,4:1 → 4,3:1)
--color-text-discrete     #55585f → #737983   (1,9:1 → 3,6:1)
--color-text-faint        #4e5158 → #6b7078   (1,7:1 → 3,2:1)
--color-text-ghost        #3f424a → #585d66   (1,3:1 → 2,4:1)
```

**Halo de sélection** — `--ring-selected` : `rgba(255,255,255,0.045)` → `0.075`.

## Piège : la rampe neutre

`--color-neutral-*` (styles.css:92-100) partage plusieurs valeurs avec les jetons
de texte et de filets. Un remplacement aveugle casse sa monotonie
(`-500 #74787f` deviendrait plus sombre que `-600` remonté à `#7f858f`).

La rampe se réécrit donc **à la main**, après le remplacement, avec un étagement
cohérent :

```
100 #f2f3f5   200 #dcdee2   300 #c2c6cd   400 #a2a8b2   500 #8b919b
600 #7f858f   700 #737983   800 #585d66   900 #363841
```

Les rampes `--color-accent-*` et `--color-accent-2-*` ne bougent pas.

## Cas isolés (hex hors jetons, à traiter à la main)

| Fichier | Ligne | Actuel | Nouveau | Rôle |
|---|---|---|---|---|
| `app/src/ActivityPanel.tsx` | 27 | `#2a2b33` | `#3a3c47` | série « commits » de la frise, quasi invisible |
| `app/src/App.tsx` | 1295 | `#33353c` | `#45474f` | puce d'onglet inactive |
| `app/src/tabs/Sante.tsx` | 131 | `#33353c` | `#45474f` | idem |
| `app/src/ViewBar.tsx` | 33 | `#34353c` | `#45474f` | séparateur `/` du fil d'ariane |
| `app/src/tabs/Produit.tsx` | 331, 350 | `#1e1f25` | `#2b2d35` | filet du dock flottant |
| `app/src/App.tsx` | 998 | `#1e1f25` | `#242630` | pastille d'initiale de projet |

`NIVEAUX_DENSITE` (`ActivityPanel.tsx:234`) reprend `#1c1d24` en premier palier :
il suit la table (`→ #262832`), les quatre autres paliers sont déjà lisibles.

## Fichiers touchés

- `_ds/ovrsee/styles.css` — bloc `:root`, lignes 39-100 (jetons + rampe neutre) et
  ligne 82 (`--ring-selected`)
- `app/src/theme.ts` — `bgSecondary` (`#101114`), `bgTertiary` (`#1c1d24`).
  `bgPrimary`, `bgError`, `bgLightbox` et toute la palette xterm ne bougent pas.
- `app/src/*.tsx` et `app/src/tabs/*.tsx` — remplacement littéral des hex de la
  table. Fichiers concernés : `App.tsx`, `Terminal.tsx`, `ViewBar.tsx`,
  `StatusBar.tsx`, `ActivityPanel.tsx`, et `tabs/{Historique,Sante,Apercu,
  Deploiements,Tableau,Branches,Produit,Donnees,Navigateur}.tsx`.

Aucun composant nouveau, aucune migration vers `var(--…)`, aucune dépendance.

## Vérification

1. `pnpm test` — `theme.test.ts` n'assert que `#0b0c0e` et `#7d76f0`, tous deux
   inchangés : la suite doit rester verte sans retouche.
2. `pnpm typecheck`.
3. `grep -rn '#62666e\|#55585f\|#4e5158\|#3f424a\|#17181d\|#1c1d22\|#24252b\|#383a44\|#0c0d10\|#101114\|#131418\|#1c1d24\|#16171d\|#24252c\|#9096a0' app/src _ds/ovrsee`
   doit ne plus rien retourner — aucune valeur ancienne résiduelle.
4. `pnpm electron` puis inspection visuelle des 7 onglets : les cartes doivent se
   détacher du fond, les filets de liste être lisibles, les métadonnées et les
   libellés de section (mono, capitales) se lire sans effort. Vérifier en
   particulier Tableau (sélection + filets), Historique (frise + encadrés plan) et
   le terminal (les rails ne bougent pas, le contenu xterm non plus).
5. Contrôler que les captures de crawl affichées dans Aperçu/Navigateur ne sont
   pas affectées (aucun filtre CSS global n'est ajouté — seuls des jetons changent).
