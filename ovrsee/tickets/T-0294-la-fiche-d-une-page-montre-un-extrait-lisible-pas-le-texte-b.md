---
{
  "id": "T-0294",
  "titre": "La fiche d'une page montre un extrait lisible, pas le texte brut du DOM",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "crawl",
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0290",
  "charge": "xs",
  "fait": "2026-10-10T15:07:34.422Z"
}
---

## Contexte

`crawl/index.js:581` enregistre `excerpt: entry.text`, le texte de toute la page : la fiche Produit affiche « Rechercher, aller à… ⌘K VUES 7 Aperçu 1 Navigateur 2… ».

## Critères d'acceptation

- [ ] L'extrait vient de `<meta name="description">`, sinon du premier `h1` et du premier paragraphe du contenu principal, tronqué.
- [ ] Test du choix d'extrait sur trois pages fixes.
