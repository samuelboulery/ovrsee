---
{
  "status": "closed",
  "title": "Plan directeur — Cockpit v1.0 : personnalisation, onboarding, ouverture",
  "opened": "2026-08-09",
  "closed": "2026-08-09",
  "commits": [
    {
      "sha": "0efa562",
      "date": "2026-08-09",
      "files": [
        "app/src/App.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/data.ts",
        "hooks/settings.js",
        "hooks/settings.test.js",
        "hooks/snapshot.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "98a21cb",
      "date": "2026-08-09",
      "files": [
        "cadrage-cockpit.md",
        "mcp/dispatch.js",
        "mcp/mcp.test.js",
        "mcp/server.js",
        "package.json"
      ]
    },
    {
      "sha": "62b84d7",
      "date": "2026-08-09",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/tabs/Donnees.tsx",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js"
      ]
    },
    {
      "sha": "5303e6f",
      "date": "2026-08-09",
      "files": [
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Tableau.tsx",
        "hooks/cockpit-cli.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js",
        "skills/cockpit-tickets/SKILL.md"
      ]
    },
    {
      "sha": "fae0ead",
      "date": "2026-08-09",
      "files": [
        "app/src/data.ts",
        "hooks/density.d.ts",
        "hooks/density.js",
        "hooks/density.test.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "mcp/dispatch.js"
      ]
    },
    {
      "sha": "66547a2",
      "date": "2026-08-09",
      "files": [
        "app/src/ConfigClaudeModal.tsx",
        "app/src/data.ts",
        "hooks/config-claude.js",
        "hooks/config-claude.test.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "4ab00fd",
      "date": "2026-08-09",
      "files": [
        "app/src/data.ts",
        "app/src/useResizable.tsx",
        "hooks/detect-package-manager.js",
        "hooks/detect-package-manager.test.js",
        "hooks/settings.js",
        "hooks/settings.test.js"
      ]
    },
    {
      "sha": "24c3123",
      "date": "2026-08-09",
      "files": [
        "app/src/App.tsx",
        "app/src/Lightbox.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/SkillsPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/main.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/theme.test.ts",
        "app/src/theme.ts",
        "app/src/useTerminal.ts",
        "hooks/couleurs.test.js"
      ]
    },
    {
      "sha": "ff4d651",
      "date": "2026-08-09",
      "files": []
    },
    {
      "sha": "1b173b1",
      "date": "2026-08-09",
      "files": [
        "app/src/i18n.test.ts",
        "app/src/i18n.ts",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/i18n.test.js"
      ]
    },
    {
      "sha": "566a1b1",
      "date": "2026-08-09",
      "files": [
        "app/src/App.tsx",
        "app/src/ConfigClaudeModal.tsx",
        "app/src/EquipmentPanel.tsx",
        "app/src/Garde.tsx",
        "app/src/Lightbox.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/SkillsPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/Welcome.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Stack.tsx",
        "app/src/tabs/Tableau.tsx",
        "electron/main.js",
        "electron/menu.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "c197900",
      "date": "2026-08-09",
      "files": [
        "CLAUDE.md",
        "README.en.md",
        "README.md",
        "hooks/documentation.test.js"
      ]
    },
    {
      "sha": "1891614",
      "date": "2026-08-09",
      "files": []
    },
    {
      "sha": "1685d97",
      "date": "2026-08-09",
      "files": []
    },
    {
      "sha": "d95b53b",
      "date": "2026-08-09",
      "files": []
    }
  ]
}
---

# Plan directeur — Cockpit v1.0 : personnalisation, onboarding, ouverture

## Contexte

Cockpit 0.9.0-beta marche pour son auteur. Dix demandes viennent d'arriver, et
elles disent toutes la même chose : **l'application n'est utilisable que par
celui qui l'a écrite.** Densité figée à 16 semaines, textes français en dur,
thème sombre unique, onglets non désactivables, boutons d'injection opaques,
écran d'initialisation qui coche des skills sans expliquer à quoi ils servent,
et aucun moyen de s'en servir hors du terminal intégré.

Le dernier plan clos (« Skills installables + coffre Obsidian ») avait déjà
nommé le problème : *« deux manques apparaissent dès qu'on donne Cockpit à
quelqu'un d'autre »*. Ce lot-ci est la suite — passer d'un outil personnel à un
outil qu'on installe.

S'y ajoute un manque du ticketing lui-même : seize tickets à plat, sans moyen de
dire lesquels servent le même objectif. D'où l'epic.

Ce fichier n'est **pas** un plan d'exécution. C'est le découpage : douze
chantiers, un agent par chantier, chacun produisant son propre plan détaillé à
valider. Il fixe ce que les agents n'ont pas le droit de réarbitrer.

## Arbitrages verrouillés (validés)

| Question | Décision |
|---|---|
| Serveur MCP | **Oui** — lecture complète + écriture de tickets. Le cadrage §3 est amendé : l'écart visait le mono-projet, pas l'usage depuis Claude Desktop. Aucune exécution : ni crawl, ni install, ni graphe. |
| Explorateur de fichiers | **Abandonné.** Hors périmètre — cadrage §8, « l'élargissement du périmètre ». |
| Préférences | **`~/.claude/cockpit/settings.json`** (profil global, à côté de `projects.json` déjà existant) **+ surcharge par `cockpit.config.json`** du dépôt observé. |
| Rythme | **Trois vagues.** Chaque vague : plans → validation → exécution → vague suivante. |

## Contraintes que chaque agent hérite

Non négociables, à répéter dans chaque brief :

1. **L'invariant.** Le cockpit lit ; il n'écrit que `cockpit/tickets/*.md`,
   `cockpit/board.json`, et désormais `~/.claude/cockpit/settings.json`. Il
   n'exécute jamais de code du projet observé.
2. **Une seule implémentation d'API.** Toute route nouvelle passe par
   `resolve()` de `server/api.js:178` — jamais dupliquée entre le middleware
   Vite et le protocole `cockpit://`. Et **une route testée dans le navigateur
   n'est pas une route testée dans Electron** : vérifier les deux.
3. **Pas de dépendance nouvelle sans demander.** Le projet en a trois en prod.
   Pas de i18next, pas de framework de test, pas de librairie de graphique.
4. **Tests dans le style existant** : `node:test` + `node:assert/strict`, noms
   en français, cas dégradés (`app/src/render.test.tsx`), tmpdir + variables
   d'environnement pour l'isolation (`COCKPIT_REGISTRY`, `COCKPIT_SKILLS_DIR`).
5. **Styles via `s()`** sur les jetons Nocturne. Aucun fichier `.css` dans
   `app/src`.
6. **Toute fonction pure dérivée des plans va dans `hooks/plans.js`** si le
   MCP et le CLI en ont besoin, sinon dans `app/src/data.ts`. `density()`
   existe **déjà en double** (`hooks/plans.js:170` et `app/src/data.ts:622`) —
   ne pas aggraver.

---

## Vague 1 — le socle (4 agents, parallèles)

Ces quatre-là ne se marchent pas dessus : un module et une route, un dossier
neuf, `hooks/snapshot.js` + l'onglet Données, `hooks/tickets.js` + l'onglet
Tableau. Une seule dépendance interne : **A2 doit attendre le schéma d'A4**
pour exposer les epics — A4 livre son format en premier, A2 le consomme.

### A1 — Profil et préférences

**Pourquoi en premier :** quatre chantiers ultérieurs ont besoin d'un endroit où
persister un choix. Sans ce socle, chacun inventerait le sien.

- `hooks/settings.js` : lecture/écriture de `~/.claude/cockpit/settings.json`,
  valeurs par défaut, fusion avec `cockpit.config.json` du projet ouvert.
  Modèle : `readRegistry()` / `registerProject()` de `hooks/plans.js:274-341`.
- Route `GET`/`POST /api/settings` dans `resolve()`, protégée par l'en-tête
  `x-cockpit: 1` comme les POST existants.
- Schéma initial (les chantiers suivants n'ajoutent que des champs) :
  `langue`, `theme`, `onglets` (ordre + actifs), `panneaux` (disposition
  terminal), `packageManager`, `bootstrap` (commandes à envoyer à la session
  Claude quand on initialise un projet neuf), `sourceGraphe`.
- Un écran/modale « Préférences » accessible depuis la barre latérale, à côté
  du bouton « Skills Claude Code » (`App.tsx:669`). Les autres agents y
  branchent leurs sections.
- Validation stricte à la lecture : un `settings.json` corrompu doit donner les
  valeurs par défaut, jamais vider l'application (leçon du 9 août, `liste()`
  dans `data.ts:22`).

**Livrables :** `hooks/settings.js` + `hooks/settings.test.js`, route,
`app/src/Preferences.tsx`, tests de résolution.

### A2 — Serveur MCP

**Périmètre :** lecture complète, plus la création/déplacement de tickets.
Aucune exécution.

- Nouveau dossier `mcp/`, serveur stdio, sans dépendance nouvelle si faisable
  à la main (le protocole MCP est du JSON-RPC sur stdio) — sinon **demander**
  avant d'ajouter `@modelcontextprotocol/sdk`.
- Outils exposés, tous adossés aux fonctions déjà écrites :
  `snapshot(root)` (`hooks/snapshot.js`), `briefLines`, `tableau(root)` et les
  mutations de `hooks/tickets.js:123-169`, `plansOuverts`, `timeline`.
- **Le multi-projets passe par le registre** `~/.claude/cockpit/projects.json` :
  un outil `projets` liste, les autres prennent un chemin, validé contre le
  registre exactement comme `api.js:60-70` — un chemin arbitraire est refusé.
- Documenter l'entrée dans `claude_desktop_config.json` (README, vague 3).
- Amender `cadrage-cockpit.md` §3 : déplacer « Serveur MCP » hors du tableau
  des écarts, avec la raison du revirement.

**Livrables :** `mcp/server.js`, `mcp/*.test.js`, entrée `pnpm cockpit:mcp`,
amendement du cadrage.

### A3 — Sources de graphe (Graphify, Obsidian, et le reste)

Aujourd'hui : Graphify gagne toujours, Obsidian n'est lu que par défaut de
Graphify (`hooks/snapshot.js:236-247`). Tu veux que ce soit **un choix**.

- Rendre la source explicite : `sourceGraphe: 'auto' | 'graphify' | 'obsidian'`
  dans les préférences (A1) ou `cockpit.config.json`. `auto` garde la règle
  actuelle. Un choix explicite qui ne trouve rien le **dit** au lieu de se
  rabattre en silence.
- L'onglet Données affiche d'où vient ce qu'il montre et à quelle date
  (`graphSource` existe déjà dans le snapshot).
- **Enquête, avec livrable écrit :** quelles autres sources méritent d'entrer ?
  Candidats à évaluer sur un seul critère — *produisent-ils un graphe dérivé du
  code, reconstruit automatiquement ?* : `dependency-cruiser`, `madge`,
  `ts-morph`, les ADR au format `adr-tools`, les `WHY:` déjà lus par
  `hooks/whys.js`. Rapport court : ce qu'on branche, ce qu'on écarte, pourquoi.
  **Ne rien implémenter au-delà de Graphify + Obsidian sans validation.**
- Étendre la lecture de coffre (`hooks/vault.js`) si l'enquête le justifie —
  aujourd'hui une note n'est une table que par `type: table`, ce qui est étroit
  et volontaire.

### A4 — Epics dans le ticketing

Seize tickets à plat, aucun moyen de dire que quatre d'entre eux servent le même
objectif. Ce lot de douze chantiers en est lui-même la démonstration.

**Forme retenue — un epic est un ticket.** Pas de nouveau dossier, pas de
nouveau format, pas de second stock à tenir cohérent :

- Le frontmatter gagne deux champs optionnels : `type: 'epic'` sur l'epic
  lui-même (absent = ticket ordinaire), et `epic: 'T-0042'` sur ses enfants.
- Fichiers dans `cockpit/tickets/`, mêmes identifiants, même allocateur
  (`nextTicketId`), même lecture (`readTickets`), mêmes mutations
  (`createTicket`, `moveTicket`, `updateTicket`). Le gros de `hooks/tickets.js`
  ne bouge pas.
- Un epic a une colonne comme les autres — il avance sur le tableau. Sa
  progression se **calcule** (enfants dans la colonne terminale / total),
  jamais ne se saisit : même règle que le backlog et l'historique, qui se
  dérivent au lieu de se stocker (cadrage §4).

**Règles à trancher explicitement, et à écrire :**

- **Le compte des tickets restants** (`restant()`, `data.ts:608`, miroir dans
  `hooks/tickets.js:451`) ne doit pas compter l'epic *et* ses enfants — la
  pastille de la barre latérale doublerait. Décision par défaut : les epics
  sont exclus du compte.
- **Pas d'epic dans un epic.** Un enfant qui pointe un epic inexistant, ou une
  boucle, se lit comme un ticket ordinaire orphelin — et l'interface le dit.
  Un ticket corrompu ne doit jamais vider l'écran (T-0007, `liste()`).
- **Supprimer un epic n'efface pas ses enfants** : ils redeviennent libres.
  Une suppression en cascade détruirait du travail sur un mauvais clic.

**Interface** (`app/src/tabs/Tableau.tsx`, 779 l.) :

- Une carte d'epic se distingue : son titre, sa progression, le nombre
  d'enfants. Les enfants portent une pastille renvoyant à leur epic.
- Filtrer le tableau par epic — c'est l'usage principal, et le moins coûteux à
  écrire.
- Rattacher/détacher depuis la carte d'un ticket.
- La vue reste un kanban. **Pas de seconde vue « roadmap » ni de Gantt** : c'est
  un outil de reprise en main, pas un gestionnaire de portefeuille.

**Le reste de la boucle :**

- `skills/cockpit-tickets/SKILL.md` : apprendre à Claude Code quand créer un
  epic plutôt qu'un ticket, et comment rattacher. Sans ça, la boucle « je
  décris une tâche → un ticket apparaît » ignorera l'epic — c'est exactement le
  manque relevé le 9 août sur les skills non installés.
- `hooks/cockpit-cli.js` : `ticket new --epic`, et l'affichage groupé dans
  `status`.
- `importOpenPlans()` (`hooks/tickets.js:482`) : un plan qui engendre plusieurs
  tickets est un candidat naturel à l'epic. À évaluer, pas forcément à faire.
- `buildInjections()` (`data.ts:854`) : le bloc « Tableau » injecté dans la
  session doit montrer la hiérarchie, sinon Claude proposera des tickets
  orphelins.
- **A2 (MCP) expose les epics** — d'où l'ordre : A4 fige le schéma d'abord.

**Migration :** aucune. Un ticket sans `type` ni `epic` est un ticket ordinaire,
et les seize existants le restent. Rien à réécrire sur le disque.

---

## Vague 2 — l'interface (4 agents)

Trois d'entre eux touchent `App.tsx`. **Chacun travaille dans son propre
worktree git** (`superpowers:using-git-worktrees`), intégration séquentielle
dans l'ordre B1 → B2 → B3 → B4.

### B1 — Densité d'activité paramétrable + heatmap

Aujourd'hui : `density(plans, weeks=16)` (`data.ts:622`), sparkline 16 barres
dans la barre latérale (`App.tsx:680-718`), granularité codée en dur, libellé
« 16 semaines » écrit en clair.

- Généraliser en `density(plans, { granularite, fenetre, now })` avec
  `granularite ∈ jour | semaine | mois` et fenêtres *jour / semaine / mois /
  3 mois / an*. **Corriger la duplication** avec `hooks/plans.js:170` en même
  temps — une seule implémentation, importée des deux côtés.
- Bug à ne pas reconduire : le seau se calcule en `Math.floor(delta / WEEK_MS)`
  depuis `now`, donc les seaux glissent avec l'heure de la journée. Passer à des
  bornes de calendrier (jour local, lundi, 1er du mois).
- Un sélecteur discret dans l'en-tête du bloc (une puce cliquable qui cycle, ou
  un petit menu). Choix persisté via A1.
- **Heatmap façon GitHub** pour les fenêtres longues : grille semaines × jours,
  5 paliers de couleur sur la rampe accent Nocturne
  (`--color-accent-900` → `--color-accent-500`), `title` par case. Les
  fenêtres courtes gardent l'histogramme. Charger la skill `dataviz` avant
  d'écrire le rendu.
- **Source des données :** aujourd'hui `density` ne compte que les commits
  *rattachés à un plan*. La frise (`hooks/timeline.js`) connaît aussi les
  commits hors plan. Trancher et le dire — une densité qui ignore la moitié des
  commits ment.
- Accessibilité : la grille doit être lisible au lecteur d'écran (ticket
  T-0015 ouvert sur ce sujet).

