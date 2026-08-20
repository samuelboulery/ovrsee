---
{
  "id": "T-0192",
  "titre": "Signer et notariser le paquet macOS",
  "colonne": "backlog",
  "priorite": "basse",
  "tags": [
    "empaquetage",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
  "plan": "2026-08-20-audit-de-securite-complet-findings-et-correctifs.md",
  "charge": "m"
}
---

## Contexte

Audit de sécurité du 2026-08-20, finding différé.

`electron-builder.yml` porte `identity: null` : le DMG n'est ni signé ni
notarisé, et le commentaire le dit — usage personnel, Gatekeeper se contourne au
premier lancement. Rien à corriger tant que la distribution reste ce qu'elle est.

Ce qui rend l'attente tenable : il n'y a **pas d'auto-updater**. Un binaire non
signé ne se met pas à jour tout seul depuis une source qu'on ne vérifie pas. Le
jour où l'un des deux change, l'autre doit changer avec.

## Critères d'acceptation

- [ ] `release.yml` signe et notarise le DMG à partir de secrets de dépôt.
- [ ] Un DMG téléchargé depuis Releases s'ouvre sans contournement Gatekeeper.
- [ ] Le lien avec l'absence d'auto-updater est écrit quelque part qu'on relit.
