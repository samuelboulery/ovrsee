---
{
  "status": "open",
  "title": "Intégration structurelle de la maquette — châssis + Aperçu (chantier 3)",
  "opened": "2026-08-12",
  "closed": null,
  "commits": [
    {
      "sha": "78b9c2b",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "7666c83",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "server/api.js"
      ]
    },
    {
      "sha": "b79fb51",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "e99d1b5",
      "date": "2026-08-12",
      "files": [
        "app/src/ActivityPanel.tsx",
        "app/src/App.tsx",
        "app/src/tabs/Historique.tsx",
        "hooks/couleurs.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "d07b2b5",
      "date": "2026-08-12",
      "files": [
        "app/src/Terminal.tsx",
        "app/src/data.ts"
      ]
    },
    {
      "sha": "4134922",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Sante.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/snapshot.js"
      ]
    },
    {
      "sha": "b92d81e",
      "date": "2026-08-12",
      "files": [
        "app/src/tabs/Branches.tsx"
      ]
    }
  ]
}
---

# Intégration structurelle de la maquette — châssis + Aperçu (chantier 3)

## Contexte

Deux chantiers précédents (T-0074/T-0075/T-0076) ont porté les **couleurs** de
`Ovrsee App.dc.html` dans le code — hex littéraux au lieu de jetons CSS cassés. L'utilisateur
a montré 6 nouvelles captures : malgré les bonnes couleurs, la **structure** ne correspond
toujours pas à la maquette — icônes absentes, éléments manquants, mauvaise disposition,
mauvaise hiérarchie. Sa demande est explicite : « il faut vraiment intégrer les maquettes
telles qu'elles sont... changer la structure, ajouter les nouveaux éléments, supprimer ce
qui n'y est plus » — pas un simple ravalement visuel.

Trois agents d'exploration en lecture seule ont produit un diff structurel précis (maquette
vs code, fichier:ligne des deux côtés) sur les 6 zones pointées par l'utilisateur. Un
quatrième a vérifié quelles données existent déjà côté code pour ne rien réinventer. Quatre
décisions ont été actées avec l'utilisateur via question posée :

1. **Bloc utilisateur** (avatar + nom, bas de sidebar) : nom = **nom d'utilisateur système**
   (lecture seule, `os.userInfo().username`), pas git config.
2. **Sélecteur de projet** (barre de titre) : doit devenir **réellement interactif** — un
   menu déroulant de bascule de projet. Conséquence actée par l'utilisateur : **la section
   "PROJETS" est supprimée de la sidebar**, la bascule de projet ne vit plus qu'en haut.
3. **Bouton "Clore le plan actif"** (liste des plans ouverts) : à ajouter, avec un nouvel
   endpoint qui appelle `closeOpenPlans()` (déjà écrit dans `hooks/plans.js`, aujourd'hui
   seulement exposé en CLI via `pnpm ovrsee:close`).
4. **Densité d'activité** (sidebar) : port complet — segmentation 3 couleurs
   (plans/tickets/commits), toggles de plage, légende, section "Filtrer", section
   "Plans rejetés · N".

## Diffs structurels confirmés (maquette → code actuel)

### A. Barre de titre (`App.tsx:468-500`)
`<h1>Ovrsee — {nom}</h1>` texte brut (ligne 491-497 exacte) → maquette : badge avec pastille
couleur 5×5 + nom (12px/500) + icône `CaretDown` (10px, `#55585f`), doit s'ouvrir en menu
déroulant listant les projets. Réutilise `onPick(path)` déjà défini (`App.tsx:519-522` :
`setCurrent(path)` + `pushUrl(...)`), la liste vient de `fetchProjects()` (`data.ts:588`,
déjà chargée dans le state `projects`, `App.tsx:197-206`). Aucun pattern de dropdown/popover
réutilisable n'existe (`CommandPalette.tsx` est une palette plein écran, pas un menu ancré) —
à construire, petit composant local. Manque aussi : icône `TerminalWindow` (14px, `#b6bac1`)
à droite du badge de scan, bouton 24×24.

