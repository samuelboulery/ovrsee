---
{
  "id": "T-0277",
  "titre": "Lot 7 — release : build sans droit d'écriture, attestation, empreintes",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "m"
}
---

## Contexte

Tout le job de build de `release.yml` a `contents: write` et `GH_TOKEN` ; l'empreinte de `SECURITY.md` est en base64 et invérifiable avec `shasum`.

## Critères d'acceptation

- [ ] Le build tourne en `contents: read` ; seul un job `publish` écrit.
- [ ] Une attestation de provenance est publiée ; `SECURITY.md` explique `gh attestation verify` et un `SHA256SUMS` hexadécimal.
- [ ] `workflow_dispatch` ne publie rien depuis une branche.
