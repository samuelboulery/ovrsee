---
{
  "id": "T-0199",
  "titre": "Le test i18n de l'interface recopie le dictionnaire",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "xs",
  "tags": ["i18n", "test", "dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`app/src/i18n.test.ts` ouvre sur un tableau de ~300 clés écrites à la main
(lignes 8 à 95) pour vérifier ensuite que chacune existe en français et en
anglais. C'est une troisième copie du même trousseau, après `hooks/i18n.js` et
`hooks/i18n.d.ts` — et celle-ci ne casse pas quand on oublie de l'alimenter :
une clé jamais listée n'est jamais testée. Le test donne donc une couverture
qu'il n'a pas.

`hooks/i18n.test.js` fait déjà la vérification de parité fr/en sur les clés
réelles. Ce qui reste ici de propre à l'interface : la substitution de
paramètres et la langue par défaut.

## Critères d'acceptation

- [ ] Le tableau littéral de clés est remplacé par `Object.keys(translations.fr)`,
      ou le cas de test est supprimé s'il fait double emploi avec `hooks/i18n.test.js`.
- [ ] Les tests de substitution de paramètres et de langue courante sont conservés.
- [ ] `pnpm test` passe.
