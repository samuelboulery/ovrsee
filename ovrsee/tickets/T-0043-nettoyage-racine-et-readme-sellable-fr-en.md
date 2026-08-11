---
{
  "id": "T-0043",
  "titre": "Nettoyage racine (legacy/) et README sellable FR/EN",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "docs",
    "cleanup"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-nettoyage-repo-readme-sellable-fr-en.md"
}
---

## Contexte

Le README existant (FR + EN) est correct mais plat, et son unique capture
embarquée est cassée pour tout clone frais (`ovrsee/pages/shots/...` est
gitignoré, jamais versionné). La racine du repo contient aussi trois
fichiers hors périmètre (`Ovrsee-A-Nocturne.dc.html`, `support.js`,
`AUDIT-2026-08-09.md`) qui l'encombrent visuellement sans être du désordre
fonctionnel.

## Critères d'acceptation

- [ ] `legacy/` créé, `Ovrsee-A-Nocturne.dc.html`, `support.js` et
      `AUDIT-2026-08-09.md` déplacés dedans ; `_ds/` reste à la racine
      (dépendance réelle de `app/src/main.tsx`)
- [ ] Les deux chemins `_ds/...` dans `legacy/Ovrsee-A-Nocturne.dc.html`
      pointent vers `../_ds/...`
- [ ] `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm typecheck` passent après
      le déplacement
- [ ] `docs/screenshots/` versionné contient les 5 captures fournies
      (apercu, historique, produit, tableau, navigateur)
- [ ] README.md et README.en.md réécrits : hero, bandeau de langue,
      galerie de captures, section téléchargement (avec mention dépôt
      privé), table de dépendances complète — sans perdre le contenu
      technique existant (pièges, MCP, note sécurité)
- [ ] Plus aucune référence à l'ancien chemin de capture cassé
