---
{
  "id": "T-0301",
  "titre": "Plus aucune chaîne d'interface hors du catalogue de traduction",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "i18n"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "charge": "m"
}
---

## Contexte

Des chaînes françaises en dur restent affichées en anglais : `App.tsx:823`, `Shell.tsx:643`, `Illisibles.tsx`, `EquipmentPanel.tsx:37`, `Terminal.tsx:490`, `Donnees.tsx:388`, `useTerminal.ts:157` ; `StatusBar.tsx` et `PreferencesProfils.tsx` n'appellent jamais `t()`.

## Critères d'acceptation

- [ ] Ces chaînes passent par `t()` avec leur traduction anglaise.
- [ ] Un test échoue sur un littéral accentué dans un JSX de `app/src` hors catalogue.
