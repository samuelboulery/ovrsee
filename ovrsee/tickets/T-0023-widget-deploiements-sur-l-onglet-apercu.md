---
{
  "id": "T-0023",
  "titre": "Widget Déploiements sur l'onglet Aperçu",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "integrations",
    "frontend",
    "charge-m"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-integrations-deploiements-base-de-donnees-apercu-donnees.md",
  "epic": "T-0021"
}
---

## Contexte

Affichage lecture-seule des intégrations configurées, avec vérification
manuelle du statut. Dépend de T-0022 (stockage + IPC).

## Critères d'acceptation

- [ ] `app/src/tabs/Deploiements.tsx`, calqué sur `Environnements.tsx` : une
      carte par intégration (fournisseur, libellé, lien, badge de statut,
      bouton Vérifier).
- [ ] Pas de polling automatique — le statut ne se rafraîchit que sur clic.
- [ ] Rendu dans `Apercu.tsx` à côté de `<Environnements />`.
- [ ] En mode `pnpm dev` (sans `window.ovrsee.integrations`) : libellés/liens
      affichés via `/api/integrations`, bouton Vérifier désactivé avec un
      message explicite.
- [ ] `pnpm test` et `pnpm typecheck` verts.
