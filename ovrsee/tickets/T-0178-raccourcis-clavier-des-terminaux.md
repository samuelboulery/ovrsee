---
{
  "id": "T-0178",
  "titre": "⌘W et ⌘D s'appliquent aux terminaux",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "ui",
    "terminal",
    "electron"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-en-tete-du-panneau-tags-d-etat-raccourcis-du-terminal.md"
}
---

## Contexte

⌘W ferme la fenêtre même quand on tape dans un terminal, et rien n'ouvre un
terminal de plus au clavier. Le verrou est architectural : un accélérateur de
menu natif est traité par le processus principal et n'atteint jamais le rendu —
tant que `role: 'close'` porte ⌘W, l'interface ne peut rien y faire.

## Critères d'acceptation

- [ ] ⌘W ferme l'onglet quand un terminal a le focus et que l'onglet est
      fermable ; sinon il ferme la fenêtre.
- [ ] ⌘W sur la session Claude ne ferme rien : elle n'est pas fermable.
- [ ] ⌘D ouvre un terminal de plus, et l'article existe dans le menu Affichage.
