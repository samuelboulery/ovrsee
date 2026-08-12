---
{
  "id": "T-0066",
  "titre": "Préférences — colonne d'aperçu en direct absente",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "preferences"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/PreferencesPanel.tsx` : la modale est `min(860px, 100%)` × `min(600px,
100%)`, contenu en une seule colonne qui défile. La maquette (2i) est `1100×700`,
scindée en deux : contenu réglages à gauche (défile), panneau d'aperçu fixe à droite
(~300px, sans défilement) qui montre `PreferencesPreview` en direct — ce composant
existe déjà (`app/src/PreferencesPreview.tsx`) mais n'est monté nulle part dans la
modale Préférences elle-même.

Réutilisation directe, pas de composant à écrire.

## Critères d'acceptation

- [ ] Modale agrandie (~1100×700) pour accueillir les deux colonnes.
- [ ] Corps scindé : réglages à gauche (scroll), `PreferencesPreview` monté en
      panneau droit fixe (~300px, sans scroll), libellé « Aperçu en direct ».
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle dans Chrome contre `Ovrsee App.dc.html#2i`.
