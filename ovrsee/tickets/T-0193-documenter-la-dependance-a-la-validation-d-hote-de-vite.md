---
{
  "id": "T-0193",
  "titre": "Documenter la dépendance à la validation d'hôte de Vite",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "documentation",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-31",
  "plan": "2026-08-20-audit-de-securite-complet-findings-et-correctifs.md",
  "charge": "xs"
}
---

## Contexte

Audit de sécurité du 2026-08-20, finding différé.

Ce qui protège le dev server du DNS rebinding n'est pas notre code : c'est
`hostValidationMiddleware` de Vite, posé **avant** les hooks `configureServer` —
donc avant notre middleware `/api`. Sans lui, un domaine qui se rebinde sur
127.0.0.1 devient même origine que l'interface, et la garde d'origine tombe avec
la politique CORS.

Deux gestes anodins la lèvent en silence : poser `server.host` dans
`vite.config.js`, ou élargir `server.allowedHosts`. Rien dans le dépôt ne dit
aujourd'hui qu'ils ont ce prix.

## Critères d'acceptation

- [ ] `CLAUDE.md` nomme la dépendance, dans « Pièges connus ».
- [ ] Le commentaire de `vite.config.js` dit ce que `host` et `allowedHosts`
      coûtent avant qu'on les touche.
