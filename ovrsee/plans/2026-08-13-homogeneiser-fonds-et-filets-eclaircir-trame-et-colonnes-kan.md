---
{
  "status": "open",
  "title": "Homogénéiser fonds et filets, éclaircir trame et colonnes kanban",
  "opened": "2026-08-13",
  "closed": null,
  "commits": [
    {
      "sha": "6527486",
      "date": "2026-08-13",
      "files": [
        "_ds/ovrsee/styles.css",
        "app/src/ActivityPanel.tsx",
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/EquipmentPanel.tsx",
        "app/src/Illisibles.tsx",
        "app/src/Lightbox.tsx",
        "app/src/Onboarding.tsx",
        "app/src/OnboardingArt.tsx",
        "app/src/PreferencesIntegrations.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesPreview.tsx",
        "app/src/PreferencesProfils.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/SkillsPanel.tsx",
        "app/src/StatusBar.tsx",
        "app/src/Terminal.tsx",
        "app/src/ViewBar.tsx",
        "app/src/Welcome.tsx",
        "app/src/markdown.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Deploiements.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Environnements.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Sante.tsx",
        "app/src/tabs/Stack.tsx",
        "app/src/tabs/Tableau.tsx",
        "app/src/theme.ts"
      ]
    },
    {
      "sha": "487c939",
      "date": "2026-08-13",
      "files": []
    }
  ]
}
---

# Homogénéiser fonds et filets, éclaircir trame et colonnes kanban

## Contexte

La remontée de contraste (T-0120, commit `b8b7d6e`) a rendu visible un problème
qu'elle n'a pas créé : **les composants ne suivent pas le design system**. Une
carte de Santé est en `#101216`, une carte de nœud dans Produit en
`var(--color-surface)` (`#0b0c0e`), un encart de Tableau en `#171920` — trois
fonds pour un même rôle. Idem pour les panneaux : sidebar de détail, dock de
Produit et panneau d'activité partagent `var(--theme-bg-secondary)`, mais les
modales et le rail de Produit tirent sur `--theme-bg-tertiary`.

Le comptage sur `app/src` : **43 valeurs de `background` distinctes** et **26 de
`border`**, alors que le design system définit 9 surfaces et 4 filets. Presque
tout est écrit en hex littéral ou via la rampe `--color-neutral-*` détournée de
son rôle.

Deux conséquences visibles sur les captures :

- `var(--color-neutral-800)` sert de filet dans **17 endroits**. Il vient de
  passer de `#3f424a` à `#585d66` (rampe de texte, pas de filet) : ces bordures
  sont maintenant nettement plus claires que les `var(--color-divider)` voisines.
- `var(--color-warning-600)`, `--color-warning-200` et `--color-warning-300`
  (`app/src/tabs/Donnees.tsx:66,70,82,86,96,100`) **n'existent pas** dans
  `styles.css` : ces encarts d'avertissement n'ont ni filet ni couleur de texte.

Demandes explicites en plus : éclaircir la trame de points du canevas et le fond
des colonnes du tableau kanban.

Résultat visé : un fond par rôle, un filet par rôle, écrits en `var(--…)` — pas
une refonte visuelle, une mise au carré.

## 1. Réétager les surfaces (`_ds/ovrsee/styles.css`)

Le problème de fond : `--color-surface-panel` (`#0a0b0d`) est **plus sombre que
les rails**, alors qu'un panneau porte des cartes. D'où des colonnes kanban quasi
noires. Nouvelle échelle, pas de 5-6 points, monotone :

```
--color-bg               #08090a   inchangé   fond application
--color-surface          #0b0c0e   inchangé   rails (barre de titre, onglets, statusbar)
--color-surface-panel    #0a0b0d → #0d0e12    panneaux, sidebars, docks, colonnes kanban
--color-surface-card     #101216 → #131519    cartes
--color-surface-control  #171920 → #191b22    boutons, champs, selects
--color-surface-hover    #1b1d24 → #1f212a    survol de ligne
--color-surface-elevated #202229 → #24262f    surface élevée
--color-surface-active   #262832 → #2a2d38    actif / sélectionné
--color-surface-segment  #2f313b → #33363f    pastille segmentée active
```

