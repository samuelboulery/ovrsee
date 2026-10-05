---
{
  "id": "T-0269",
  "titre": "Appliquer la revue de la PR #132",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "hooks",
    "doc"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-pr-132-appliquer-la-revue-bloquants-suggestions.md",
  "fait": "2026-10-05T10:17:06.267Z"
}
---

## Contexte

La revue de la PR #132 (`avancerTicketsCites`) demande deux corrections de
documentation avant merge, et propose cinq améliorations : prédicat « en vol »
commun, regex de citation partagée, ticket au plan inexistant, trace des tickets
soldés, tests d'idempotence et de board sans `en-cours`.

## Critères d'acceptation

- [ ] `SKILL.md` et `CLAUDE.md` disent qu'un commit qui cite un ticket ad hoc le
  clôt, et qu'un commit intermédiaire ne le cite pas.
- [ ] Un seul prédicat « en vol » et une seule regex de citation dans `hooks/`.
- [ ] Un ticket dont le plan n'existe pas est soldé par sa citation.
- [ ] Le post-commit nomme sur stderr les tickets qu'il solde.
- [ ] Le gate nomme le ticket actif soldé au lieu de « ni plan actif ni ticket actif ».
- [ ] `pnpm test` vert.
