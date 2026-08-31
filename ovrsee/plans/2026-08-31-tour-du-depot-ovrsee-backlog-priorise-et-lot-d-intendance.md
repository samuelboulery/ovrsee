---
{
  "status": "open",
  "title": "Tour du dépôt ovrsee — backlog priorisé et lot d'intendance",
  "opened": "2026-08-31",
  "closed": null,
  "commits": []
}
---

# Tour du dépôt ovrsee — backlog priorisé et lot d'intendance

## Contexte

Le 31 août 2026, tour complet du dépôt : état local, état distant, issues,
tickets, CI. Le constat est que le code va bien et que ce qui traîne est
ailleurs — dans l'intendance de release et dans six issues jamais ticketées.

**Ce qui est sain.** `main` synchrone avec `origin` (0/0), aucune PR ouverte,
283 tests verts, `lint` et `typecheck` propres, les 8 derniers runs CI au vert
sur les trois OS, 0 alerte Dependabot.

**Ce qui traîne, et que le tour a sorti.**

1. **La release est en retard de 16 commits.** `v1.1.1-beta` date du 20 août ;
   depuis, les PR #55 à #78 ont livré la garde de confiance sur la commande
   `dev` (T-0190), le retrait de `bootstrap` des champs surchargeables (#70,
   sécurité), et quatre corrections d'interface. La section `[Unreleased]` est
   **vide dans les deux CHANGELOG** — rien de tout ça n'est écrit.
2. **Le dépôt est passé public.** `CLAUDE.md:220` affirme encore « dépôt privé
   — les destinataires doivent être collaborateurs ». C'est faux, et c'est la
   phrase sur laquelle repose l'arbitrage de T-0192.
3. **T-0197 est terminé mais se signale « En cours ».** Ses 9 enfants sont en
   colonne finale ; seule sa `colonne` n'a pas suivi. Le hook de briefing lit
   `colonne`, donc chaque démarrage de session annonce un epic ouvert qui ne
   l'est pas.
4. **Six issues ouvertes, aucune ticketée.** Elles ne sont donc dans aucun
   tableau, et le briefing de session ne les voit pas.

Objectif : remettre le backlog en phase avec la réalité (tickets pour les six
issues), puis solder l'intendance en un lot.

## Ce qui a été établi pendant l'exploration

Ces faits conditionnent le chiffrage des tickets ci-dessous — ils viennent de la
lecture du code, pas d'une supposition.

- **#65 est bâti aux quatre cinquièmes.** `pickElement()`
  (`app/src/tabs/navigateur-webview.ts:117`) surligne et capture déjà
  `{selector, text, html, route}` ; `describe()` (l.207) en fait un texte pour
  Claude et `corpsDepuis()` (l.216) un corps de ticket ; `pasteToClaude()`
  (`app/src/pty.ts:152`) l'injecte, `onCreerTicketDepuisElement`
  (`app/src/tabs/Navigateur.tsx:300`) le ticketise. Il manque **la saisie du
  commentaire** entre les deux.
- **#48 n'a aucune fondation.** Le registre `~/.claude/ovrsee/projects.json` ne
  porte que `{path, name, lastOpened}` (`hooks/plans.js:256`), et
  `--color-accent` est une constante de `_ds/ovrsee/styles.css:74`. Mais c'est
  un jeton unique, consommé par variable CSS partout : le surcharger sur
  l'élément racine suffit.
- **#79 a une contrainte de sécurité.** `customActions` vit dans
  `~/.claude/ovrsee/settings.json` et **n'est pas surchargeable par
  `ovrsee.config.json`** — `mergeSettings` (`hooks/settings.js:221-245`) ne
  recopie que six champs inertes, et `bootstrap` en a été retiré exprès (#70,
  commentaire l.229-232). Des prompts « par projet » doivent donc être indexés
  par chemin **dans le fichier hors dépôt**, jamais lus du dépôt observé.
- **#47 a déjà sa donnée, mal routée.** L'état Claude (`busy`/`question`/`stop`)
  est parsé depuis l'OSC en `app/src/attention.ts:98`, stocké par projet dans le
  `useRef attentions` (`app/src/Terminal.tsx:222`) et déjà agrégé pour la barre
  de menu (`Terminal.tsx:341-368`). Le `ProjectSwitcher` (`app/src/Shell.tsx:288`)
  ne l'affiche pour aucun projet — sa pastille ne dit que « projet courant ».
  Limite structurelle à écrire dans le ticket : **un projet jamais ouvert dans
  l'instance n'a pas de pty, donc pas d'état.**
- **#54 bute sur une frontière du cadrage.** Le markdown maison rend déjà les
  images locales via `/api/media` (`app/src/markdown.tsx:84-131`) mais **refuse
  les data-URI** (l.90-91), volontairement. Stocker une image demande un
  répertoire écrivable sous `ovrsee/` — or `CLAUDE.md` limite l'écriture à
  `ovrsee/tickets/*.md` et `ovrsee/board.json`. C'est un arbitrage de cadrage,
  pas une tâche d'implémentation : le ticket doit naître en « à spécifier ».
- **#64 est le plus gros.** Le thème clair a été *retiré* (T-0075, puis T-0200
  qui a supprimé le champ `theme`). Les ~90 jetons `--color-*` sont en `:root`
  seul (`_ds/ovrsee/styles.css:39-129`), `theme.ts` ne porte que `darkTheme`, et
  `getTerminalTheme()` n'est appliqué qu'à **la création** du xterm
  (`app/src/useTerminal.ts:226`), jamais à chaud. Décision prise : il reste en
  dernier.

