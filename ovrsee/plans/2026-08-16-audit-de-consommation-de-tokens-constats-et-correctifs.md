---
{
  "status": "open",
  "title": "Audit de consommation de tokens — constats et correctifs",
  "opened": "2026-08-16",
  "closed": null,
  "commits": []
}
---

# Audit de consommation de tokens — constats et correctifs

## Contexte

Impression de départ : « ovrsee et ses skills consomment beaucoup plus qu'une
utilisation classique ». Trois audits parallèles (hooks + MCP + skills du dépôt,
config globale `~/.claude`, transcripts JSONL réels) ont mesuré la chose.

**Le diagnostic contredit l'intuition.** Ovrsee lui-même est sobre : son brief de
démarrage pèse 881 octets (~220 tokens) et ses 11 outils MCP ~615 tokens. Ce n'est
pas là que part l'argent.

Ce qui part, mesuré sur les 10 dernières sessions du projet :

| Session | Tours assistant | cache_read | Total | Contexte moyen / tour |
|---|---:|---:|---:|---:|
| be60f5f2 (13/08) | 1019 | 403,7 M | 408,9 M | **396 k** |
| a3f0d5bc (14/08) | 410 | 92,4 M | 94,7 M | 225 k |
| aed365c5 (16/08) | 391 | 86,3 M | 87,5 M | 221 k |
| 9e931a52 (14/08) | 89 | 8,6 M | 8,9 M | 97 k |

**`cache_read` = 65 à 98 % du coût.** Autrement dit : le coût d'une session est
`taille du contexte × nombre de tours`. Rien d'autre ne pèse. L'output représente
1 à 10 %, les invalidations de cache (9,3 par session) ~465 k tokens sur 10
sessions — du bruit face à 628 M.

Deux variables commandent donc tout : **jusqu'où le contexte a le droit de gonfler**,
et **combien de tours on lui fait relire**.

Ordre de grandeur comparatif : ovrsee = 62,8 M tokens/session en moyenne contre
26,4 M pour un autre projet. Le facteur 2,4× vient de sessions 2 à 4 fois plus
longues, pas d'ovrsee.

### Deux constats faux à écarter d'emblée

- La **statusline** (`open-island-statusline`) ne coûte rien : elle s'affiche dans
  le terminal, elle n'entre jamais dans le contexte du modèle.
- Les **66 Mo de captures** dans `ovrsee/pages/shots` ne coûtent rien non plus :
  le brief n'en lit qu'un compteur.

---

## Levier 1 — Le plafond de contexte (effet dominant, ~-40 %)

`~/.claude/settings.json` porte `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "70"`. Sur le
modèle `claude-opus-5[1m]`, l'autocompact ne se déclenche donc qu'à **700 000
tokens**. Chaque tour paie l'intégralité du contexte accumulé — d'où les 396 k de
moyenne sur la session la plus longue.

À l'équilibre, le contexte moyen vaut environ la moitié du seuil. Passer de 70 %
à 45 % ramène la moyenne de ~350 k à ~225 k : **-36 % sur chaque tour de chaque
session longue**. C'est le seul changement à effet multiplicatif ; tout le reste
est marginal à côté.

**Action** : `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` → `"45"` dans
`/Users/sam/.claude/settings.json`.

Contrepartie honnête : plus de compactions, donc plus de résumés intermédiaires.
Si le travail exige vraiment un contexte long et continu, garder 70 % et n'appliquer
que les leviers 2 à 4 — le gain tombe alors à ~-20 %.

---

## Levier 2 — Le plancher résident (~-8 000 tokens sur chaque tour)

Le premier message d'une session pèse **~43 000 tokens** (mesuré : 33 k à 45,7 k
selon la session). Ce plancher est relu à chaque tour, dans chaque projet.
Inventaire de ce qui l'occupe et de ce qui peut partir :

