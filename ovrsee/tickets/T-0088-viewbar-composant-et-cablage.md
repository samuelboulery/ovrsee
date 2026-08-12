---
{
  "id": "T-0088",
  "titre": "ViewBar — nouveau composant, câblage breadcrumb+méta, suppression des h2 de page",
  "colonne": "fait",
  "priorite": "moyenne",
  "epic": "T-0084",
  "tags": [
    "design",
    "chassis"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

La barre de vue (46px) de la maquette — fil d'Ariane + méta + zone de
contrôles contextuels — n'existe pas dans le code. Chaque onglet réinvente son
propre `<h2>` `--font-heading` 500/19px hors échelle typographique. Dépend de
T-0085. La zone de contrôles contextuels (segmenté de sous-vue, chips, action
primaire propres à chaque écran) reste hors périmètre de ce ticket — squelette
structurel seulement, le contenu fin par écran est un chantier séparé.

## Critères d'acceptation

- [ ] Composant `ViewBar` créé : hauteur 46, `padding: 0 16px`,
      `border-bottom: 1px solid #17181d`, pas de fond propre. Fil d'Ariane
      `projet / Vue` + méta mono 11px `#4e5158`.
- [ ] Câblé avec breadcrumb + méta (texte littéral de l'audit §3.3) sur
      Navigateur, Produit, Historique, Tableau, Données, Stack, Aperçu.
- [ ] `<h2>` de page et leur ligne d'aide supprimés dans `Historique.tsx`,
      `Tableau.tsx`, `Produit.tsx`, `Stack.tsx`, `Donnees.tsx`.
- [ ] Le titre 21/600 de l'Aperçu (nom du projet) reste inchangé — seul
      titre de cette taille restant dans l'app.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome des sept
      vues.
