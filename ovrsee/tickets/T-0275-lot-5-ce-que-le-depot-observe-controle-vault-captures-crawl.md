---
{
  "id": "T-0275",
  "titre": "Lot 5 — ce que le dépôt observé contrôle : vault, captures, crawl, redaction",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "l",
  "fait": "2026-10-05T13:15:57.169Z"
}
---

## Contexte

`obsidianVault` et `gitignoreShots` vivent dans la config versionnée ; le crawl peut viser n'importe quelle URL ; la session d'auth vit dans le dépôt ; la redaction rate plusieurs formes et s'applique après troncature.

## Critères d'acceptation

- [ ] `obsidianVault` et `gitignoreShots` sont des préférences de poste ; une valeur du dépôt est ignorée.
- [ ] `baseUrl` et `entryRoutes` restent en localhost.
- [ ] La session du crawl vit sous `~/.claude/ovrsee/auth/`.
- [ ] Les nouvelles formes de secrets sont masquées, avant troncature.