| Source | Octets | ~tokens | Sort |
|---|---:|---:|---|
| Listing des 52 skills globaux | 8 761 | 2 190 | purge partielle |
| `~/.claude/rules/common/*.md` (10 fichiers) | 14 084 | 3 520 | condenser |
| `~/.claude/rules/README.md` | 4 345 | 1 086 | **supprimer** |
| Listing des 28 agents globaux | 5 618 | 1 405 | purge partielle |
| `CLAUDE.md` du projet ovrsee | 11 170 | 2 793 | densifier |
| `~/.claude/CLAUDE.md` | 2 765 | 691 | réécrire après purge |
| Activation caveman (× 2) + ponytail | ~4 000 | 1 000 | dédoublonner |
| Skills `cockpit` + `cockpit-tickets` (périmés) | 14 541 | ~200 (listing) | **supprimer** |

### 2a. Purger skills et agents hors-stack

Décision prise : **désinstaller**, restaurable depuis `/Users/sam/code/claude-config`
(source versionnée).

Dans `~/.claude/skills/` — retirer les 34 répertoires pour langages absents de
tous les projets actifs : `android-clean-architecture`,
`compose-multiplatform-patterns`, `cpp-coding-standards`, `cpp-testing`,
`django-patterns`, `django-tdd`, `django-verification`, `golang-patterns`,
`golang-testing`, `java-coding-standards`, `kotlin-coroutines-flows`,
`kotlin-exposed-patterns`, `kotlin-ktor-patterns`, `kotlin-patterns`,
`kotlin-testing`, `laravel-patterns`, `laravel-tdd`, `laravel-verification`,
`perl-patterns`, `perl-testing`, `python-patterns`, `python-testing`,
`rust-patterns`, `rust-testing`, `springboot-patterns`, `springboot-tdd`,
`springboot-verification`, `configure-ecc`, `project-guidelines-example`,
`eval-harness`, `continuous-learning-v2`, `plankton-code-quality`,
**`cockpit`**, **`cockpit-tickets`**.

Les deux derniers sont des doublons périmés d'`ovrsee`/`ovrsee-tickets` — le projet
a été renommé, les copies sont restées, et deux skills quasi identiques dans le
listing invitent à l'erreur d'invocation.

Dans `~/.claude/agents/` — retirer les 15 fichiers hors-stack :
`cpp-build-resolver.md`, `cpp-reviewer.md`, `flutter-reviewer.md`,
`go-build-resolver.md`, `go-reviewer.md`, `java-build-resolver.md`,
`java-reviewer.md`, `kotlin-build-resolver.md`, `kotlin-reviewer.md`,
`pytorch-build-resolver.md`, `python-reviewer.md`, `rust-build-resolver.md`,
`rust-reviewer.md`, `chief-of-staff.md`, `database-reviewer.md`.

Gain : ~-2 200 tokens résidents par tour.

### 2b. Dégraisser les règles globales

`~/.claude/rules/README.md` (4 345 o) explique **comment installer les règles** —
documentation de maintenance, zéro valeur en session, et pourtant injecté à chaque
tour. Le déplacer hors de `~/.claude/rules/` (il reste dans `claude-config`).

Les 10 fichiers de `~/.claude/rules/common/` (14 084 o) répètent largement ce que
le modèle fait déjà par défaut. Cibler ~5 000 o en gardant ce qui est réellement
non déductible :

- `package-manager.md` (3 329 o, le plus gros) : la règle utile tient en 5 lignes
  — pnpm exclusif, table de correspondance, scripts de cycle de vie bloqués. Le
  récit de l'incident ChainDrop et la checklist sont de la culture, pas de
  l'instruction ; les basculer dans un skill invocable.
- `performance.md` (1 599 o) : la table de choix de modèles cite Sonnet 4.6 /
  Opus 4.7 — périmée, et le harnais choisit déjà. Supprimer.
- `agents.md` (1 544 o) : liste des agents, redondante avec le listing automatique
  déjà injecté. Supprimer.
- `hooks.md`, `patterns.md`, `coding-style.md`, `testing.md`, `security.md`,
  `git-workflow.md`, `development-workflow.md` : condenser en un ou deux fichiers.

Gain : ~-3 300 tokens résidents par tour.

### 2c. Dédoublonner caveman

`caveman` s'active **deux fois** : par `SessionStart` dans
`~/.claude/settings.json` (`node "$HOME/.claude/hooks/caveman-activate.js"`) et par
le hook du plugin `caveman@caveman`. D'où deux blocs de règles identiques à chaque
démarrage, et deux rappels identiques à chaque prompt (visibles dans le transcript
de cette session même).

