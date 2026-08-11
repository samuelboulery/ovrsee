---
{
  "id": "T-0028",
  "titre": "Clarté de l'ajout d'un service de déploiement ou de base de données",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["ui", "integrations"],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-rendre-visible-et-clair-l-ajout-de-services-de-deploiement-d.md"
}
---

## Contexte

La carte « Déploiements » de l'onglet Aperçu (`Deploiements.tsx`) retournait
`null` tant qu'aucune intégration n'était configurée : rien, depuis la page
d'accueil, n'indiquait que la fonctionnalité existait ni où aller pour
l'activer (Préférences → Projet → Intégrations). Un utilisateur ayant essayé
d'ajouter Vercel n'a pas compris comment faire.

## Critères d'acceptation

- [x] La carte Déploiements reste visible sur l'Aperçu même sans intégration
      configurée, avec une courte description de ce qu'elle fait.
- [x] Deux boutons dans l'état vide : « Ajouter un service de déploiement »
      et « Ajouter une base de données », ouvrant directement Préférences sur
      la section Projet, provider présélectionné (Vercel / Supabase).
- [x] Un bouton « Masquer » permet de faire disparaître la carte vide,
      persisté (`localStorage`), sans réglage caché à retrouver.
- [x] Dès qu'une intégration existe, la carte affiche la liste normale et
      ignore l'état masqué — elle redevient utile toute seule.
- [x] `pnpm typecheck` et `pnpm test` passent.
