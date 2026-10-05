---
{
  "id": "T-0278",
  "titre": "Le README montre la 1.2 alors que la 1.3.1 est sortie",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "docs"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": null
}
---

## Contexte

Les sept captures de `docs/screenshots/` datent du 2 septembre (T-0264) : elles
précèdent la 1.2.1, la 1.3.0 (préfixe `E-` des epics, bouton « Lancer le serveur »
de l'onglet Navigateur, colonne finale triée par date de fin) et la 1.3.1.

Le texte a le même retard par endroits : la section « Coffre comme source de
l'onglet Données » renvoie encore au champ `obsidianVault` d'`ovrsee.config.json`,
que T-0275 a cessé de lire au profit de Préférences → Projet, et les tables de
dépendances citent `electron 43.4.1`, `playwright-core ^1.62.1`, `oxlint ^1.80.0`.

## Critères d'acceptation

- [ ] `pnpm screenshots` a régénéré les sept captures, encadrées par screenmat, en
      webp ; aucune n'est vide, aucune ne montre de donnée personnelle.
- [ ] Le script n'embarque plus de chemin propre à un poste : screenmat se désigne
      par la variable `SCREENMAT` (dossier du dépôt screenmat), comme dans img-creator.
- [ ] `README.md` et `README.fr.md` ne citent plus `obsidianVault` dans
      `ovrsee.config.json`, leurs versions de dépendances suivent `package.json`, et
      les nouveautés visibles de la 1.3.0 y sont nommées.
- [ ] `pnpm test` passe (`scripts/screenshots.test.js` compris).
