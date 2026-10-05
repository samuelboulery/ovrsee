---
{
  "id": "T-0274",
  "titre": "Lot 4 — /api, MCP et Vite : plantage, ReDoS, liens, oracle cross-site",
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
  "fait": "2026-10-05T12:22:59.198Z"
}
---

## Contexte

Un GET cross-site sur un dossier fait tomber `pnpm dev` (EISDIR) ; des regex de `whys.js` et `vault.js` figent l'app sur une ligne pathologique ; les lectures suivent les liens symboliques ; un GET sans Origin sert d'oracle.

## Critères d'acceptation

- [ ] `/api/shot` sur un dossier rend une 4xx et le serveur vit ; `resolve()` ne lève jamais jusqu'à l'hôte.
- [ ] Les entrées pathologiques passent sous 50 ms.
- [ ] Aucune lecture ne sort de sa base par un lien.
- [ ] `Sec-Fetch-Site: cross-site` → 403 ; `X-Ovrsee` porte un jeton aléatoire ; `server.cors: false`.
