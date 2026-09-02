---
{
  "id": "T-0243",
  "titre": "Audit pré-release 1.2.0",
  "type": "epic",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": ["audit", "release"],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md"
}
---

## Contexte

Dernière release : `1.1.2-beta` (2026-08-31). Depuis, 22 commits — thème clair
(T-0218, T-0242), image de ticket (T-0219), barre de menu (T-0217), second
dégraissage (T-0232). Avant de sortir de bêta en `1.2.0`, repasse complète en
huit lots parallèles : sécurité des frontières nées depuis les audits d'août,
robustesse du Node non typé, performance mesurée, accessibilité, typage,
architecture et invariants, tests et couverture, documentation et versions.

Chaque constat retenu devient un enfant de cet epic, avec `fichier:ligne`,
preuve, correctif et effort. Les hypothèses infirmées sont consignées ici, pour
qu'on n'y revienne pas.

## Critères d'acceptation

- [ ] Chaque enfant S1/S2 est soldé, ou explicitement différé avec la raison.
- [ ] `CHANGELOG` 1.2.0 rédigé (en + fr), `SECURITY.md` conforme au dépôt.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build:ui`, `pnpm test` verts, constatés.
- [ ] Tag `v1.2.0` posé après merge, CI de release verte.

## Hypothèses infirmées

_(rempli à la consolidation)_
