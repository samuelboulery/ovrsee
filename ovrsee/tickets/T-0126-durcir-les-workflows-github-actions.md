---
{
  "id": "T-0126",
  "titre": "Durcir les workflows GitHub Actions",
  "colonne": "en-cours",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0123",
  "tags": [
    "infra",
    "ci",
    "securite"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Les actions tierces sont référencées par tag mutable : `actions/checkout@v4`
peut désigner un autre commit demain. `release.yml` déclare `contents: write`
au niveau du workflow, donc tous ses jobs l'obtiennent, y compris ceux qui
n'écrivent rien.

Un `concurrency` avec annulation sur la release reproduirait l'accident déjà
vu : un build annulé à mi-envoi laisse une release à moitié remplie.

## Critères d'acceptation

- [ ] Chaque action tierce est épinglée à un SHA, son tag en commentaire.
- [ ] Aucun `permissions` au niveau workflow ; chaque job déclare le sien, `{}`
      par défaut.
- [ ] `concurrency` avec `cancel-in-progress` sur `ci.yml` uniquement.
- [ ] `timeout-minutes` et `persist-credentials: false` partout.
