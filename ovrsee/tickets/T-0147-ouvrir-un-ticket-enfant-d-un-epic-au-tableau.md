---
{
  "id": "T-0147",
  "titre": "Ouvrir un ticket enfant d'un epic au tableau",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": ["ui", "bug"],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": null
}
---

## Contexte

Issue #9. Au tableau, cliquer un ticket rattaché à un epic ouvre l'epic, pas le
ticket. La carte enfant est rendue *dans* le `<div>` de la carte de son epic
(`Carte` s'appelle récursivement via `enfantsIci`) : le clic remonte au parent,
dont le `onClick` s'exécute ensuite et gagne.

Le `onDragStart` a le même défaut, non signalé dans l'issue : glisser un enfant
laisse le parent réécrire `dataTransfer` avec son propre fichier, et c'est
l'epic qui change de colonne.

## Critères d'acceptation

- [ ] Cliquer une carte enfant imbriquée sous son epic ouvre le panneau du
      ticket enfant.
- [ ] Glisser une carte enfant vers une autre colonne déplace l'enfant, pas
      l'epic.
