---
{
  "id": "T-0169",
  "titre": "Renommer un terminal",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "ui",
    "terminal"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "epic": "T-0164"
}
---

## Contexte

Issue #20 : « shell 1 », « shell 2 », « shell 3 » ne se distinguent pas. Le
label d'une `Session` existe déjà (`useTerminal.ts:124`), il n'est simplement
jamais modifiable.

## Critères d'acceptation

- [ ] Un double-clic sur le libellé d'un onglet le passe en saisie ; `Enter`
      valide, `Escape` annule.
- [ ] Un nom vide laisse l'ancien en place.
- [ ] Le nom tient après une bascule de projet et retour.
- [ ] L'onglet Claude se renomme aussi ; seule sa fermeture reste interdite.
