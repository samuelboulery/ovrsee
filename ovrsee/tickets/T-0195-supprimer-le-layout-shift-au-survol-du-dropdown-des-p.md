---
{
  "id": "T-0195",
  "titre": "Supprimer le layout shift au survol du dropdown des projets",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": ["ui", "issue-51"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-corriger-les-issues-49-51-et-53.md"
}
---

## Contexte

Issue #51. Dans `ProjectRow` (`app/src/App.tsx`), le bouton « × » n'est monté que
pendant le survol : il entre dans le flux flex, comprime le nom et pousse le badge.
La convention du dépôt est de ne jamais faire varier au survol ce qui prend de la
place (`app/src/tabs/Produit.tsx` : bordure constante, couleur variable).

## Critères d'acceptation

- [ ] Survoler une ligne du dropdown ne déplace ni le nom du projet ni son badge.
- [ ] Le bouton « × » reste cliquable au survol et la confirmation en deux temps marche.
- [ ] Masqué, le bouton n'est ni tabulable ni lu par un lecteur d'écran.
