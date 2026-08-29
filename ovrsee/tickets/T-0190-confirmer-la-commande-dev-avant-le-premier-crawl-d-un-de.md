---
{
  "id": "T-0190",
  "titre": "Confirmer la commande dev avant le premier crawl d'un dépôt",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "crawl",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-29",
  "plan": "2026-08-20-audit-de-securite-complet-findings-et-correctifs.md",
  "charge": "s"
}
---

## Contexte

Audit de sécurité du 2026-08-20, finding différé.

Le crawl lit la commande `dev` dans le `ovrsee.config.json` du projet observé et
l'exécute dans un shell. C'est arbitré et voulu — `CLAUDE.md` le dit : c'est une
commande écrite par l'utilisateur, dans son dépôt, au même titre qu'un script
npm.

Mais l'arbitrage vaut pour un dépôt qu'on écrit, pas pour un dépôt qu'on reçoit.
Inscrire un clone au registre et cliquer « crawler » exécute une ligne de shell
que personne n'a relue. C'est la question de confiance d'espace de travail que
VS Code pose à l'ouverture d'un dossier, et l'ovrsee ne la pose pas.

Le crawl n'est pas le seul chemin : `pnpm ovrsee:auth` lance la même commande.

## Critères d'acceptation

- [x] Le premier crawl d'un projet montre la commande `dev` telle qu'elle sera
      exécutée, et attend un accord explicite.
- [x] L'accord est retenu par projet — il ne se redemande pas à chaque crawl.
- [x] Modifier `dev` dans `ovrsee.config.json` redemande l'accord.
- [~] ~~Un projet déjà crawlé avant ce changement n'a pas à réaccorder.~~
      **Abandonné.** La seule preuve disponible de « déjà crawlé » est
      `ovrsee/pages/scans.jsonl`, un fichier **versionné** — donc fourni par le
      dépôt observé. Un clone hostile qui embarque un `scans.jsonl` portant un
      `{"ok": true}` s'auto-classerait « déjà crawlé » et traverserait le
      contrôle. Bâtir une porte dérobée sur une entrée contrôlée par l'attaquant
      pour économiser un clic est un mauvais échange : le critère coûtait un
      chemin d'amorçage, sa migration, ses tests et un raisonnement de sécurité
      à tenir pour toujours, contre un clic une fois par projet déjà inscrit.
      Remplacé par : **le premier crawl suivant la mise à jour demande l'accord,
      une fois par projet** — ce qu'a fait VS Code en introduisant Workspace
      Trust. Zéro ligne de migration, zéro entrée attaquante.

## Relevé le 2026-08-22

L'audit du 2026-08-22 (`2026-08-22-audit-de-cybersecurite-complet-findings-et-correctifs.md`) rouvre ce constat et le classe premier.
La chaîne est confirmée dans l'arbre courant : `hooks/ovrsee-post-commit.js:269`
lance `spawnCrawl()` dès qu'un commit touche du code, et `crawl/index.js:179`
passe `config.dev` à `shellRun()`, c'est-à-dire à un `zsh -lic`. La valeur est
relue sur le disque à chaque crawl : `validateCrawlConfig()` (`server/api.js:180`)
ne garde que l'écriture par l'API, jamais la relecture. Ouvrir puis crawler un
dépôt reçu — le geste que l'application encourage — exécute donc son code.

C'est le seul endroit où l'invariant du cadrage (« l'ovrsee lit ; il n'exécute
que le terminal qu'on lui demande ») est enfreint par construction.

## Fait le 2026-08-29

L'accord vit dans `~/.claude/ovrsee/trust.json`, hors du dépôt observé, et porte
sur la chaîne `dev` exacte qui part à `shellRun()` — sans normalisation, ce qui
fait qu'un `dev` modifié entre l'accord et le lancement échoue à la comparaison.

La garde (`assurerConfiance`, `crawl/confiance.js`) est aux **deux** sites
d'exécution — `crawl/index.js` et `crawl/auth.js` — et pas aux points d'entrée :
un cinquième appelant ne pourra pas l'oublier. Sans humain (hook `post-commit`),
elle refuse au lieu de demander, et l'échec s'écrit dans `scans.jsonl` comme
n'importe quel autre.

Ce que ce correctif ne fait pas, et qu'il ne faut pas lire comme une frontière :
il n'empêche pas une commande **approuvée** de faire n'importe quoi — approuver
`pnpm dev`, c'est approuver le script `dev` du `package.json`, ses dépendances et
leurs scripts de cycle de vie. Le contrôle porte sur la provenance du dépôt, pas
sur le contenu de la commande.
