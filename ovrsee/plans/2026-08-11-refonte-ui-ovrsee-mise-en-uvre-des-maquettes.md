---
{
  "status": "open",
  "title": "Refonte UI Ovrsee — mise en œuvre des maquettes",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "f666ce1",
      "date": "2026-08-11",
      "files": [
        "_ds/ovrsee/styles.css",
        "app/index.html",
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/EquipmentPanel.tsx",
        "app/src/Garde.tsx",
        "app/src/Illisibles.tsx",
        "app/src/Lightbox.tsx",
        "app/src/Onboarding.tsx",
        "app/src/OnboardingArt.tsx",
        "app/src/PreferencesControls.tsx",
        "app/src/PreferencesIntegrations.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesPreview.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/Terminal.tsx",
        "app/src/Welcome.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/main.tsx",
        "app/src/markdown.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Deploiements.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Environnements.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/theme.test.ts",
        "app/src/theme.ts",
        "app/src/views.ts",
        "build/icon.icns",
        "build/icon.ico",
        "build/icon.svg",
        "electron/main.js",
        "hooks/couleurs.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "\"ovrsee/tickets/T-0039-th\\303\\250me-clair-illisible-sidebar-timeline-terminal.md\"",
        "package.json",
        "patches/@phosphor-icons__react.patch",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "scripts/make-icon.js"
      ]
    }
  ]
}
---

# Refonte UI Ovrsee — mise en œuvre des maquettes

## Contexte

Le dossier `/Users/sam/Downloads/Redesign UI Ovrsee 2` contient deux maquettes
canvas (`Ovrsee Refonte.dc.html` — exploration initiale 1a–1e, et
`Ovrsee App.dc.html` — version aboutie 2a–2m, système + 11 écrans). `ref/`
contient 5 captures de l'app **actuelle** (référence, pas la cible) ;
`uploads/` contient des captures Chronicle/ROX/Linear qui sont de l'inspiration
de direction (agents, palettes, diffs), pas des écrans à porter.

La maquette aboutie change trois choses à la fois :
1. **Identité** — nouveau logo (œil en grille de pixels 7×5), nouvelle rampe
   de couleurs, IBM Plex Sans/Mono à la place d'Inter, pictos Phosphor
   (contour au repos, plein à l'état actif) à la place du texte seul.
2. **Châssis** — rail d'icônes vertical à gauche remplace la barre d'onglets
   horizontale du haut ; palette ⌘K globale ; rail repliable (⌘B).
3. **Fonctionnalités neuves** — panneau DevTools dans Navigateur (Console +
   Réseau + Éléments avec sélecteur → ticket), comparaison de deux dates dans
   Produit, graphe d'activité à quatre lectures dans Historique, navigateur de
   schéma DB dans Données, refonte Préférences/Onboarding.

Décisions actées avec l'utilisateur :
- **Remplacement complet** de Nocturne par le nouveau système (pas un
  remaping de tokens) — logo, rampe, typo, pictos, châssis.
- **Phasé** : la fondation visuelle + châssis + Préférences/Onboarding
  d'abord ; les fonctionnalités réseau-neuves (DevTools Réseau, ticket depuis
  élément, comparaison de dates, graphe d'activité complet, schéma DB) en
  phases suivantes, tickets séparés.
- Les plans/tickets en cours sur le contraste du thème clair (T-0039, T-0042)
  sont **remplacés** par la refonte : le nouveau système de tokens règle le
  contraste par construction, pas de correctif à part. T-0040 (installeur
  Windows) est sans rapport, il continue son cours.

## Ce que la maquette confirme déjà couvert (pas de reconstruction)

L'exploration du code montre que plusieurs écrans de la maquette 2a–2m sont
déjà structurellement présents — la refonte est une **restylisation**, pas une
reconstruction, pour :
- **Préférences** (`PreferencesPanel.tsx`) : les 5 sections de la maquette
  2i (Profils, Général, Interface, Claude Code, Projet) existent déjà sous
  ces noms exacts, avec aperçu en direct (`PreferencesPreview.tsx`) et
  écriture à la volée. Terminal Bas/Côté/Plein/Masqué et visibilité/ordre des
  onglets existent déjà dans `settings.terminal` / `settings.onglets`.
- **Onboarding** (`Onboarding.tsx`) : 3 écrans déjà — explication, profil,
  configuration. La maquette 2j demande un renommage/reséquençage vers
  « Ce que fait l'ovrsee → Composition et vues (4 préréglages Dev / Sobre /
  Découverte / Complet) → Le premier dépôt », pas un nouveau flux.
- **Stack** (`Stack.tsx`, `hooks/whys.js`) : lecture `package.json` +
  commentaires `WHY:` déjà en place, tel que documenté dans le CLAUDE.md.
  La maquette 2h ne demande qu'un filtre Production/Dev/Sans raison en plus.