Retirer l'entrée `SessionStart` de `settings.json` et laisser le plugin faire son
travail. Gain : ~-300 tokens/session + ~-50 tokens/prompt.

### 2d. Serveur MCP fantôme

`~/.claude.json` déclare un serveur `cockpit` pointant sur
`/Users/sam/code/cockpit/mcp/server.js` — **le répertoire n'existe plus**. Le
serveur échoue à chaque démarrage. Le supprimer de `mcpServers`.

Au passage : le serveur MCP d'ovrsee n'est déclaré nulle part. S'il doit être
utilisé, l'inscrire sous son vrai nom vers `/Users/sam/code/ovrsee/mcp/server.js`.

### 2e. `CLAUDE.md` du projet (11 170 o → ~6 000 o)

Relu à chaque tour de chaque session ovrsee. Les invariants sont à garder mot pour
mot ; ce qui peut se resserrer sans rien perdre :

- La section **Pièges connus** (14 entrées) est le cœur de valeur — la garder,
  mais ramener chaque entrée à sa phrase opérante ; plusieurs racontent leur
  genèse sur 5 lignes.
- Les **Conventions** répètent le `~/.claude/CLAUDE.md` global (pnpm, Conventional
  Commits) — retirer les doublons.
- La table des **Commandes** est déductible de `package.json` — garder les seules
  lignes qui portent une information non évidente (`pnpm test` sans framework,
  `package:win` seulement depuis Windows).

Gain : ~-1 300 tokens par tour de session ovrsee.

**Total levier 2 : plancher 43 k → ~35 k, soit -18 % sur chaque tour.**

---

## Levier 3 — Les mines du MCP ovrsee

Aucun de ces outils ne se déclenche seul, mais **un seul appel suffit à ruiner une
session**. Ce sont des amorces, pas une consommation de fond.

| Outil | Ce qu'il renvoie | ~tokens | Fichier |
|---|---|---:|---|
| `getGraph` | `graphify-out/graph.json` en entier (708 Ko) | **177 000** | `mcp/dispatch.js:151-155` |
| `getPlans` | 10 plans **avec leur corps complet** | ~20 000 | `mcp/dispatch.js:139-143` |
| `listTickets` | 20 tickets avec leur corps | ~5 000 | `mcp/dispatch.js:132-136` |

La cause commune est en amont : `hooks/brief.js:73` construit le snapshot avec
`plans: plans.map(p => ({ file: p.file, ...p.meta, body: p.body }))` — le corps
entier est embarqué dans chaque instantané, et `derniers()` (`mcp/dispatch.js:87`)
ne fait que trancher la liste, jamais les champs.

**Correctifs, dans l'esprit du dépôt (`node:test`, pas de framework, style existant) :**

1. `getPlans` et `listTickets` — projeter par défaut sur les métadonnées
   (`file`, `titre`, `opened`, `closed`, `intention`) et n'inclure `body` que sur
   `{ full: true }` explicite. Le résumé d'un plan est déjà calculé par
   `intention()` (`hooks/brief.js:102-104`) : le réutiliser plutôt que d'écrire
   une nouvelle troncature.
2. `getGraph` — renvoyer par défaut un résumé (compte de nœuds, d'arêtes, liste
   des communautés) et exiger `{ full: true }` pour le blob. La description de
   l'outil avertit déjà du volume ; l'avertissement ne suffit visiblement pas.
3. Mettre à jour les descriptions des trois outils dans `mcp/server.js:26-152`
   pour annoncer la projection et le drapeau `full`.

Tests à ajouter dans `mcp/mcp.test.js`, dans le style du fichier : un plan avec un
corps volumineux, vérifier que `getPlans` sans `full` ne le renvoie pas et qu'avec
`full: true` il le renvoie. Rappel du `CLAUDE.md` : tester `dispatch()` ne teste
pas le fil — le test doit passer par le transport comme les autres.

**Attention à l'invariant** : ces changements ne touchent qu'à ce que le MCP
*renvoie*. Rien n'est écrit ailleurs que dans `ovrsee/tickets/` et
`ovrsee/board.json`, et aucun code du projet observé n'est exécuté.

