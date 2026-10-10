---
{
  "id": "T-0298",
  "titre": "Le brief compte les epics comme des tickets à faire",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "bug",
    "brief"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "charge": "xs",
  "fait": "2026-10-10T15:04:00.063Z"
}
---

## Contexte

`hooks/brief.js:189` filtre sur `t.colonne !== fini`, epics compris, alors que le `colonne` d'un epic est inerte. Le brief annonce donc E-0218 « à faire » alors que ses six enfants sont faits, et compte 14 restants quand l'interface en montre 12.

## Critères d'acceptation

- [ ] Le brief exclut les epics du décompte, ou les juge par `epicEtat`.
- [ ] Test dans `brief.test.js` : un epic dont tous les enfants sont faits n'apparaît pas.
