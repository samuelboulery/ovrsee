---
{
  "id": "T-0107",
  "titre": "Produit — état vide aligné maquette 2m (aucune page crawlée)",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "produit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design, états vides (maquette 2m — même patron que Données, déjà
posé en T-0101 : cadre pointillé + explication + action primaire unique).
Vérifié dans `Produit.tsx` lignes 87-100 : l'état « aucune page » est un
texte nu, sans cadre, sans action — juste `{t('produit.no_pages')} node
crawl/index.js`.

`CrawlButton` (même fichier, ligne ~252) existe déjà et copie la commande
de crawl — même geste que l'état vide de Données. Le réutiliser plutôt que
d'inventer une deuxième façon de lancer un crawl.

## Critères d'acceptation

- [ ] État vide : cadre pointillé `#24252b` rayon 9, texte centré, action
      primaire `CrawlButton`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur un
      projet sans pages crawlées (ou en simulant `pages.length === 0`).