- **Données** (`Donnees.tsx`) : l'état vide honnête de la maquette 2g (« aucune
  source, Graphify passe devant ») est déjà le comportement actuel.

## Contraintes dures du code existant

- **Les liens d'onglets doivent rester de vrais `<a href>`** —
  `App.tsx:585-613`, commentaire explicite : `crawl/index.js` lit
  `page.$$eval('a[href]')` pour découvrir les routes. Le rail d'icônes qui
  remplace la barre du haut doit donc rendre des `<a href>` réels, pas des
  `<button onClick>` — sans quoi le crawl du projet ovrsee lui-même casse.
- **`s()` (`style.ts`) traduit du CSS inline en objet React tel quel** — tout
  changement de token passe par les variables CSS (`--color-*`,
  `--space-*`, `--font-*`), jamais par une réécriture des appels `s(...)`
  eux-mêmes. Le swap de design system est donc en grande partie un swap du
  fichier de tokens, pas un rewrite des composants.
- **Aucune lib d'icônes aujourd'hui** — 3 pictos Phosphor existants sont
  dessinés à la main (`PreferencesControls.tsx:225-231`, commentaire
  explicite : éviter une 4e dépendance de prod pour 3 glyphes). La refonte
  en utilise ~15-20 (rail 7 vues + actions + états). Dessiner ça à la main
  n'est plus raisonnable : **ajouter `@phosphor-icons/react` en dépendance
  de prod est à valider avec l'utilisateur avant de commencer** (règle
  pnpm : demander avant d'installer).
