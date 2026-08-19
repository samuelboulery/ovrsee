---
{
  "id": "T-0184",
  "titre": "README : l'application d'abord, le dépôt ensuite",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["docs"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "epic": "T-0180"
}
---

## Contexte

« Quick start » ouvre sur `pnpm ovrsee:install` et la section « Download »
arrive en onzième position, après « Architecture ». L'ordre de lecture enseigne
donc que le dépôt cloné est le mode normal — l'inverse de ce qui sera vrai une
fois le crawl embarqué.

`README.md` est la source, `README.fr.md` son pendant : les deux bougent.

Le serveur MCP se déclare aujourd'hui avec un chemin de dépôt cloné ; il lui
faut son équivalent pour l'application installée.

## Critères d'acceptation

- [ ] Le téléchargement des Releases est fusionné dans la mise en route, et
      remonté avant tout le reste.
- [ ] Deux chemins nommés sans ambiguïté : installer l'application (aucune
      commande) ; depuis les sources (pour contribuer).
- [ ] La commande d'enregistrement du MCP est donnée pour l'application
      installée comme pour le dépôt cloné.
- [ ] Les pièges disent que le crawl embarqué exige Google Chrome installé.
- [ ] `README.md` et `README.fr.md` restent en correspondance.
