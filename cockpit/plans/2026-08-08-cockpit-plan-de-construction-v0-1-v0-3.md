---
{
  "status": "open",
  "title": "Cockpit — plan de construction (v0.1 → v0.3)",
  "opened": "2026-08-08",
  "closed": null,
  "commits": [
    {
      "sha": "7bfa1f2",
      "date": "2026-08-08",
      "files": [
        "graphify-out/GRAPH_REPORT.md",
        "graphify-out/cache/166e1a0f40e3ac11667a3f07b89c94e8c39f4a6590565f67c34872593978287d.json",
        "graphify-out/cache/305fc246565e559a9aeedd718535830b0d7b1b932ff182dc58da9feaa8eeded9.json",
        "graphify-out/cache/3e406e0c1ed0cb1f0b21be5d84a95b43452437d8d27d82f78495c01e2571a3c9.json",
        "graphify-out/cache/3e93da89097282da8065cd73d9a944be17eeced597b8965cdf21c1936682c536.json",
        "graphify-out/cache/72eb4fae16d7303267ced427bd88ce4821f040f3d5dc186441b79d20422a46c2.json",
        "graphify-out/cache/a130ba36168ab94f49816e0e40074f6105a73e12bf79127e01b7773476061fab.json",
        "graphify-out/cache/a7690432ee19dc363e61be6abdc00e98756d1694761636e742fd8ffbb6f309b6.json",
        "graphify-out/cache/a772e34b74cc9193f5efb2075196a284a57bcbbfcd9999cd1eb881bb237447a0.json",
        "graphify-out/cache/b618ac5800d663c17e15f30322d541d76f57ee3acd0af67dc14d8dcec678a971.json",
        "graphify-out/cache/ef9b43ea75b14f1afc4fc4fdb8af4c9c5b16dcaa72f6386e2c3b843e01a7981b.json",
        "graphify-out/graph.html",
        "graphify-out/graph.json"
      ]
    },
    {
      "sha": "2014e6e",
      "date": "2026-08-08",
      "files": [
        ".gitignore",
        "hooks/cockpit-post-commit.js"
      ]
    },
    {
      "sha": "4ce8ce9",
      "date": "2026-08-08",
      "files": [
        "crawl/index.js",
        "crawl/retention.test.js",
        "crawl/routes.js",
        "crawl/routes.test.js",
        "package.json",
        "pnpm-lock.yaml"
      ]
    },
    {
      "sha": "abee9ee",
      "date": "2026-08-08",
      "files": [
        "app/src/data.ts",
        "crawl/auth.js",
        "crawl/index.js",
        "crawl/routes.js",
        "crawl/routes.test.js",
        "package.json",
        "pnpm-lock.yaml",
        "vite.config.js"
      ]
    },
    {
      "sha": "68bc841",
      "date": "2026-08-08",
      "files": [
        ".gitignore",
        "app/index.html",
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/env.d.ts",
        "app/src/main.tsx",
        "app/src/style.ts",
        "app/src/tabs/Backlog.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Stack.tsx",
        "tsconfig.json",
        "vite.config.js"
      ]
    },
    {
      "sha": "3ca38af",
      "date": "2026-08-08",
      "files": [
        "README.md",
        "package.json"
      ]
    },
    {
      "sha": "a5777a4",
      "date": "2026-08-08",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Produit.tsx",
        "crawl/index.js"
      ]
    },
    {
      "sha": "94886c2",
      "date": "2026-08-08",
      "files": [
        "README.md",
        "cockpit.config.json",
        "hooks/brief.js",
        "hooks/brief.test.js",
        "hooks/cockpit-session-start.js",
        "hooks/install.js",
        "package.json"
      ]
    }
  ]
}
---

# Cockpit — plan de construction (v0.1 → v0.3)

## Contexte

Sam développe en vibecoding avec Claude Code et ne lit plus le code produit. À chaque reprise de projet après quelques semaines, le contexte est à reconstituer intégralement : comment ça marche, ce qu'il restait à faire, pourquoi tel choix. Le raisonnement derrière chaque décision n'existe que dans un fil de conversation qui disparaît — coût irréversible.

Cockpit répond à ça : une vue en lecture seule sur un projet, alimentée par des fichiers markdown et des images versionnés dans le repo. Le cadrage complet est dans `cadrage-cockpit.md`. Trois principes gouvernent tout :

1. **Le cockpit lit, il n'exécute jamais.** La vérité vit dans `/cockpit/` du repo. L'app est une vue jetable.
2. **Rien ne s'écrit à la main.** Un fichier maintenu manuellement est faux en trois semaines.
3. **On capture large, on filtre à la lecture.** Ce qui n'est pas capturé est perdu pour toujours ; un filtre trop généreux se corrige n'importe quand.

