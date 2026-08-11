---
{
  "id": "T-0036",
  "titre": "Profil sobre : Historique au lieu de Données",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": ["ui", "onboarding", "preferences"],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": null
}
---

## Contexte

Le template « sobre » (`app/src/PreferencesProfils.tsx`, `PROFILS`) active
aujourd'hui `['apercu', 'tableau', 'donnees']`. L'onglet Données n'a pas sa
place dans ce profil minimal ; l'Historique est plus utile.

## Critères d'acceptation

- [ ] Le profil `sobre` active `['apercu', 'tableau', 'historique']` au lieu
      de `['apercu', 'tableau', 'donnees']`.