## Priorisation

L'ordre suit l'impact rapporté au coût, sauf le lot 1 qui passe devant parce
qu'il est presque gratuit et qu'il corrige des affirmations fausses.

| Rang | Quoi | Pourquoi ce rang |
|---|---|---|
| 1 | Lot d'intendance (release, doc, T-0197, T-0193) | ~1 h, débloque une release en retard, retire deux mentions fausses |
| 2 | #65 commenter une zone | Infrastructure déjà là — le meilleur rapport impact/coût du lot |
| 3 | #48 accent par projet | Petit, et répond exactement à la gêne décrite (reconnaître son projet) |
| 4 | #79 commandes et prompts | Renommage + portée projet + bouton visible ; contrainte de sécurité connue |
| 5 | #47 état des autres projets | Donnée existante à router ; partiel par nature, à dire dans le ticket |
| 6 | #54 images dans les tickets | Demande d'abord un arbitrage de cadrage → « à spécifier » |
| 7 | #64 light mode | Chantier à part, planifié seul (choix acté) |
| — | T-0192 signature macOS | Reste en backlog : suspendu à un compte Apple Developer, 0 téléchargement constaté |

## Exécution

### Étape 1 — Écrire les tickets des six issues

Un fichier par issue dans `ovrsee/tickets/`, format du skill `ovrsee-tickets`
(frontmatter JSON, corps « Contexte » + « Critères d'acceptation »). Le dernier
id existant est **T-0213** : la série va donc de **T-0214 à T-0219**, dans
l'ordre de priorisation ci-dessus.

Colonne d'arrivée `backlog`, sauf T-0219 (issue #54) qui part en `a-specifier`
avec sa question ouverte écrite en toutes lettres. Chaque ticket cite son numéro
d'issue dans le contexte et reprend les points d'ancrage `file:line` établis
plus haut — c'est ce qui les rend exécutables plus tard sans refaire ce tour.

Priorités : `haute` pour T-0214 (#65) et T-0215 (#48), `moyenne` pour T-0216
(#79) et T-0217 (#47), `moyenne` pour T-0219 (#54), `basse` pour T-0218 (#64)
tant qu'il n'est pas planifié.

### Étape 2 — Lot d'intendance

Une seule branche, un commit par geste.

1. **`CLAUDE.md:220`** — corriger « dépôt privé » : le dépôt est public, les
   Releases sont accessibles à tous. La phrase sert de justification à T-0192,
   donc la corriger sans toucher à l'arbitrage lui-même.
2. **T-0193** (`charge: xs`, déjà spécifié) — écrire ses deux critères :
   l'entrée « Pièges connus » de `CLAUDE.md` sur `hostValidationMiddleware`, et
   le commentaire dans `vite.config.js` disant ce que `server.host` et
   `server.allowedHosts` coûtent. Puis passer le ticket en colonne finale.
3. **T-0197** — réécrire sa `colonne` en `fait` et sa `maj`. Diff d'une ligne.
   Le champ est inerte pour l'interface, mais le hook de briefing le lit.
4. **CHANGELOG** — remplir `[Unreleased]` / `[Non publié]` dans `CHANGELOG.md`
   (source anglaise) **et** `CHANGELOG.fr.md`, à partir de
   `git log v1.1.1-beta..HEAD`. Trois rubriques attendues : `Security` (la garde
   de confiance T-0190, le retrait de `bootstrap` #70, le filtrage des secrets
   dans `pages.json` T-0191), `Fixed` (#50, #52, #49, #53), `Changed` (montées
   de version, perf du démarrage #61).
5. **Release `v1.1.2-beta`** — bumper `version` dans `package.json`, basculer la
   section en `[1.1.2-beta] — 2026-08-31` dans les deux fichiers, poser les
   liens de comparaison en bas de page. **Le tag reste à poser par l'humain** :
   `git tag v1.1.2-beta && git push --tags` déclenche `release.yml`. Ne pas
   pousser de tag sans accord explicite.
6. **`graphify-out/graph.json`** — 1981 insertions / 1150 suppressions non
   commitées. Demander avant : soit committer la régénération, soit la
   restaurer. Ne rien décider seul, l'onglet Données le lit.

### Fichiers touchés

- `ovrsee/tickets/T-0214-*.md` … `T-0219-*.md` (nouveaux)
- `ovrsee/tickets/T-0193-*.md`, `ovrsee/tickets/T-0197-*.md` (frontmatter)
- `CLAUDE.md` (ligne 220, plus l'entrée « Pièges connus » de T-0193)
- `vite.config.js` (commentaire T-0193)
- `CHANGELOG.md`, `CHANGELOG.fr.md`, `package.json`

## Vérification

- `pnpm test` — 283 tests doivent rester verts (aucun code de production touché
  hors commentaires ; si le compte bouge, c'est un signal).
- `pnpm lint && pnpm typecheck` — propres.
- **Relire les six tickets dans l'interface** : `pnpm electron`, onglet Tableau.
  Vérifier que les six apparaissent en `Backlog` (cinq) et `À spécifier` (un),
  et que la vue « Epics » montre T-0197 comme terminé.
- **Relancer une session Claude** dans le dépôt : le briefing de démarrage doit
  annoncer les six tickets à faire et ne plus citer T-0197 ni T-0193.
- `git diff v1.1.1-beta..HEAD --stat` relu en face du CHANGELOG : chaque PR de
  la liste doit avoir sa ligne, sinon la release ment.
- **Ne pas pousser le tag** avant accord — la construction publie sur Releases,
  dépôt public.