- **IBM Plex Sans/Mono** — la maquette les charge en `<link>` Google Fonts
  (réseau). L'app Electron doit fonctionner hors-ligne une fois packagée :
  auto-héberger les fichiers woff2 dans `app/src/assets/` plutôt que
  dépendre d'un CDN au runtime. Pas de nouvelle dépendance npm, juste des
  fichiers statiques — mais à trancher explicitement au démarrage du
  chantier (à mentionner, pas une dépendance qui bloque sur l'accord pnpm).
- **`server/api.js` a un seul `resolve()`** appelé par trois hôtes (Vite,
  `ovrsee://`, MCP). Toute nouvelle route (recherche ⌘K, ticket depuis
  élément, comparaison de dates) passe par cette fonction unique — jamais
  une logique dupliquée par hôte.
- **L'invariant « l'ovrsee lit, n'exécute que le terminal demandé »** — le
  panneau DevTools et le sélecteur d'élément sont en lecture seule
  (console, réseau, sélection). Aucune des fonctionnalités neuves de la
  maquette ne l'enfreint tant que le picker reste un rapporteur d'infos
  (vers Claude ou un ticket) et non un exécuteur.

## Phase 0 — Fondation : identité, tokens, châssis

Objectif : le nouveau système visuel tourne dans l'app, tous les écrans
existants héritent des nouveaux tokens, le châssis (rail + palette ⌘K +
rail repliable) remplace la barre d'onglets du haut. Aucune fonctionnalité
neuve de données — uniquement présentation et navigation.

**Fichiers clés :**
- `_ds/nocturne-16d90168-.../styles.css` → nouveau fichier de tokens
  (`_ds/ovrsee-<id>/styles.css` ou équivalent) : rampe `#050506` / `#0B0C0E`
  / `#0C0D10` / `#101114` / `#1C1D24`, accent `#7D76F0`, hiérarchie de texte
  (primaire/secondaire/tertiaire/quaternaire/discret), `--font-heading`
  et `--font-body` → IBM Plex Sans, nouvelle famille mono pour
  chemins/ids/dates/commits, échelle d'espacement 4·8·12·16·24.
  `main.tsx:10` pointe vers le nouveau fichier.
- `theme.ts` (dark/light `darkTheme`/`lightTheme`/`nocturneClair`) : reconstruit
  sur la nouvelle rampe — c'est ce qui règle le contraste du thème clair
  visé par T-0039/T-0042, donc ces tickets se ferment ici, pas ailleurs.
- `App.tsx:572-614` (nav actuelle) → nouveau composant `Rail` : rail vertical
  d'icônes Phosphor (7 vues), `<a href>` réels par contrainte crawler
  (ci-dessus), état actif = picto plein + surface élevée (jamais un filet
  coloré, par la maquette 2a). Repli via ⌘B, largeur icône-seule avec
  tooltips (état catalogué en maquette 2k).
- Nouveau composant `CommandPalette` (⌘K) — Phase 0 le construit vide/minimal
  (navigation entre les 7 vues + ouverture Préférences), la recherche de
  tickets et les commandes terminal arrivent en Phase 1.
- Logo : nouveau composant SVG grille 7×5 (remplace `OnboardingArt.tsx:19-54`
  et toute occurrence du logo actuel).
- Icônes : introduire `@phosphor-icons/react` (sous réserve d'accord pnpm) et
  remplacer les 3 SVG dessinés à la main de `PreferencesControls.tsx`.

## Phase 1 — Palette complète, Préférences & Onboarding restylés

- **⌘K complet** : recherche + navigation vers vues, recherche de tickets
  (données déjà en mémoire côté `Tableau.tsx`/`data.ts`, pas de nouvel
  endpoint requis pour la recherche texte simple), un registre statique de
  commandes terminal (Crawler le projet, Graphe complet, Graphe → Obsidian —
  déjà des actions existantes, ⌘K les rend juste découvrables).
- **Préférences** : restylisation des 5 sections existantes sur les nouveaux
  tokens/pictos, sans changement de structure de données
  (`SettingsType` dans `data.ts` reste stable).
- **Onboarding** : reséquençage des 3 écrans vers les 3 titres de la
  maquette 2j, ajout des 4 préréglages de composition (chacun ne fait que
  pré-remplir `settings.onglets` + `settings.terminal`, aucune nouvelle
  donnée).
- **Aperçu, Historique (frise), Tableau, Navigateur (hors DevTools), Produit
  (hors comparaison), Stack, Données** : restylisation pure sur les
  nouveaux tokens/pictos — le contenu et les données affichées ne changent
  pas dans cette phase.

## Phase 2 — Fonctionnalités neuves (roadmap, tickets séparés après Phase 0/1)

Chaque item ci-dessous a été vérifié faisable sans enfreindre l'invariant
lecture-seule ; complexité estimée à partir de l'état actuel du code.

| Fonctionnalité | État actuel | Travail principal |
|---|---|---|
| DevTools → Réseau | Absent (Console et sélecteur d'élément existent, `Navigateur.tsx:337-353` et `:115-193`) | Capturer les requêtes de la webview (CDP / `webContents.debugger` côté `electron/main.js`), nouvel onglet Réseau dans le panneau déjà ouvert par `preview:devtools` |
| Ticket depuis un élément sélectionné | Sélecteur existe, `createTicket()` (`hooks/tickets.js:353`) n'a pas de champs route/sélecteur/html | Étendre la signature + le frontmatter des tickets + la route `/api/tickets` (via `resolve()` unique) |
| Comparer deux dates (Produit) | Aucune logique de diff ; `pages.json`/`scans.jsonl` stockent déjà capture + date + commit par page | UI côte-à-côte des deux captures PNG existantes, pas de diff pixel automatique dans ce scope |
| Graphe d'activité (Historique, 4 lectures) | `hooks/density.js:109` agrège seulement les commits | Étendre l'agrégation à plans + tickets par date, construire les 3 vues (empilé 14j, densité 12 sem., par type 30j) + état vide |
| Schéma DB (Données, vue pleine 2m) | Graphify (`graphify-out/graph.json`) est un graphe de code, pas un schéma DB — ne pas confondre les deux. L'IPC `integrations:fetchSchema` (Supabase, `electron/main.js:374-387`) existe déjà mais est expérimental | Brancher `integrations:fetchSchema` sur une vraie vue Tables/Schéma (PK/FK, relations) au lieu du graphe Graphify — Données garde son état vide honnête tant qu'aucune source (Graphify ou Supabase) n'est déclarée |

Ces cinq items partent en tickets ovrsee séparés une fois la Phase 0/1
posée — pas dans le même chantier, la surface de risque et les fichiers
touchés (electron/main.js, server/api.js, hooks/) sont disjoints du travail
purement visuel.

## Vérification

- `pnpm typecheck` après chaque phase (ne couvre que `app/src`).
- `pnpm test` — inclut le rendu snapshot des 7 onglets (`scripts/test-ui.js`
  compile `app/src`) : vérifie qu'aucun onglet ne lève après le swap de
  tokens/châssis.
- Vérification manuelle **impérative en Electron, pas seulement `pnpm dev`** —
  le rail avec `<a href>` doit être revérifié avec `pnpm ovrsee:crawl` sur le
  projet ovrsee lui-même pour confirmer que le crawl retrouve toujours les 7
  routes (contrainte ci-dessus).
- Thème clair : comparer visuellement aux captures `ref/` existantes une fois
  la nouvelle rampe posée — c'est le critère de clôture de T-0039/T-0042.
- Avant de commencer l'exécution : `pnpm ovrsee:close` sur le plan actif
  actuel (Thème clair round 2), puis capturer ce plan comme nouveau plan actif
  via le flux normal d'approbation.
