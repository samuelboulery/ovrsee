---
{
  "id": "T-0022",
  "titre": "Stockage, chiffrement et IPC des secrets d'intégration",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "integrations",
    "electron",
    "securite",
    "charge-xl"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-integrations-deploiements-base-de-donnees-apercu-donnees.md",
  "epic": "T-0021"
}
---

## Contexte

Fondation de l'epic intégrations : aucun secret ne doit passer par `/api/*`
(HTTP local non-authentifié) ni atterrir dans `<repo>/ovrsee/` (versionné
git). Le précédent du terminal (IPC Electron, pas de socket) s'applique aux
tokens Vercel/Netlify/Supabase.

## Critères d'acceptation

- [ ] `hooks/integrations.js` (module pur, mirroring `hooks/settings.js`) lit
      et écrit `~/.claude/ovrsee/integrations.json`, clé par chemin de
      projet ; aucun accès réseau ni chiffrement dans ce module.
- [ ] `hooks/integrations.test.js` couvre l'aller-retour, la validation par
      champ, et un fichier corrompu → liste vide sans lever.
- [ ] `electron/integrationProviders.js` expose `checkVercel`,
      `checkNetlify`, `checkSupabase` : prennent un token déjà déchiffré,
      renvoient un statut normalisé `{state, detail, checkedAt}`. Zéro
      nouvelle dépendance (fetch natif).
- [ ] `electron/main.js` expose `ipcMain.handle('integrations:list' | 'save'
      | 'remove' | 'checkStatus', ...)` ; `save` chiffre le token via
      `safeStorage.encryptString` avant écriture ; `checkStatus` déchiffre,
      appelle le fournisseur, ne renvoie jamais le token en clair au
      renderer.
- [ ] `electron/preload.cjs` expose `window.ovrsee.integrations.{list, save,
      remove, checkStatus}`.
- [ ] `server/api.js` expose `GET /api/integrations?path=...` (trois hôtes),
      renvoie `[{id, provider, label, url, hasToken}]` — jamais le champ
      chiffré.
- [ ] `~/.claude/ovrsee/integrations.json` n'apparaît jamais dans `git
      status` d'un dépôt observé, et son champ token n'est pas en clair.
- [ ] `cadrage-ovrsee.md` et `CLAUDE.md` mis à jour (périmètre + corollaire
      IPC-only, voir plan lié).
- [ ] `pnpm test` et `pnpm typecheck` verts.
