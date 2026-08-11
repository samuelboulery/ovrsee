---
{
  "id": "T-0055",
  "titre": "Comparer deux dates dans Produit",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "produit",
    "phase-2"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0052"
}
---

## Contexte

`pages.json`/`scans.jsonl` stockent déjà capture PNG + date + commit par
page. Aucune logique de diff n'existe. La maquette montre les deux
captures côte à côte pour deux dates choisies — pas de diff pixel
automatique dans ce scope, juste la juxtaposition des captures déjà sur
disque.

## Critères d'acceptation

- [ ] Onglet Produit : sélecteur de deux dates parmi les captures
      existantes d'une page.
- [ ] Affichage côte à côte des deux captures PNG correspondantes.
- [ ] État vide honnête si une page n'a qu'une seule capture (rien à
      comparer).
- [ ] Aucune donnée neuve à calculer côté serveur — lecture pure de ce qui
      existe déjà dans `ovrsee/pages/`.