### B2 — Thèmes et personnalisation de l'interface

- **Thèmes.** Les jetons Nocturne sont des variables CSS au `:root`
  (`_ds/nocturne-*/styles.css`). Ajouter `[data-theme="light"]` et un jeu
  alternatif, basculés par `document.documentElement.dataset.theme`.
  `Navigateur.tsx:84` lit déjà cet attribut — le sol est prêt. Option
  « système » via `prefers-color-scheme`. **Ne pas éditer `_ds/` en place** :
  c'est une bibliothèque tierce, écrire un fichier de surcharge.
- **Onglets.** `TABS` (`App.tsx:46`) devient une liste ordonnable et
  désactivable depuis les préférences. Un onglet masqué ne doit pas casser sa
  route : `/donnees` masqué doit rediriger vers Aperçu, pas donner un écran
  vide. Garder au moins un onglet actif.
- **Panneaux.** La disposition du terminal (`bottom | side | full`,
  `Terminal.tsx:8`) et les largeurs de `useResizable` deviennent des
  préférences persistées au lieu d'un état de session.
- **Gestionnaire de paquets.** `packageManager` dans les préférences, utilisé
  pour composer les commandes injectées (`pnpm cockpit:crawl` →
  `npm run cockpit:crawl`, etc.) et par le bootstrap de la vague 3. Détecter
  par défaut depuis le lockfile du projet observé, sans écraser un choix
  explicite.

