---
{
  "id": "T-0190",
  "titre": "Confirmer la commande dev avant le premier crawl d'un dépôt",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "crawl",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-22",
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

- [ ] Le premier crawl d'un projet montre la commande `dev` telle qu'elle sera
      exécutée, et attend un accord explicite.
- [ ] L'accord est retenu par projet — il ne se redemande pas à chaque crawl.
- [ ] Modifier `dev` dans `ovrsee.config.json` redemande l'accord.
- [ ] Un projet déjà crawlé avant ce changement n'a pas à réaccorder.

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
