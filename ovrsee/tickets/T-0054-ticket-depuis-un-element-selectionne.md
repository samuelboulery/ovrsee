---
{
  "id": "T-0054",
  "titre": "Ticket depuis un élément sélectionné",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "navigateur",
    "tickets",
    "phase-2"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0052"
}
---

## Contexte

Le sélecteur d'élément existe déjà dans Navigateur.tsx. La maquette permet
de créer un ticket directement depuis un élément sélectionné, avec sa
route, son sélecteur CSS et un extrait HTML en contexte. `createTicket()`
(`hooks/tickets.js`) n'a pas ces champs aujourd'hui — à étendre, en même
temps que la route `/api/tickets` via l'unique `resolve()` de
`server/api.js` (jamais dédoublée par hôte).

## Critères d'acceptation

- [ ] Action « Créer un ticket » disponible depuis un élément sélectionné
      dans Navigateur.tsx.
- [ ] Le ticket créé porte route, sélecteur CSS et extrait HTML en
      contexte (frontmatter ou corps, à trancher à l'implémentation).
- [ ] `createTicket()` accepte ces champs optionnels sans casser les
      appels existants qui ne les fournissent pas.
- [ ] Route testée en navigateur ET en Electron (protocole `ovrsee://`
      n'a ni CORS ni les mêmes en-têtes).