### B3 — Boutons d'action : dire ce qu'ils font, et laisser en ajouter

Aujourd'hui trois actions en dur (`Terminal.tsx:121-131`) et quatre injections
de contexte (`data.ts:854-888`), sans explication de ce qui part dans la session.

- Chaque bouton porte une **prévisualisation** de ce qu'il va écrire (survol ou
  dépliage) — aujourd'hui « Carte des pages (7) » n'annonce ni le volume ni la
  forme du texte injecté.
- Regrouper explicitement en deux familles : *envoyer une commande* (préfixe
  `!` ou `/`, ne marche que dans une session Claude) et *envoyer du contexte*
  (du texte). Le plafond est déjà documenté dans le commentaire `ponytail:` de
  `Terminal.tsx:113` — le rendre visible à l'écran.
- Actions définissables par l'utilisateur dans les préférences (libellé +
  texte), en plus des trois livrées. Les commandes livrées se composent avec le
  `packageManager` de B2.
- Revoir l'utilité réelle de chacune. Une action qui n'apporte rien se supprime.

### B4 — Vue « Ma configuration Claude Code »

Un endroit pour voir ce qui est installé : skills, agents, hooks, réglages.

- Lecture seule de `~/.claude/` : `skills/`, `agents/`, `commands/`,
  `settings.json` (hooks), `plugins/`. Le catalogue de `hooks/skills.js`
  couvre déjà les skills livrés par Cockpit — étendre pour lister ceux qui ne
  viennent pas de lui.