### B. Bas de sidebar (`App.tsx:1048-1090`)
Bloc utilisateur entièrement absent avant le bouton Préférences. Maquette : conteneur
`border-top`, avatar carré 20×20 (`radius:5px`, `bg:#1e1f25`) avec initiale, nom (12.5px,
`#b6bac1`), icône `GearSix` (déjà importée ailleurs dans `App.tsx`).

Densité d'activité (`DensityHistogram`/`DensityHeatmap`, `App.tsx:777-885`, alimentés par
`density(commitsDeLaFrise(...))` — `App.tsx:527` → `hooks/density.js` — qui retourne un
`number[]` agrégé, tous types confondus) : la maquette segmente chaque barre en 3 couleurs
(`#7d76f0` plans / `#4b46a3` tickets / `#2a2b33` commits), avec toggles de plage
("14 j"/"12 s"/"type"), légende (3 carrés + labels), une section "Filtrer" (toggle de
visibilité par type), une section "Plans rejetés · N". La ventilation par type existe déjà
partiellement : `Historique.tsx` a un composant `ActivityPanel` (~lignes 144-238) qui
calcule des comptes journaliers par type via une fonction locale — **à lire précisément
avant d'écrire le code** pour juger si elle s'extrait proprement vers un module partagé
(`data.ts` ou `hooks/density.js`) plutôt que d'être dupliquée. "Plans rejetés" se calcule
avec `planRejected(plan)`, déjà dans `data.ts:98-102` (`plans.filter(p => planRejected(p)
!== null)`).

### C. Terminal — panneau "Commandes" (`Terminal.tsx:350-372`)
Boutons texte brut, aucune icône. Maquette : icône Phosphor par commande — "Crawler le
projet"→`Compass`, "Graphe complet"→`GitFork`, "Graphe → Obsidian"→`NotePencil`, "Clore le
plan"→`Checks` (`#7d76f0`, 14px). Les actions viennent de `buildActions()`
(`data.ts:1395-1412`), type `Action` (`data.ts:319-322`) = `{label, text}` sans champ icône.
Mapper l'icône **côté `Terminal.tsx` par le label**, pas en touchant `buildActions()` —
zéro risque de régression sur le type `Action` utilisé ailleurs.

