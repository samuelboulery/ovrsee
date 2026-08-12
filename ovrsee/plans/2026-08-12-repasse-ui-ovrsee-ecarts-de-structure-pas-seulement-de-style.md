---
{
  "status": "closed",
  "title": "Repasse UI ovrsee — écarts de structure, pas seulement de style",
  "opened": "2026-08-12",
  "closed": "2026-08-12",
  "commits": [
    {
      "sha": "8364d47",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "app/src/Onboarding.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/onboarding.test.tsx",
        "app/src/profilage.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "27f625b",
      "date": "2026-08-12",
      "files": []
    }
  ]
}
---

# Repasse UI ovrsee — écarts de structure, pas seulement de style

## Contexte

Le chantier précédent (« Repasse UI ovrsee — coller à la maquette », clos) a corrigé la
police, deux pictos, la palette ⌘K et l'étape 2 de l'onboarding, plus un audit visuel
qui a trouvé deux vrais bugs (Produit, Stack). Mais il comparait surtout des
*captures d'écran* — assez pour attraper des tokens et des libellés faux, pas assez
pour voir qu'un panneau entier est absent.

L'utilisateur a raison : « la structure et le design des pages n'est pas le même ».
Cette fois, trois agents ont lu le HTML brut de `Ovrsee App.dc.html` (structure DOM,
largeurs en dur, imbrication des conteneurs) **et** le code React ligne à ligne, écran
par écran, plutôt que de comparer des rendus. Le verdict : plusieurs écrans n'ont pas
le même **squelette de mise en page** — pas juste des couleurs ou des pictos qui
diffèrent, des panneaux entiers absents ou repositionnés. Vérifié en relisant le HTML
brut moi-même pour les affirmations les plus surprenantes (le sujet du chantier
justifie de ne pas se fier à un seul passage).

Décidé avec l'utilisateur :
- **Données — vue pleine (2m)** part en chantier séparé : c'est un diagramme ER neuf
  (cartes de tables positionnées, connecteurs, zoom), pas une restylisation. Bien plus
  gros que le reste réuni.
- **Produit — vue Liste** écartée comme le reste des ajouts Phase 2 (nouvelle
  fonctionnalité). Seul le *déplacement* des boutons déjà fonctionnels
  (Comparer, Crawler) vers l'en-tête est dans ce chantier.

## Le motif qui revient : panneau droit persistant

Trois écrans partagent le même écart, et c'est le plus gros de tous : la maquette pose
un panneau de droite **fixe et toujours visible** (contenu contextuel), le code actuel
met ce même contenu **dans le flux principal**, en une colonne, ou en bascule
plein-écran. Un seul motif à construire, appliqué trois fois :

- **Aperçu** (`app/src/tabs/Apercu.tsx:237-283`) — `Deploiements` et le bloc README
  sont rendus dans la colonne principale (`flex: 1; min-width: 0; max-width: 820px`,
  ligne 242), à la suite de Santé/Branches/Environnements. La maquette (2b) les
  regroupe dans une colonne fixe à droite (~320px) : Déploiements en haut, README avec
  sommaire en dessous, indépendante du défilement de la colonne principale. Le
  `Sommaire` actuel (`hauteur`-collé, conditionnel à 3+ titres) est un pis-aller à
  remplacer par ce panneau.
- **Navigateur** (`app/src/tabs/Navigateur.tsx:722-754`) — l'élément sélectionné
  s'affiche dans une barre inline en bas de la zone webview. La maquette (2c) en fait
  un panneau fixe à droite (~340px) : sélecteur CSS, texte, route, boutons « Coller
  dans Claude » / « Ouvrir un ticket », liste des routes connues. Électron uniquement
  — à vérifier manuellement avec `pnpm electron`, le navigateur ne peut pas le tester.
- **Historique** (`app/src/tabs/Historique.tsx`, zone `ActivityGraph`) — le graphe
  d'activité est une vue plein-écran parmi trois (boutons empile/densite/type qui
  remplacent la frise). La maquette (2e) le pose en panneau fixe à droite (~300px),
  **visible en permanence** à côté de la frise de tickets/commits, avec ses propres
  filtres (Plans/Tickets/Commits hors plan) et le sélecteur de fenêtre (14j/12s/type)
  dans ce panneau — pas au-dessus de la frise.

Dans les trois cas : extraire le contenu concerné dans un panneau `flex: none;
width: ~300-340px; border-left: 1px solid var(--color-divider)`, à droite du contenu
principal qui redevient `flex: 1`. Réutiliser le style déjà établi par le panneau de
détail de Produit (`DetailPanel`, `app/src/tabs/Produit.tsx:422-600`, déjà résizable
à 330px) comme référence de largeur/style plutôt que d'inventer un nouveau motif.

## Préférences — colonne d'aperçu en direct absente

`app/src/PreferencesPanel.tsx` : la modale est `min(860px, 100%)` × `min(600px,
100%)`, contenu en une seule colonne qui défile. La maquette (2i) est `1100×700`,
scindée en deux : contenu réglages à gauche (défile), **panneau d'aperçu fixe à droite
(~300px, sans défilement)** qui montre `PreferencesPreview` en direct — ce composant
existe déjà (`app/src/PreferencesPreview.tsx`) mais n'est monté nulle part dans la
modale Préférences elle-même. C'est une réutilisation directe, pas un composant à
écrire : agrandir la modale, scinder le corps en deux colonnes, monter
`PreferencesPreview` dans la colonne de droite avec un libellé « Aperçu en direct ».