- **Sécurité :** `~/.claude/settings.json` peut contenir des variables
  d'environnement et des jetons. N'afficher que la structure des hooks et les
  noms de clés ; masquer toute valeur ressemblant à un secret, et ne jamais
  l'inclure dans une injection vers le terminal.
- Nouvel onglet, ou modale depuis la barre latérale — trancher avec B2, qui
  possède la liste des onglets. Par défaut : **modale**, parce qu'un onglet de
  plus est une surface de plus qui peut devenir fausse (cadrage §8).
- Signaler ce qui est périmé : un skill Cockpit plus ancien que celui du dépôt
  (`aJour` existe déjà dans `SkillsPanel.tsx`).

---

## Vague 3 — l'accueil (3 agents)

### C1 — Onboarding et bootstrap de projet

Le morceau le plus lourd, et celui qui dépend de tous les autres.

- **Premier lancement.** Aucun projet dans le registre → un écran qui explique
  ce qu'est Cockpit, ce que la boucle capture, ce qu'il faut installer (Claude
  Code, `node`, et pour le crawl : Playwright et un `cockpit.config.json`), et
  ce que rien n'installe à la place de l'utilisateur.
- **Écran d'équipement.** `Unequipped` (`App.tsx:518-588`) coche des skills sans
  dire à quoi ils servent. Le remplacer par une fiche : ce que
  `pnpm cockpit:install` va écrire (dossiers, hook post-commit,
  `~/.claude/settings.json`), ce que chaque skill apprend à Claude Code, et le
  choix de la source de graphe (A3) posé **là**, au bon moment.
