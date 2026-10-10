---
{
  "id": "T-0288",
  "titre": "Clore le plan depuis l'interface dit pourquoi il reste ouvert",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ux",
    "plans"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0285",
  "charge": "xs"
}
---

## Contexte

`/api/plans/close-active` appelle `closeOpenPlans(ovrseeDir, () => {})` (`server/api.js:588`) : un plan sans commit renvoie `{closed: []}` et l'interface n'affiche rien, quand le CLI explique « ovrsee:close <plan> --commit <sha> ».

## Critères d'acceptation

- [ ] La réponse porte les lignes de journal de `closeOpenPlans`, et l'interface les affiche.
- [ ] Test d'API : un plan sans commit rend une raison lisible.
