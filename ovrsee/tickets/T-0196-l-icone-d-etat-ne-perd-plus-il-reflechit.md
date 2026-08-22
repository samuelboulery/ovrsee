---
{
  "id": "T-0196",
  "titre": "L'icône d'état ne perd plus « il réfléchit »",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["terminal", "issue-53"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-corriger-les-issues-49-51-et-53.md"
}
---

## Contexte

Issue #53. L'icône retombe au point gris pendant que Claude travaille, par deux
chemins : cliquer sur un onglet efface toute l'attention, `busy` compris, alors que
`busy` est un état en cours et non une notification vue ; et une question à laquelle
on répond au clavier reste en `question` — masquée sur l'onglet actif, donc affichée
en point — jusqu'au `Stop` suivant, aucun `busy` n'étant réémis.

## Critères d'acceptation

- [ ] Cliquer sur l'onglet d'une session au travail laisse les points battre.
- [ ] Cliquer sur un onglet éteint toujours la coche et le point d'interrogation.
- [ ] Répondre au clavier à une demande de permission ramène les points battants.
- [ ] Le `Stop` suivant rend bien la coche.