---

## Levier 4 — Discipline de session (pas de code)

Les chiffres exposent une habitude, pas un bug : une session à **592 prompts**
(be60f5f2) traîne l'intégralité de son historique à chaque tour. Trois réflexes,
par ordre de rendement :

1. **`/clear` en changeant de sujet.** Le plancher (35 k après correctifs) se
   repaie en une session neuve, contre 400 k relus à chaque tour dans une session
   qui dure. C'est le geste le plus rentable du lot.
2. **Déléguer l'exploration aux subagents.** Un agent `Explore` renvoie sa
   conclusion, pas les fichiers qu'il a lus. `CLAUDE_CODE_SUBAGENT_MODEL: "haiku"`
   est déjà posé — bon réglage, à garder.
3. **Ne pas lire les gros fichiers en entier.** `graphify-out/graph.json` (708 Ko),
   les plans de 26 Ko, les 147 tickets (230 Ko cumulés) : passer par `grep`, par
   le MCP projeté, ou par un subagent.

---

## Fichiers touchés

**Config globale** (hors dépôt) :
- `/Users/sam/.claude/settings.json` — `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, retrait du `SessionStart` caveman
- `/Users/sam/.claude.json` — retrait du serveur MCP `cockpit`
- `/Users/sam/.claude/skills/` — 34 répertoires retirés
- `/Users/sam/.claude/agents/` — 15 fichiers retirés
- `/Users/sam/.claude/rules/README.md` — retiré
- `/Users/sam/.claude/rules/common/*.md` — condensés
- `/Users/sam/.claude/CLAUDE.md` — mis à jour (ses sections « Structure du setup »
  et « Chemins canoniques » décrivent l'état d'avant la purge)

Les mêmes changements sont à répercuter dans `/Users/sam/code/claude-config/claude/`,
qui est la source versionnée.

**Dépôt ovrsee** :
- `mcp/dispatch.js` — projection de `getPlans`, `listTickets`, `getGraph`
- `mcp/server.js` — descriptions des trois outils
- `mcp/mcp.test.js` — tests de projection, via le transport
- `CLAUDE.md` — densification

---

## Vérification

1. **Mesurer avant.** Noter le `input_tokens + cache_creation_input_tokens` du
   premier message assistant de la session courante (référence : ~43 000).
2. **Appliquer les correctifs**, puis ouvrir une session neuve dans ovrsee et
   relever le même chiffre. Cible : ~35 000 (-18 %).
3. **Vérifier qu'aucun skill utile n'a disparu** : `/ovrsee`, `/ovrsee-tickets`,
   `/graphify`, `superpowers:*`, `/commit-push-pr` doivent rester invocables.
4. **Tests du dépôt** : `pnpm test` — les tests MCP doivent passer, y compris les
   nouveaux tests de projection.
5. **Vérifier le MCP dans les deux modes**, comme l'exige le `CLAUDE.md` : une
   route testée dans le navigateur n'est pas une route testée dans Electron.
   Appeler `getPlans` sans `full` et confirmer que la réponse ne contient plus de
   corps de plan ; appeler `getGraph` et confirmer le résumé.
6. **Absence d'erreur MCP au démarrage** — le serveur `cockpit` fantôme ne doit
   plus être tenté.
7. **Mesurer après, sur une vraie session de travail** : rejouer l'agrégation des
   `message.usage` sur le JSONL de `~/.claude/projects/-Users-sam-code-ovrsee/` et
   comparer le total et le contexte moyen par tour aux chiffres du tableau de
   contexte ci-dessus.

---

## Ce qu'il ne faut pas toucher

- Le **brief de démarrage** d'ovrsee (881 o) : déjà borné à 5 entrées par
  catégorie avec un « … et N autres ». Il fait son travail pour 220 tokens.
- La **statusline** : hors contexte modèle, coût nul.
- Les **hooks `Stop` / `PostToolUse`** d'ovrsee : quelques dizaines d'octets.
- Les **captures** de `ovrsee/pages/shots` : jamais injectées.
- `CLAUDE_CODE_SUBAGENT_MODEL: "haiku"` : bon réglage, à conserver.