Filets, accents, statuts et texte : **inchangés** (réglés au commit précédent).

## 2. Sweep des rôles dans `app/src`

Aucune classe CSS nouvelle, aucune migration vers `.card`/`.btn` : les styles
restent en ligne via `s()`. Seules les **valeurs** changent, remplacées par le
jeton du rôle. C'est le plus court chemin au même résultat visuel.

**Fonds**

| Trouvé | Devient |
|---|---|
| `#101216`, `var(--color-surface-card)` | `var(--color-surface-card)` |
| `var(--color-surface)` / `#0b0c0e` **sur une carte** (nœud Produit `Produit.tsx:451-452`, ticket kanban `Tableau.tsx:857`) | `var(--color-surface-card)` |
| `var(--color-surface)` / `#0b0c0e` **sur un rail** | inchangé |
| `#171920`, `var(--color-surface-control)`, `var(--theme-bg-secondary)` **sur un contrôle** | `var(--color-surface-control)` |
| `var(--theme-bg-secondary)` **sur un panneau / sidebar / dock / modale** | `var(--color-surface-panel)` |
| `#1b1d24` | `var(--color-surface-hover)` |
| `#202229` | `var(--color-surface-elevated)` |
| `#262832`, `var(--theme-bg-tertiary)` | `var(--color-surface-active)` |
| `#2f313b` | `var(--color-surface-segment)` |
| `#22242b` utilisé **en fond** (trait séparateur, `Apercu.tsx:266`) | `var(--color-border-chrome)` |
| `#14132a` | `var(--color-plan-bg)` |
| `#1a1608`, `var(--theme-bg-alerte)` | `var(--color-warn-bg)` |
| `#1c0d10` | `var(--color-err-bg)` |
| `#0b1610` | `var(--color-ok-bg)` |
| uniques : `#0e0f12`, `#0f0e1c`, `#242630` | le jeton du rôle qu'ils occupent |

**Filets** — c'est ici que se joue l'homogénéité :

| Trouvé | Devient |
|---|---|
| `var(--color-neutral-800)` (17×), `#2b2d35`, `var(--color-divider)` | `var(--color-border-card)` |
| `var(--color-neutral-700)`, `var(--color-neutral-600)`, `#22232a` (7×), `#363841` | `var(--color-border-control)` |
| `#4d5060` | `var(--color-border-selected)` |
| `#2a2660`, `#2f2a66` | `var(--color-plan-border)` |
| `#3a1c22` | `var(--color-err-border)` |
| `#3a3117` | `var(--color-warn-border)` |
| `#1c3728` | `var(--color-ok-border)` |
| `var(--color-warning-600)` — **jeton inexistant** | `var(--color-warn-border)` |

`--color-divider` reste défini comme alias de `--color-border-card` ; les usages
existants n'ont pas à changer.

**Textes** — même geste, jetons de la hiérarchie :

| `#d5d8dd` → `var(--color-text-secondary)` · `#a2a8b2` → `var(--color-text-tertiary)` ·
`#7f858f` → `--color-text-quaternary` · `#737983` → `--color-text-discrete` ·
`#6b7078` → `--color-text-faint` · `#585d66` → `--color-text-ghost` ·
`#b6bac1` → `--color-text-secondary` · `#f2f3f5` → `--color-text` |
| `var(--color-warning-200)`, `var(--color-warning-300)` — **inexistants** → `var(--color-warn)` |

**Radius**, seulement sur les blocs déjà touchés (cartes, panneaux, contrôles) —
aujourd'hui 4, 5, 6, 7, 8, 9, 10 et 14px coexistent : cartes **8px**, contrôles
**6px**, panneaux et modales **12px**, badges et pastilles **4px**. Les
`border-radius: 50%` / `999px` (pastilles rondes, interrupteurs) ne bougent pas.

