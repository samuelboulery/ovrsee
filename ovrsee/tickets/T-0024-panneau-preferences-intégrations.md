---
{
  "id": "T-0024",
  "titre": "Panneau Préférences pour ajouter/éditer une intégration",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "integrations",
    "frontend",
    "charge-l"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-integrations-deploiements-base-de-donnees-apercu-donnees.md",
  "epic": "T-0021"
}
---

## Contexte

Ajout/édition/suppression d'une intégration (fournisseur, libellé, URL,
token write-only). Dépend de T-0022, et s'insère dans la section Projet de
la refonte Préférences en cours (deux plans ouverts : « cinq sections, et
des templates d'interface » et « refonte de l'écran des préférences ») —
brancher sur celui des deux qui atterrit en premier.

## Critères d'acceptation

- [ ] `app/src/PreferencesIntegrations.tsx` : formulaire fournisseur
      (Vercel/Netlify/Supabase/Autre), libellé, URL, token — le token ne se
      réaffiche jamais après enregistrement.
- [ ] Suppression d'une intégration.
- [ ] Branché dans la section Projet de Préférences, quel que soit le plan
      de refonte qui a atterri en premier.
- [ ] `pnpm test` et `pnpm typecheck` verts.