## Onboarding — châssis de gauche absent, étape 2 incomplète

`app/src/Onboarding.tsx` : deux écarts, un de châssis, un de contenu.

- **Châssis** : la maquette (2j) a une colonne de gauche fixe (300px) — logo, les 3
  étapes en indicateurs (coche/numéro courant/numéro à venir) avec leur titre, note
  d'aide en bas. Le code actuel n'a qu'un en-tête horizontal avec 3 puces rondes sans
  titre. Rail à construire, réutilise le `Logo` de `OnboardingArt.tsx` déjà écrit.
- **Étape 2 — contenu incomplet** (vérifié en relisant le HTML source ligne à ligne,
  `Ovrsee App.dc.html:1774-2013`) : la maquette empile DEUX blocs sur cet écran, pas
  un seul — la galerie de 4 préréglages (déjà construite ce chantier-ci) **puis**, en
  dessous, une **grille 2×3 de bascules par vue** (Aperçu toujours actif et désactivé,
  Navigateur/Produit/Historique/Tableau actifs, Données décoché avec le sous-texte
  « aucune source détectée »). C'est un second niveau de réglage — la galerie choisit
  un point de départ, la grille l'affine vue par vue — absent du code actuel, qui
  s'arrête à la galerie. Écrit sur `brouillon.onglets`, données déjà en mémoire (même
  mécanisme que `SectionInterface` des Préférences, à réutiliser plutôt que
  réinventer).

## Produit — actions déplacées vers l'en-tête

`app/src/tabs/Produit.tsx` : « Comparer deux dates » (`CompareModal`, lignes 609-649)
et l'action Crawler existent déjà et fonctionnent — seul leur emplacement diffère.
La maquette (2d) les met dans la barre d'en-tête (ligne 86-108 actuelle), à côté du
fil « ovrsee / Produit · 7 pages... ». Aujourd'hui, comparer ne se déclenche que
depuis `DetailPanel` (page sélectionnée) ; Crawler n'apparaît pas du tout dans
Produit.tsx (seulement dans le panneau de commandes du terminal). Déplacer/ajouter les
deux boutons dans l'en-tête — pas de nouvelle logique, `CompareModal` et l'action
crawl existants suffisent.

## Historique — graphe d'activité, deux écarts internes

Une fois le panneau droit posé (section précédente), deux écarts internes au graphe
lui-même, dans `ActivityGraph` (`Historique.tsx`) :
- **Densité 12 semaines** (`WeeklyDensity`) : la maquette est une vraie grille CSS
  12 colonnes × 7 lignes (heatmap, intensité de couleur par cellule). Le code actuel
  fait des barres flex. À reconstruire en grille.
- **Par type 30 jours** (`ByTypeBars`) : la maquette a 4 séries (Commits, Tickets
  écrits, Plans capturés, **Scans**). Le code actuel n'en a que 3 (commits/tickets/
  plans) — Scans manque. Vérifier que `hooks/density.js` a la donnée nécessaire avant
  d'ajouter la série ; sinon l'ajouter à l'agrégation.

## Hors périmètre — vérifié, pas à construire

- **2a (Système) et 2k (États)** sont les planches de référence du design system de la
  maquette elle-même (variantes de logo, palette, catalogue d'états de boutons/
  toggles/badges) — pas des écrans de l'app. Ne pas construire de « page de démo » ;
  vérifier ponctuellement que `_ds/ovrsee/styles.css` (`.btn`, `.seg`, `.tag`,
  toggles) reflète bien les états montrés, corriger seulement un vrai écart trouvé.
- **Pied de la palette ⌘K** : un agent a signalé son absence — faux, il existe déjà
  (ajouté ce chantier-ci, vérifié à l'écran). Pas d'action.
- **Largeurs au pixel près** (colonnes Tableau 236 vs 268px, colonne gauche des
  cartes Stack 190/170 vs 150px, panneaux droits 320-372px selon l'écran) : réels
  mais mineurs, et la maquette elle-même n'est pas parfaitement cohérente d'un écran
  à l'autre sur ces chiffres. À ajuster en passant dans chaque phase concernée, pas
  une phase à part — viser la fourchette observée (300-340px pour les panneaux
  droits) plutôt qu'un nombre unique.
- **Vue Liste de Produit** et **diagramme ER de Données** : écartés (voir Contexte).

## Vérification

- `pnpm typecheck` et `pnpm test` après chaque écran touché.
- Comparaison visuelle directe dans Chrome contre `Ovrsee App.dc.html` (comme le
  chantier précédent) pour Aperçu, Historique, Produit, Préférences, Onboarding —
  tous testables via `pnpm dev`.
- **Navigateur reste Électron uniquement** — le panneau droit de l'élément
  sélectionné doit être vérifié avec `pnpm electron`, pas `pnpm dev`.
- Après le panneau droit d'Aperçu : revérifier que `pnpm ovrsee:crawl` retrouve
  toujours les 7 routes (rail `<a href>` inchangé par ce chantier, mais toute
  réorganisation du DOM autour mérite une revérification).
