---
{
  "id": "T-0067",
  "titre": "Onboarding — châssis de gauche absent, grille de bascules par vue manquante à l'étape 2",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "onboarding"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/Onboarding.tsx` : deux écarts.

1. **Châssis** : la maquette (2j) a une colonne de gauche fixe (300px) — logo, les 3
   étapes en indicateurs (coche/numéro courant/numéro à venir) avec leur titre, note
   d'aide en bas. Le code actuel n'a qu'un en-tête horizontal avec 3 puces rondes sans
   titre. Réutilise le `Logo` de `OnboardingArt.tsx` déjà écrit.
2. **Étape 2 incomplète** (vérifié ligne à ligne dans `Ovrsee App.dc.html:1774-2013`) :
   la maquette empile deux blocs — la galerie de 4 préréglages (déjà construite,
   T-0060) **puis** une grille 2×3 de bascules par vue (Aperçu toujours actif et
   désactivé, Navigateur/Produit/Historique/Tableau actifs, Données décoché avec le
   sous-texte « aucune source détectée »). Second niveau de réglage absent du code
   actuel, qui s'arrête à la galerie. Écrit sur `brouillon.onglets`, même mécanisme
   que `SectionInterface` des Préférences — à réutiliser, pas réinventer.

## Critères d'acceptation

- [ ] Colonne de gauche fixe (300px) : logo, 3 indicateurs d'étape avec titre, note
      d'aide en bas — remplace l'en-tête horizontal actuel à puces.
- [ ] Étape 2 affiche la galerie de préréglages puis, en dessous, la grille 2×3 de
      bascules par vue, écrivant sur `brouillon.onglets`.
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle dans Chrome contre `Ovrsee App.dc.html#2j`.