### D. "Plans ouverts" (rendu dans `Sante.tsx`, pas `Apercu.tsx` — à confirmer l'emplacement
exact avant d'éditer)
Lignes texte brut `titre … âge`, sans conteneur, sans pastille, sans badge, sans actions.
Maquette : conteneur bordure+fond, en-tête "Plans ouverts · N" + 2 boutons ("Clore le plan
actif", "Tout voir"), chaque ligne = pastille 5px + titre (`flex:1`, ellipsis) + badge
"actif" (plan actif seulement) + âge en mono, séparateurs `border-bottom` entre lignes sauf
la dernière, fond distinct sur le plan actif. "Tout voir" : pas de destination précisée par
l'utilisateur — pointer vers l'onglet Historique (raisonnable, à confirmer si l'utilisateur
objecte en revue).

### E. Branches (`Branches.tsx:65-90`)
`<table>` HTML 3 colonnes → maquette : liste de "chips" horizontaux (un par branche) —
conteneur flex bordure+fond, icône `GitBranch` (14px) à gauche, nom en mono bold 12px,
upstream en mono 11.5px plus clair, spacer, statut aligné à droite ("à jour" en vert, ou
"N en avance"/"N en retard"), hauteur ~28px, padding `11px 12px`.

### F. Déploiements + README, colonne droite (`Apercu.tsx:229-263`, `Deploiements.tsx:60-202`)
Pas d'en-tête de section fixe (le titre vient du composant lui-même), cartes verticales
(titre+tag / provider / URL / bouton "Vérifier" empilés), 2 boutons distincts en cas vide,
pas de séparateur avant README, section README avec bouton stylé "Afficher/Masquer",
sommaire conditionnel (`plan.length >= 3`) et indentation inégale. Maquette : en-tête fixe
38px "Déploiements" (12px/500) + lien "Configurer" (11.5px, `#62666e`) ; chaque carte =
ligne horizontale (dot statut 7px + 2 lignes de contenu + icône `ArrowUpRight` cliquable
vers l'URL) ; cas vide = **une** ligne pointillée avec icône `Plus` + "Ajouter Netlify,
Railway…" ; séparateur 1px `#17181d` ; en-tête README "README.md" (12px/500) + lien texte
"Afficher" (11.5px, `#62666e`, pas de bouton) ; sommaire toujours visible, libellé "Ce qu'on
y voit", indentation uniforme 12px.

## Approche

Icônes : `@phosphor-icons/react`, déjà utilisé dans le code (`GearSix` notamment) — jamais
les balises `<i class="ph ph-...">` de la maquette statique, qui ne s'appliquent qu'à sa
propre feuille de police d'icônes.

Backend : les deux nouveaux endpoints (nom d'utilisateur, clore le plan actif) passent par
la fonction pure `resolve()` de `server/api.js`, seule implémentation partagée par le dev
server Vite, le protocole `ovrsee://` d'Electron, et le serveur MCP (voir CLAUDE.md du
repo — dédoubler cette logique par hôte est la faute à ne pas commettre). Suivre le pattern
exact des routes déjà présentes dans ce fichier plutôt que d'en inventer un nouveau — à lire
avant d'écrire le code. Le nom d'utilisateur n'est pas un secret (contrairement aux jetons
d'intégration Vercel/Netlify/Supabase) : passer par `/api/*` est acceptable ici. Clore le
plan actif est un appel à `closeOpenPlans()`, déjà utilisé par le hook `ovrsee:close` —
seule la surface de déclenchement change (CLI → bouton UI), la portée d'écriture reste celle
déjà sanctionnée (`ovrsee/.active-plan`).

### Ordre d'implémentation

1. **Sélecteur de projet en dropdown + suppression section PROJETS** (`App.tsx`) — isolé,
   aucune dépendance sur le reste.
2. **Bloc utilisateur + endpoint username** (`App.tsx`, `server/api.js`) — petit, isolé.
3. **Densité d'activité segmentée** (`App.tsx`, potentiellement extraction depuis
   `Historique.tsx`) — le plus gros morceau, à traiter avec soin pour ne pas dupliquer la
   logique de ventilation par type.
4. **Icônes Terminal "Commandes"** (`Terminal.tsx`) — petit, isolé.
5. **Plans ouverts : conteneur + pastilles + badge + bouton clore** (`Sante.tsx`,
   `server/api.js`) — dépend du composant dropdown pour rien, mais réutilise le pattern
   d'appel HTTP posé à l'étape 2.
6. **Branches en chips** (`Branches.tsx`) — isolé, pur rendu.
7. **Déploiements + README, colonne droite** (`Deploiements.tsx`, `Apercu.tsx`) — le plus
   gros après l'étape 3, restructuration de deux fichiers en tandem.

Chaque étape se vérifie indépendamment (typecheck + test + Chrome) avant de passer à la
suivante — pas un seul gros commit à la fin.

## Fichiers critiques

- `app/src/App.tsx` — barre de titre, sidebar (haut et bas), densité d'activité
- `app/src/Terminal.tsx` — panneau Commandes
- `app/src/tabs/Sante.tsx` — liste des plans ouverts
- `app/src/tabs/Branches.tsx` — chips de branches
- `app/src/tabs/Deploiements.tsx`, `app/src/tabs/Apercu.tsx` — colonne droite
- `server/api.js` — deux nouvelles routes (username, clore le plan actif)
- `hooks/plans.js` (`closeOpenPlans()`, déjà écrite), `data.ts` (`planRejected()`,
  `fetchProjects()`, `buildActions()` déjà écrites — à réutiliser, pas dupliquer)
- Référence maquette : `/Users/sam/Downloads/Redesign UI Ovrsee 2/Ovrsee App.dc.html`

## Vérification end-to-end

1. `pnpm typecheck && pnpm test` après chaque étape.
2. `pnpm dev` (:5180) — vérification Chrome de chaque zone contre la maquette et les
   captures fournies par l'utilisateur.
3. `pnpm electron` — les deux nouvelles routes passent par le protocole `ovrsee://`, pas
   seulement par le dev server HTTP (voir piège connu du CLAUDE.md : une route testée
   uniquement dans le navigateur n'est pas testée dans Electron).
4. Vérifier que la suppression de la section "PROJETS" de la sidebar ne casse pas
   `CommandPalette.tsx` (qui a son propre chemin de bascule de projet, indépendant).
