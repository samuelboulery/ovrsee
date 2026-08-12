---
{
  "id": "T-0108",
  "titre": "Historique — état vide aligné maquette 2m (aucun plan)",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "historique"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design, états vides (maquette 2m). Vérifié dans `Historique.tsx`
lignes 91-96 : l'état vide est un texte centré nu, sans cadre — même patron
à corriger que Produit (T-0107).

**Différence avec Données/Produit** : ici, l'action primaire n'a pas
d'équivalent honnête. Un plan se capture passivement (hook, à l'approbation
d'un plan Claude) — il n'existe pas de bouton « créer un plan » à proposer,
en inventer un mentirait sur ce que fait l'app. Cadre pointillé +
explication seuls, sans action forcée.

## Critères d'acceptation

- [ ] État vide : cadre pointillé `#24252b` rayon 9, texte centré, pas
      d'action inventée.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome (simuler
      un projet sans plan si besoin).