## 3. Les deux demandes explicites

**Trame de points du canevas** — `app/src/tabs/Produit.tsx:157`, seul endroit
où elle existe :

```
background: #08090a radial-gradient(#16171c 1px, transparent 1px) 0 0 / 22px 22px
        →   var(--color-bg) radial-gradient(var(--color-border-card) 1px, transparent 1px) 0 0 / 22px 22px
```

`#16171c` → `#2b2d35` : la trame se lit sans devenir un quadrillage.

**Colonnes du tableau kanban** — `app/src/tabs/Tableau.tsx:529-530`. Le fond
actuel est `color-mix(in srgb, var(--color-surface) 55%, transparent)`, soit
~`#090a0b` sur le fond d'application : plus sombre que le fond. Il devient
`var(--color-surface-panel)` (`#0d0e12`), opaque, et les cartes de ticket passent
à `var(--color-surface-card)` (`#131519`) — elles se posent enfin *sur* la
colonne au lieu de s'y enfoncer. Le survol de colonne prend
`var(--color-surface-hover)`.

## 4. Nettoyage

Une fois le sweep fait, `bgSecondary`, `bgTertiary`, `bgQuaternary` et
`bgAlerte` de `app/src/theme.ts` n'ont plus d'appelant : les supprimer, ainsi que
les variables CSS correspondantes injectées par `initializeTheme()`. `bgPrimary`,
`bgError`, `bgLightbox` et toute la palette xterm restent (`theme.test.ts`
n'assert que `bgPrimary` et `xtermCursor`).

## Fichiers touchés

- `_ds/ovrsee/styles.css` — bloc `:root`, les 9 surfaces
- `app/src/theme.ts` — suppression des jetons de fond redondants
- `app/src/tabs/*.tsx` — les 10 onglets ; le gros du sweep est dans `Sante.tsx`,
  `Apercu.tsx`, `Deploiements.tsx`, `Produit.tsx`, `Tableau.tsx`, `Donnees.tsx`
- `app/src/*.tsx` — `App.tsx`, `Terminal.tsx`, `ActivityPanel.tsx`,
  `EquipmentPanel.tsx`, `SkillsPanel.tsx`, `PreferencesPanel.tsx`,
  `PreferencesProjet.tsx`, `PreferencesIntegrations.tsx`, `PreferencesPreview.tsx`,
  `Onboarding.tsx`, `Welcome.tsx`, `ViewBar.tsx`, `StatusBar.tsx`

Le sweep se fait **fichier par fichier**, pas au `sed` global : un même hex sert
de fond de panneau à un endroit et de fond de bouton à un autre, seul le contexte
tranche.

## Vérification

1. `pnpm typecheck` et `pnpm test` (221 tests) — verts.
2. Comptage avant/après :
   `grep -rhoE "background: (#[0-9a-f]{6}|var\(--[a-z0-9-]+\))" app/src --include="*.tsx" | sort -u | wc -l`
   doit tomber de 43 à ~15 (surfaces + statuts + accent + marque).
   Même mesure sur `border: 1px solid …` : de 26 à ~10.
3. Aucun jeton fantôme : `grep -rn "color-warning" app/src` ne retourne rien.
4. `pnpm electron`, puis les 7 onglets :
   - **Tableau** : colonnes visiblement plus claires que le fond, cartes de
     ticket plus claires que les colonnes, sélection lisible.
   - **Produit** : trame de points perceptible, cartes de nœud au même fond que
     les cartes de Santé, dock flottant au même fond que la sidebar.
   - **Santé / Aperçu / Déploiements** : cartes indiscernables les unes des
     autres en fond et en filet.
   - **Données** : les encarts d'avertissement ont enfin un filet et un texte
     colorés.
   - Rails, barre de titre, statusbar et terminal : inchangés.
