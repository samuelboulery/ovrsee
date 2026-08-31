---
{
  "id": "T-0225",
  "titre": "Panneau des commandes : rétraction sur place et exécution au clic",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "terminal"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-08-31-panneau-des-commandes-retraction-sur-place-et-execution-au-c.md",
  "charge": "m"
}
---

## Contexte

Deux défauts du panneau des commandes livré par T-0216.

**Son bouton de rétraction est ailleurs que lui.** Il vit dans la barre d'outils
du terminal (`app/src/Terminal.tsx:665-686`), et rétracter fait disparaître le
panneau entier (`:783`). Rien ne reste à l'écran pour dire qu'il existe.

**Une commande ne se lance jamais.** `activate` (`:492-513`) colle avec
`pasteTo`, sans valider — y compris `/graphify` et les `!…`. `decideInjection`
est appelé (`:819`) mais seulement pour choisir l'icône : le `+ '\n'` qu'il
produit est jeté. L'interface promet pourtant le contraire, pastille `Play` et
titre « Exécutée au clic ». Et lancer une commande dans un terminal déjà occupé
écraserait ce qui y tourne.

## La limite à écrire, pas à masquer

**Rien dans un pty ne dit de façon fiable qu'une commande y tourne.** Le signal
`busy` vient des hooks de Claude Code ; un `pnpm dev` dans un shell nu n'émet
rien. « Occupé » ne peut donc désigner que ce qu'on a lancé soi-même, plus le
`busy` d'une session Claude. Se tromper coûte un terminal de trop, jamais une
commande écrasée.

## Critères d'acceptation

- [ ] Le bouton de rétraction est dans le panneau des commandes, pas dans la
      barre d'outils du terminal.
- [ ] Rétracté, le panneau devient une bande fine ne contenant que ce bouton ;
      il ne disparaît pas. L'état survit à un redémarrage de l'application.
- [ ] Une commande en mode « exécutée au clic » (préfixe `!` ou `/`) part
      vraiment, sans qu'on ait à appuyer sur Entrée.
- [ ] Une commande en mode « écrite sans envoyer » est collée comme avant, même
      si la session est occupée.
- [ ] Cliquer une commande immédiate alors que la session visée est occupée
      ouvre un nouveau terminal et l'y lance ; l'ancien continue sans être
      touché.
- [ ] Taper dans une session occupée la rend disponible : la commande suivante
      y repart, sans nouvel onglet.
- [ ] La règle de choix de la cible est une fonction pure, testée dans
      `node:test`, y compris le cas « aucun pty » (repli presse-papier).
- [ ] Ce que l'interface annonce au bas du panneau ne dit plus « sans envoyer »
      pour toutes les commandes.
