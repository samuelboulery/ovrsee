---
{
  "id": "T-0271",
  "titre": "Lot 1 — un lien symbolique scans.jsonl ne fait plus exécuter de code",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "m",
  "fait": "2026-10-05T12:22:06.747Z"
}
---

## Contexte

Un `ovrsee/pages/scans.jsonl` versionné en lien vers `.git/hooks/post-commit` reçoit une ligne contenant le `baseUrl` brut du dépôt (`$(…)`), exécutée au commit suivant, sans accord `trust.json`.

## Critères d'acceptation

- [ ] Toute écriture sous `ovrsee/` refuse un lien symbolique, sur la cible comme sur un dossier ancêtre (`O_NOFOLLOW` + `realpath`).
- [ ] Le message `baseUrl invalide` ne cite plus la valeur.
- [ ] `pruneShots` ne supprime que les PNG au nom daté.
- [ ] Tests rouges puis verts, et repro jetable de la chaîne avant/après.
