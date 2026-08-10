---
{
  "id": "T-0016",
  "titre": "Effacer les captures orphelines de l'onglet Backlog",
  "colonne": "fait",
  "priorite": "basse",
  "tags": ["menage", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`cockpit/pages/shots/backlog/` contient 18 captures, 1,7 Mo, d'une route qui
n'existe plus : l'onglet Backlog est devenu l'onglet Tableau. Le crawl ne les
régénère plus, l'interface les signale déjà — « 1 capture sans page » en bas de
l'onglet Produit — et personne ne les regardera.

Elles sont versionnées, donc l'historique git les garde de toute façon : les
effacer ne perd rien d'irréversible.

Le ticket vaut surtout pour la question qu'il pose : le crawl signale les captures
orphelines mais ne propose rien. Un cockpit qui tourne un an sur un projet dont
les écrans changent de nom accumule ça en silence.

## Critères d'acceptation

- [ ] `cockpit/pages/shots/backlog/` n'existe plus dans l'arbre de travail.
- [ ] L'onglet Produit ne signale plus de capture sans page.
- [ ] Décidé, et écrit quelque part : le crawl efface-t-il les dossiers orphelins,
      ou se contente-t-il de les signaler ? (Aujourd'hui il signale sans effacer,
      volontairement — le confirmer ou le changer.)
