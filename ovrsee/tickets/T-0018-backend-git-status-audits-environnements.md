---
{
  "id": "T-0018",
  "titre": "Backend : git-status, journal d'audits, environnements, route git-fetch",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": ["backend", "apercu"],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-dashboard-pour-l-onglet-apercu.md",
  "epic": "T-0017"
}
---

## Contexte

Le dashboard de l'onglet Aperçu (T-0017) a besoin de données qui n'existent
pas encore dans `snapshot()` : état git (branches, ahead/behind, arbre sale),
historique des audits, environnements déclarés.

## Critères d'acceptation

- [ ] `hooks/git-status.js` exporte `gitStatus(root)` (branche courante, arbre
      sale, branches locales avec tracking/ahead/behind, date du dernier
      fetch) — module Node pur, testé, rend un objet vide hors dépôt git
      plutôt que de lever.
- [ ] `hooks/ovrsee-capture-audit.js` ajoute une ligne à
      `ovrsee/audits.jsonl` après un audit détecté, sans jamais bloquer le
      hook en cas d'échec d'écriture.
- [ ] `hooks/snapshot.js` lit `ovrsee/audits.jsonl` (tolérant aux lignes
      cassées, comme `scans()`) et expose `gitStatus` et `audits` dans le
      snapshot.
- [ ] `OvrseeConfig` accepte un champ optionnel `environments` dans
      `ovrsee.config.json`, lu tel quel.
- [ ] `server/api.js` gère `action: 'git-fetch'` sur `/api/projects` : lance
      `git fetch`, renvoie un `gitStatus` à jour.
- [ ] Tests `pnpm test` verts pour `git-status.js` et le parsing des audits.