- **Bootstrap d'un projet neuf.** Si le dossier n'est pas un dépôt git ou est
  vide, proposer d'envoyer à la session Claude les commandes de `bootstrap`
  définies dans le profil (A1) — par défaut `/project-setup`. **Cockpit
  n'exécute rien lui-même** : il écrit dans le terminal, comme les boutons
  d'action. C'est la seule forme compatible avec l'invariant.
- Vérifier les prérequis et le dire honnêtement : `claude` dans le PATH,
  `git`, un lockfile, un `cockpit.config.json`. Un prérequis manquant s'affiche
  avec la commande pour le régler — jamais résolu en douce.
- Corriger au passage **T-0011** (`install.js` peut tronquer le hook
  post-commit quand le marqueur de fin manque) : l'onboarding va multiplier les
  installations, ce bug va cesser d'être théorique.

### C2 — Internationalisation FR / EN

**En dernier des chantiers de code** : il touche chaque fichier de `app/src`, et
passer avant obligerait à retraduire ce que les vagues 1 et 2 auront écrit.

- ~200 chaînes, dispersées dans le JSX. Pas de pluriels complexes, peu
  d'interpolations.
- **Pas de dépendance.** Un module `app/src/i18n.ts` : un dictionnaire par
  langue, une fonction `t(cle, params?)`, la langue lue des préférences (A1)
  avec repli sur `navigator.language`. Le français reste la source ; l'anglais
  est la traduction.
