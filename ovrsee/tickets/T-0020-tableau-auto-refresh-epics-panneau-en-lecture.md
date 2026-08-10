---
{
  "id": "T-0020",
  "titre": "Tableau : auto-refresh, dissociation visuelle des epics, panneau en lecture",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "charge": "M",
  "tags": [
    "ui",
    "tableau"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-tableau-auto-refresh-dissociation-visuelle-des-epics-panneau.md"
}
---

## Contexte

Le skill `ovrsee-tickets` écrit `ovrsee/tickets/*.md` et `ovrsee/board.json`
sur disque, hors de l'app — l'onglet Tableau ne le voit qu'au clic sur
reload. Deux lacunes connexes sur le même onglet : les epics ne se
distinguent pas assez d'un ticket normal (leurs enfants peuvent être
dispersés n'importe où dans la colonne), et cliquer une carte ouvre tous les
champs en édition alors qu'un coup d'œil devrait suffire à lire un ticket.

Détail de l'approche dans le plan lié.

## Critères d'acceptation

- [ ] Un ticket créé sur disque (skill ou édition directe) apparaît dans
      l'onglet Tableau sans clic sur reload, en quelques secondes.
- [ ] Une carte epic se distingue visuellement d'une carte normale (bordure
      et fond teintés, en plus du tag « epic » existant).
- [ ] Une carte enfant d'un epic porte un liseré coloré, et se retrouve
      regroupée juste après son epic quand les deux sont dans la même
      colonne.
- [ ] Cliquer une carte ouvre le panneau de détail en lecture (pas de champ
      éditable visible) ; un bouton « Modifier » bascule vers le formulaire
      d'édition actuel.
- [ ] `pnpm test` passe toujours.
