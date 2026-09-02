---
{
  "id": "T-0250",
  "titre": "Cinq défauts de finition visibles à l'écran",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Revue d'interface sur captures des sept onglets, en clair et en sombre. Le
thème clair tient : la parité de contraste est bonne au pixel près. Ce qui
abîmait cette version était textuel, et visible d'un coup d'œil.

- Les sept vignettes de l'onglet Produit affichaient l'icône « image cassée » :
  le composant lisait un champ `shot` qui n'existe pas dans `pages.json`.
- Le pied de chaque vignette lisait « 14 14 plans » : le gabarit de traduction
  interpole déjà le nombre, et l'appelant le préfixait encore.
- L'écran d'accueil affichait « dernier audit il y a aujourd'hui » : `humanAge`
  porte déjà « il y a », sauf pour aujourd'hui et hier.
- « 1 tickets », « 1 ouverts » : pas de forme singulière.
- Le bandeau d'accord manquant disait « ouvrez Ovrsee », affiché dans Ovrsee.

## Critères d'acceptation

- [x] Les vignettes de l'onglet Produit montrent la capture réelle, vérifié à l'écran.
- [x] Un test de rendu vérifie qu'aucune source d'image ne contient « undefined ».
- [x] Les comptes ne sont plus écrits deux fois, et s'accordent au singulier.
- [x] Le message d'accord nomme le geste qui débloque, sans renvoyer ailleurs.