**Périmètre de ce plan :** v0.1 (capture) → v0.2 (crawl) → v0.3 (interface). Le multi-projets complet (v1) et la coquille Tauri avec terminal fonctionnel (v1.1) sont hors périmètre.

**Décisions actées en amont de ce plan :**
- Dogfooding : Cockpit capture ses propres plans dès le premier commit.
- Crawl : Playwright.
- Interface : port de `Cockpit-A-Nocturne.dc.html` en Vite + React, markup et styles inline copiés à l'identique.
- Terminal : panneau porté visuellement, non fonctionnel en v0.3 (les boutons d'injection copient dans le presse-papier).

---

## Ce qui existe déjà, et qu'on réutilise tel quel

| Actif | Emplacement | Usage |
|---|---|---|
| Maquette de référence | `Cockpit-A-Nocturne.dc.html` (625 l.) | Source de vérité de l'interface. Chaque bloc est porté verbatim. |
| Design system Nocturne | `_ds/nocturne-16d90168-…/styles.css` | Importé sans modification. Tous les tokens (`--color-accent-*`, `--font-heading`…) viennent de là. |
| Graphify | `~/.local/bin/graphify` (installé) | `graphify hook install` + lecture de `graphify-out/graph.json`. Alimente les onglets **Données** et **Stack**. Étiquettes `EXTRACTED`/`INFERRED`/`AMBIGUOUS` déjà rendues par la maquette. |
| Contrat de hooks | `~/code/claude-config/claude/hooks/` (symlink `~/.claude/hooks`) | Scripts Node, JSON sur stdin, sortie sur stdout, exit 2 = blocage. `pnpm-guard.js` sert de modèle. |
| Plans de plan-mode | `~/.claude/plans/*.md` | Source à copier vers `<repo>/cockpit/plans/`. |

`support.js` (dc-runtime) n'est **pas** repris : c'est un artefact généré dont les sources (`dc-runtime/src/*.ts`) sont absentes du dépôt. La maquette reste le référentiel visuel, pas le runtime de production.

---

## Modèle de fichiers `/cockpit/`

```
<repo>/cockpit/
  plans/
    2026-08-08-notes-libres-fiche-plante.md   # 1 fichier = 1 plan approuvé
  pages/
    pages.json                                 # pages + liens + résumés + dernier scan
    scans.jsonl                                # 1 ligne par scan, succès ET échec
    shots/<page-slug>/2026-08-08-d2f1a3.png
  .active-plan                                 # pointeur vers le plan en cours
```

**Format d'un plan** — frontmatter YAML + corps markdown repris du fichier de plan-mode :

```yaml
---
status: open            # open | closed
opened: 2026-08-08
closed: null
title: Notes libres sur la fiche plante
commits: []             # [{sha, date, files: [...]}]
---
## Intention
## Alternatives écartées
## Fichiers touchés
```

**Tout le reste se calcule, rien ne se stocke** — conformément au cadrage §4 : backlog = plans `open` ; historique = plans `closed` triés ; plans d'une page = plans clos dont `commits[].files` recoupent les fichiers de la page ; densité d'activité = commits par semaine.

---

## Lot 0 — Squelette du dépôt

Un seul paquet, pas de monorepo.

```
cockpit/
  package.json          # packageManager: pnpm@10.12.1
  cockpit.config.json   # config de crawl du projet courant
  hooks/                # scripts Node de capture (v0.1)
  crawl/                # script Playwright (v0.2)
  app/                  # Vite + React (v0.3)
  _ds/                  # inchangé
  Cockpit-A-Nocturne.dc.html  # conservé comme référence visuelle
```

`git init` + premier commit + `graphify hook install` + `graphify claude install`.

> **Action destructive à confirmer avant exécution :** aucune. `git init` sur un dossier non versionné n'écrase rien. Les fichiers existants (`_ds/`, la maquette, `support.js`) sont conservés en l'état.

---

## Lot 1 — v0.1 : la capture (aucune interface)

C'est le seul contenu périssable : chaque semaine sans lui est définitivement perdue.

### 1.1 Hook d'ouverture de plan
`hooks/cockpit-capture-plan.js` — **PostToolUse**, matcher `ExitPlanMode`.

- Lit le JSON sur stdin, récupère le chemin du fichier de plan (`~/.claude/plans/<slug>.md`) et le contenu.
- Détermine le repo via `git rev-parse --show-toplevel` depuis `cwd`. Pas de repo → sortie silencieuse, exit 0.
- Écrit `<repo>/cockpit/plans/<date>-<slug>.md` avec `status: open`.
- Écrit `<repo>/cockpit/.active-plan`.
- Ajoute le repo à `~/.claude/cockpit/projects.json` (chemin + nom) — alimente la sidebar sans travail supplémentaire.
- Contrat repris de `pnpm-guard.js` : exit 0 toujours, jamais bloquant. Un échec de capture ne doit jamais casser une session.

### 1.2 Hook de commit
`hooks/cockpit-post-commit.js` — installé comme `.git/hooks/post-commit` (à côté de celui de Graphify).

- Lit `.active-plan`, ajoute au plan `{sha, date, files: git diff --name-only HEAD~1 HEAD}`.
- **Granularité (question laissée ouverte par le cadrage §7) :** le plan reste `open` tant qu'un nouveau plan n'est pas approuvé. L'approbation du suivant clôt le précédent (`status: closed`, `closed: <date du dernier commit>`). Un plan = une intention, pas un commit.
  Marqué `// ponytail: fermeture par plan suivant ; si les plans s'empilent, basculer sur une fermeture explicite via /cockpit close`.
- Déclenche le crawl (lot 2) **en arrière-plan, détaché** — un hook post-commit ne doit jamais faire attendre un commit.

### 1.3 Skill `/cockpit`
`~/.claude/skills/cockpit/SKILL.md` — format frontmatter standard (`name`, `description`), même structure que `~/.claude/skills/api-design/SKILL.md`.
Commandes de secours quand les hooks n'ont pas tourné : `/cockpit capture` (capture le plan courant), `/cockpit close` (clôt le plan actif), `/cockpit status`.

### Critère de succès (celui du cadrage)
Ouvrir une session Claude Code, lui **interdire de lire le code**, ne lui donner que `/cockpit/`, demander un brief du projet. Si le brief est utilisable, c'est validé.

### Agents et modèles

| Agent | Modèle | Pourquoi ce modèle |
|---|---|---|
| `architect` | **opus** | Arbitre le schéma de `/cockpit/` et la règle de clôture des plans. Décision structurante, irréversible une fois des données accumulées. |
| `tdd-guide` | **sonnet** | Tests d'abord sur le parseur de frontmatter et la dérivation backlog/historique — c'est le cœur logique, tout le reste en dépend. |
| `general-purpose` | **sonnet** | Écriture des deux hooks Node. Manipulation de git et de chemins, pas mécanique. |
| `security-reviewer` | **sonnet** | Obligatoire : ces scripts s'exécutent automatiquement à chaque commit et écrivent sur disque. Vérifier l'absence d'injection de commande via nom de branche ou de fichier, et la résistance aux symlinks (cf. `safeWriteFlag()` de `caveman-activate.js`). |
| `code-reviewer` | **sonnet** | Revue de fin de lot. |

---

## Lot 2 — v0.2 : le crawl (aucune interface)

Le crawl tourne **au commit, jamais à la reprise** : au moment où Sam revient sur un projet, c'est précisément le moment où l'app ne démarre plus.

### 2.1 Configuration par projet
`cockpit.config.json` à la racine du repo cible :

```json
{
  "dev": "pnpm dev",
  "baseUrl": "http://localhost:5173",
  "readyTimeoutMs": 60000,
  "entryRoutes": ["/", "/login"],
  "auth": { "storageState": ".cockpit-auth.json" },
  "ignore": ["/api/*"]
}
```

`.cockpit-auth.json` est **gitignoré** — il contient des cookies de session. Le `.gitignore` doit l'exclure avant le premier crawl authentifié, jamais après.

### 2.2 Script de crawl
`crawl/index.js` (Playwright, Chromium headless) :

1. Démarre `dev`, attend que `baseUrl` réponde. Timeout → échec propre.
2. Parcourt depuis `entryRoutes`, découvre les liens par les `<a href>` internes, normalise les routes dynamiques (`/plante/42` → `/plante/:id`) par regroupement de segments variables.
3. Par page : capture PNG dans `shots/<slug>/<date>-<sha>.png`, titre, liens sortants.
4. Écrit `pages/pages.json` et **ajoute une ligne à `pages/scans.jsonl` dans tous les cas** — un scan échoué s'écrit `{"date":…,"commit":…,"ok":false,"error":…}`. Jamais de conservation silencieuse de la capture précédente.
5. Résumé d'une ligne par page : généré par Claude à partir du titre + du texte visible, régénéré à chaque commit. La dérive sémantique reste le risque grave assumé du cadrage §8.

**Rétention (question ouverte du cadrage) :** toutes les captures conservées au-delà de 30 jours, puis une par semaine. Décidé maintenant, avant l'accumulation, parce que c'est irrattrapable ensuite.

### 2.3 Sortie de contrôle
Un HTML statique brut (`crawl/report.html`) listant pages + dernière capture. Sert à valider le lot sans attendre l'interface.

### Critère de succès
Ça passe sur le projet le plus tordu du dossier `~/code/` — authentification et routes dynamiques comprises.

### Agents et modèles

| Agent | Modèle | Pourquoi ce modèle |
|---|---|---|
| `e2e-runner` | **sonnet** | Pilotage Playwright : attente de démarrage, `storageState`, routes dynamiques. C'est exactement son domaine. |
| `general-purpose` | **sonnet** | Normalisation des routes et graphe de navigation — l'heuristique de regroupement est la partie subtile. |
| `security-reviewer` | **sonnet** | Le crawl manipule des cookies de session réels. Vérifier : `.cockpit-auth.json` gitignoré, aucun secret dans `pages.json`, aucune capture d'écran d'une page affichant un token. |
| `build-error-resolver` | **haiku** | Résolution des erreurs d'installation Playwright / navigateurs. Tâche mécanique. |
| `code-reviewer` | **sonnet** | Revue de fin de lot. |

---

## Lot 3 — v0.3 : l'interface (port de la maquette A)

Traduction **mécanique** de `Cockpit-A-Nocturne.dc.html`. Les styles inline sont copiés caractère pour caractère : le rendu doit être indiscernable de la maquette.

### 3.1 Table de correspondance du port

| Maquette (dc-runtime) | Port React |
|---|---|
| `<sc-for list="{{ xs }}" as="x">` | `{xs.map(x => …)}` |
| `<sc-if value="{{ c }}">` | `{c && …}` |
| `{{ expr }}` dans un attribut `style` | `style={expr}` (chaîne → objet via un helper `s()` unique) |
| `class DCLogic { state; renderVals() }` | `useState` + valeurs dérivées calculées dans le composant |
| `onClick="{{ pick.fiche }}"` | `onClick={() => pick('fiche')}` |
| `<helmet><link rel=stylesheet …>` | `import '../_ds/nocturne-…/styles.css'` |

Les chaînes de style inline restent des **chaînes**, converties par un helper `s(str)` unique — pas de réécriture en objets JSX, pas de CSS modules. C'est la traduction la plus courte et celle qui garantit le rendu identique.

### 3.2 Structure des composants (calquée sur la maquette)

| Fichier | Bloc de la maquette |
|---|---|
| `app/src/Shell.tsx` | l. 26–43 chrome de fenêtre + `dernier scan · …` |
| `app/src/Sidebar.tsx` | l. 45–71 liste projets + densité d'activité |
| `app/src/Tabs.tsx` | l. 75–79 + `tabDef` l. 431–446 |
| `app/src/tabs/Produit.tsx` | l. 85–274 graphe SVG + cartes de page + rail de détail |
| `app/src/tabs/Historique.tsx` | l. 276–304 |
| `app/src/tabs/Backlog.tsx` | l. 306–328 |
| `app/src/tabs/Donnees.tsx` | l. 330–351 |
| `app/src/tabs/Stack.tsx` | l. 353–369 |
| `app/src/Terminal.tsx` | l. 374–418 — panneau + 3 dispositions, non fonctionnel |
| `app/src/data.ts` | remplace `renderVals()` : charge les JSON, dérive backlog/historique/densité |

### 3.3 Le graphe de navigation
La maquette place les 7 nœuds en coordonnées absolues et trace les arêtes en `<path>` manuels (l. 100–208). Le port calcule ces positions : disposition en couches par distance depuis la page d'entrée, colonnes de 175px, arêtes en L orthogonales — la géométrie exacte de la maquette. Les deux styles d'arêtes (pleine accent = lien direct, pointillée grise = retour) sont conservés, ainsi que le halo sur la page d'entrée et l'état `scan échoué`.

C'est le seul morceau non mécanique du lot.

### 3.4 Lecture des données
- `plans/*.md` → parseur du lot 1, réutilisé tel quel.
- `pages/pages.json` + `scans.jsonl` → onglet Produit.
- `graphify-out/graph.json` → onglets Données et Stack. Le cockpit ne recalcule rien ; le badge « lu depuis Graphify » de la maquette (l. 334) reste vrai.
- Sidebar : `~/.claude/cockpit/projects.json` écrit par le hook du lot 1.

Servi par le dev server Vite en v0.3, avec les répertoires `/cockpit/` du projet courant montés en statique. Pas de backend.

### Critère de succès (le seul qui compte, cadrage §7)
Sam l'ouvre-t-il spontanément en revenant sur un projet, ou retourne-t-il au terminal par réflexe ?

### Agents et modèles

| Agent | Modèle | Pourquoi ce modèle |
|---|---|---|
| `caveman:cavecrew-builder` ×5, en parallèle | **haiku** | Un agent par onglet Historique / Backlog / Données / Stack / Terminal. Traduction 1:1 balise par balise, portée bornée à 1–2 fichiers : exactement le régime où haiku suffit et où le parallélisme paye. |
| `general-purpose` | **sonnet** | Onglet Produit : c'est le seul avec de la logique (disposition du graphe, arêtes, rail de détail, sélection). |
| `general-purpose` | **sonnet** | `data.ts` — chargement et dérivations. |
| `typescript-reviewer` | **sonnet** | Revue TS du port : typage des données chargées, absence de `any` sur les JSON externes. |
| `build-error-resolver` | **haiku** | Build Vite vert. Mécanique. |
| `code-reviewer` | **sonnet** | Revue de fin de lot. |
| Comparaison visuelle | **opus** | Capture du port et de la maquette côte à côte, lecture des deux images, liste des écarts. Tâche de perception fine — c'est là que le modèle le plus fort rend le plus. |

---

## Récapitulatif de l'affectation des modèles

| Modèle | Employé pour |
|---|---|
| **opus** | Décisions structurantes irréversibles (schéma `/cockpit/`, règle de clôture des plans) et comparaison visuelle maquette/port. |
| **sonnet** | Tout le développement : hooks, crawl, onglet Produit, revues de code et de sécurité. |
| **haiku** | Traduction mécanique bornée (4 onglets + terminal, en parallèle), résolution d'erreurs de build, mise à jour de documentation. |

Règle appliquée : le modèle monte avec le coût d'une erreur, pas avec la taille de la tâche. Un port d'onglet raté se refait en cinq minutes ; un schéma de fichiers raté se paie après trois mois de données accumulées.

---

## Vérification de bout en bout

**Lot 1 — capture**
```bash
# dans le repo cockpit lui-même
cd ~/code/cockpit
# approuver un plan dans une session Claude Code, puis :
ls cockpit/plans/                       # 1 fichier, status: open
cat cockpit/.active-plan
git commit -m "test: capture"
grep -A3 'commits:' cockpit/plans/*.md  # sha et fichiers présents
```
Puis le test réel : session Claude Code, `/cockpit/` comme seule source, demander un brief. Vérifier qu'il est utilisable sans lire une ligne de code.

**Lot 2 — crawl**
```bash
node crawl/index.js --config cockpit.config.json
ls cockpit/pages/shots/*/               # PNG datés
tail -1 cockpit/pages/scans.jsonl       # ligne du scan, ok true/false
open crawl/report.html
```
Puis rejouer sur un projet à authentification et routes dynamiques (`~/code/associa` ou `~/code/humankindr-platform`). Et **tester le chemin d'échec** : couper le dev server, relancer, vérifier qu'une ligne `ok:false` s'écrit et qu'aucune capture périmée n'est présentée comme fraîche.

**Lot 3 — interface**
```bash
pnpm --filter app dev
```
- Les cinq onglets se remplissent depuis les vraies données du repo cockpit.
- Comparaison visuelle : ouvrir `Cockpit-A-Nocturne.dc.html` et le port côte à côte à 1320×860, capturer les deux, lister les écarts.
- Une page dont le dernier scan a échoué affiche bien le bloc `scan échoué`.
- Les trois dispositions du terminal (Bas / Côté / Plein) reproduisent les styles de `terminalStyle` (l. 588–592).

**Transverse — sécurité, avant chaque commit**
`.cockpit-auth.json` gitignoré ; aucun token dans `pages.json` ni sur une capture ; les hooks sortent en exit 0 même en échec ; aucune interpolation de nom de fichier ou de branche dans une commande shell.

---

## Ce que ce plan ne fait pas

- **Multi-projets complet (v1)** — le registre est alimenté dès le lot 1, mais le basculement entre projets et le hook `SessionStart` de réinjection arrivent après.
- **Coquille Tauri + terminal pty (v1.1)** — dernière brique, volontairement : c'est la seule qui ne produit aucune donnée, et c'est le piège identifié au cadrage §8.
- **Captures des états d'écran** (modale, erreur, liste vide) — reporté en v2 par le cadrage.