- Le typage strict doit rendre une clé manquante impossible à compiler
  (`Record<CleTraduction, string>` par langue).
- Périmètre : **l'interface uniquement.** Les skills, les hooks, les messages
  du CLI et les commentaires du code restent en français — les traduire
  doublerait la surface à maintenir pour un bénéfice nul tant que l'app n'est
  pas distribuée. À rouvrir si elle l'est.
- Un test qui échoue si un dictionnaire n'a pas les mêmes clés que l'autre.

### C3 — README et documentation d'accueil

Explicitement à faire **en dernier** — le README décrit ce qui existe à la fin.

- Captures de l'interface : elles existent déjà, datées, dans
  `cockpit/pages/shots/` — les réutiliser plutôt que d'en refaire.
- Structure : ce que ça résout → une capture → mise en route en trois
  commandes → le reste replié. Le README actuel ouvre sur du cadrage.
- `README.md` (FR) + `README.en.md` (EN), avec renvoi croisé en tête.
- Documenter le MCP (A2), les préférences (A1), les thèmes (B2).
- Mettre à jour `CLAUDE.md` : la table des couches, les commandes, et les
  pièges connus auront bougé.

---

## Fichiers touchés, par ordre de pression

| Fichier | Chantiers | Remarque |
|---|---|---|
| `app/src/App.tsx` (852 l.) | A1, B1, B2, B4, C1, C2 | Le point de contention. Worktrees + intégration séquentielle. |
| `app/src/data.ts` (888 l.) | A1, B1, B3, C2 | Dépasse déjà les 800 lignes de la règle projet — B1 peut en extraire la densité. |
| `server/api.js` | A1, A3, B4 | Une seule `resolve()`. |
| `hooks/plans.js` | A1, B1 | La duplication de `density` se règle ici. |
| `hooks/snapshot.js` | A3 | Choix de source. |
| `hooks/tickets.js` + `app/src/tabs/Tableau.tsx` | A4 | Personne d'autre n'y touche. |
| `hooks/install.js` | C1 | T-0011 à corriger. |
| `_ds/nocturne-*/` | B2 | **Ne pas modifier** — surcharger. |
| `cadrage-cockpit.md` | A2 | Amendement du §3. |

