---
{
  "id": "T-0192",
  "titre": "Signer et notariser le paquet macOS",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "empaquetage",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-22",
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
- [ ] `spctl --assess --verbose` sur l'application installée rend `accepted`.
- [ ] L'identité de signature vient d'un secret de CI, jamais du dépôt.
- [ ] La construction Windows n'est pas touchée.
- [ ] Le lien avec l'absence d'auto-updater est écrit quelque part qu'on relit.

## Relevé le 2026-08-22

L'audit du 2026-08-22 (`2026-08-22-audit-de-cybersecurite-complet-findings-et-correctifs.md`)
remonte la priorité de basse à moyenne, sans changer l'arbitrage de fond. La
raison est étroite : `release.yml` publie déjà des binaires non signés sur
Releases. L'absence d'auto-updater tient toujours, donc rien ne presse — mais
un destinataire qui prend le réflexe de contourner Gatekeeper pour cette
application le prendra pour la suivante.
