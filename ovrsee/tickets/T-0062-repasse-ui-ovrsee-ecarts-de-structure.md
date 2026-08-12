---
{
  "id": "T-0062",
  "titre": "Repasse UI ovrsee — écarts de structure, pas seulement de style",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "type": "epic"
}
---

## Contexte

Le chantier précédent (T-0058) a corrigé police/pictos/palette/onboarding et un audit
visuel par capture d'écran — assez pour attraper des tokens et libellés faux, pas
assez pour voir qu'un panneau entier de la maquette est absent du code. Trois agents
ont relu le HTML brut de `Ovrsee App.dc.html` (structure DOM, largeurs, imbrication)
contre le code React ligne à ligne : plusieurs écrans n'ont pas le même squelette de
mise en page, pas juste des couleurs différentes.

Écarté de ce chantier (décidé avec l'utilisateur) : le diagramme ER de Données (vue
pleine, 2m) — nouvelle visualisation, chantier séparé — et la vue Liste de Produit —
nouvelle fonctionnalité, écartée comme le reste du Phase 2.

## Critères d'acceptation

- [ ] T-0063 à T-0068 tous en colonne finale.
- [ ] Comparaison visuelle directe à la maquette ne fait plus apparaître d'écart de
      *structure* (panneaux absents, contenu mal placé) sur Aperçu, Navigateur,
      Historique, Préférences, Onboarding, Produit.
