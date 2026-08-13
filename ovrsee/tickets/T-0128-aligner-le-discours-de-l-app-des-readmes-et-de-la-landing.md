---
{
  "id": "T-0128",
  "titre": "Aligner le discours de l'app, des READMEs et de la landing",
  "colonne": "en-cours",
  "priorite": "haute",
  "charge": "l",
  "epic": "T-0123",
  "tags": [
    "contenu",
    "i18n"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

L'app et les READMEs disent « vue en lecture seule » — l'invariant technique,
pas la promesse. La landing dit « gestion de projet pour Claude Code » et tient
trois principes autrement plus clairs.

Trois erreurs factuelles à corriger d'abord, l'alignement allant de l'app vers
la landing et jamais l'inverse : la landing et les badges annoncent 3
dépendances de production alors que `package.json` en déclare 4 ; la landing et
`README.md:215` affirment que le dépôt est privé, ce qui deviendra faux.

La copie est centralisée dans `hooks/i18n.js` — 53 clés `welcome.*` et
`onboard.*` en deux langues. Aucun composant à toucher.

## Critères d'acceptation

- [ ] Plus aucune mention de « 3 dépendances » ni de « dépôt privé » dans la
      landing, les deux READMEs et `CLAUDE.md`.
- [ ] Les clés `welcome.*` et `onboard.*` de `hooks/i18n.js` portent le
      vocabulaire de la landing, en français et en anglais.
- [ ] L'onboarding lu dans l'app lancée dit la même chose que la landing, dans
      les deux langues.
