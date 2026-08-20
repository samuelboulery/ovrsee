---
{
  "id": "T-0173",
  "titre": "Les onglets terminal se nomment seuls",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "ui",
    "terminal"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-lire-un-ticket-en-grand-et-rendre-les-terminaux-bavards.md"
}
---

## Contexte

Le renommage manuel existe depuis T-0169, mais personne ne nommera chaque
session à la main. Le signal `busy` porte la demande : l'onglet peut en prendre
les premiers mots.

## Critères d'acceptation

- [ ] Envoyer une demande renomme l'onglet avec ses premiers mots.
- [ ] Un nom saisi au double-clic n'est plus jamais écrasé par l'automatique.
- [ ] Aucune notification système au départ d'une demande.
