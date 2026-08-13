---
{
  "id": "T-0123",
  "titre": "Professionnaliser le dépôt avant le passage en public",
  "colonne": "en-cours",
  "priorite": "haute",
  "type": "epic",
  "charge": "xl",
  "tags": ["infra", "release"],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Le dépôt va passer public, historique compris. Il n'a aucune CI : le seul
workflow se déclenche sur tag, et c'est pour ça que cinq tests cassaient sous
Windows depuis des semaines sans que rien ne puisse le révéler. Il manque aussi
tout ce qu'un dépôt public suppose — licence, politique de sécurité, guide de
contribution — et une barrière qui empêche de pousser n'importe quoi sur `main`.

Une landing page écrite avec Claude Design existe déjà et porte un discours plus
net que celui de l'app et des READMEs. Elle devient la référence, une fois ses
erreurs factuelles corrigées.

## Critères d'acceptation

- [ ] Les huit tickets enfants sont en colonne finale.
- [ ] Un `git push origin main` est refusé par GitHub, constaté et non supposé.
- [ ] Le site répond et ses liens de téléchargement pointent sur `v1.0.0-beta`.
- [ ] App, READMEs et site tiennent le même discours, en français comme en anglais.
