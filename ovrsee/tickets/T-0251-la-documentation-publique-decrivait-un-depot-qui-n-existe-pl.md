---
{
  "id": "T-0251",
  "titre": "La documentation publique décrivait un dépôt qui n'existe plus",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "doc",
    "release"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Sept écarts entre ce que les documents promettent et ce que le dépôt fait. Deux
touchent la sécurité, donc un lecteur qui audite le projet.

- `SECURITY.md` annonçait **quatre** dépendances de production. Il y en a cinq :
  `playwright-core` manquait — précisément celle qui pilote un navigateur.
- Il attribuait la quarantaine anti-chaîne-empoisonnée à `.npmrc` et
  `onlyBuiltDependencies`. En pnpm 11, ni l'un ni l'autre ne protège plus :
  les réglages vivent dans `pnpm-workspace.yaml`. Le document décrivait une
  défense à l'endroit où elle n'est plus.
- Il renvoyait à « l'empreinte publiée sur la page de la release » : aucune n'y
  est publiée. Le sha512 est dans `latest-mac.yml`.
- `electron-builder.yml` parlait d'un dépôt « privé » et d'un « usage
  personnel ». Le dépôt est public depuis la 1.0.0-beta.
- `electron/main.js` annonçait « les trois routes `/api` ». Il y en a onze.
- Le serveur MCP annonçait la version `1.0.0`, figée en dur.
- Le pont documentait un thème « déjà résolu » là où le rendu envoie le
  réglage — l'erreur exacte qui a produit [[T-0242]].
- `[Unreleased]` était vide pour 22 commits.

## Critères d'acceptation

- [x] Les deux `SECURITY.md` disent cinq dépendances et nomment `pnpm-workspace.yaml`.
- [x] Le journal 1.2.0 est rédigé dans les deux langues.
- [x] Le serveur MCP lit sa version dans `package.json`, vérifié par son fil.
- [x] L'invariant de `CLAUDE.md` décrit les écritures réelles, en trois classes.
