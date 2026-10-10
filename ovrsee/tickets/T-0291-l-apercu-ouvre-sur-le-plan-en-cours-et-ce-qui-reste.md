---
{
  "id": "T-0291",
  "titre": "L'Aperçu ouvre sur le plan en cours et ce qui reste",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "ux",
    "produit"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "epic": "E-0290",
  "charge": "m"
}
---

## Contexte

Les branches occupent la moitié de l'Aperçu ; « dernière activité : aujourd'hui » répète la barre de titre. Le brief `SessionStart` (`hooks/brief.js`) produit déjà en texte ce dont on a besoin en revenant : dernier travail, plans ouverts, tickets restants.

## Critères d'acceptation

- [ ] En tête de l'Aperçu : le plan actif ou le dernier clos (titre, intention, date), puis les tickets restants les plus prioritaires.
- [ ] La liste des branches est repliée par défaut, et n'affiche que celles qui ne sont pas « à jour ».