## Vérification

Après chaque chantier, et avant de passer à la vague suivante :

```bash
pnpm test          # node:test sur hooks/ crawl/ server/, puis app/src compilé
pnpm typecheck     # ne couvre que app/src — hooks/ n'est pas typé
pnpm dev           # navigateur, port 5180 : les routes /api/*
pnpm electron      # l'app complète : le protocole cockpit://, le terminal
pnpm package       # DMG, et node-pty déballé de l'asar
```

Ce que la commande ne dit pas, et qu'il faut faire à la main :

- **Les deux hôtes.** Une route validée sous Vite n'est pas validée sous
  `cockpit://` : pas de CORS, pas d'`Origin`, pas les mêmes en-têtes.
- **Le DMG.** `node-pty` ne casse qu'à l'exécution de l'app empaquetée, jamais
  en dev. Le lot fini se termine par `pnpm package` et un lancement du DMG.
- **L'interaction.** Les tests d'`app/src` ne vérifient que « aucun onglet ne
  lève ». Un sélecteur de granularité, un changement de thème, un onglet masqué
  : ça se regarde à l'écran.
- **Le MCP** se vérifie depuis Claude Desktop, pas depuis Cockpit.
- **L'onboarding** se vérifie sur un dossier neuf, avec un
  `~/.claude/cockpit/settings.json` déplacé de côté — pas sur cette machine
  telle qu'elle est.

## Ce que ce plan écarte

| Écarté | Raison |
|---|---|
| Explorateur / éditeur de fichiers | Fonction d'IDE. Cadrage §8. |
| MCP capable de lancer le crawl ou l'install | Rompt l'invariant : un processus tiers exécuterait du code du projet observé. |
| Une librairie i18n, un framework de test, une librairie de graphique | Trois dépendances en prod, et cette sobriété est un choix (`CLAUDE.md`). |
| Traduire les skills, les hooks et le CLI | Surface doublée, bénéfice nul avant distribution. |
| Refaire les captures du README | Elles existent, datées, dans `cockpit/pages/shots/`. |
| Un stock d'epics séparé (`cockpit/epics/`) | Deux formats à tenir cohérents pour un champ de frontmatter. |
| Vue roadmap / Gantt des epics | Outil de reprise en main, pas gestionnaire de portefeuille. Cadrage §8. |
| Epics imbriqués | Profondeur 1. Au-delà, le tableau devient un arbre et la progression ne veut plus rien dire. |
