---
{
  "id": "E-0270",
  "titre": "Audit sécurité 1.3 — corriger les failles relevées",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "type": "epic",
  "fait": "2026-10-05T12:22:06.740Z"
}
---

## Contexte

Audit de sécurité complet de la 1.3.0 (Electron/IPC, /api + MCP + Vite, hooks/crawl/CI) et 25 alertes Dependabot. Modèle de menace : dépôt observé hostile (clone, zip, clé) et page web tierce pendant `pnpm dev`. Détail et constats dans le plan lié.

## Critères d'acceptation

- [ ] Les sept lots sont livrés, chacun avec ses tests et une passe `security-reviewer`.
- [ ] `pnpm audit` (dev compris) ne remonte rien, les alertes Dependabot sont fermées.
- [ ] Une 1.3.1 est publiée avec un CHANGELOG `### Security`.
