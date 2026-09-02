---
{
  "id": "T-0256",
  "titre": "La moitié du paquet initial est un dictionnaire non lu",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "perf"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Mesuré : les 1 412 clés de traduction (706 par langue) occupent **324 ko sur
608 ko** du paquet initial, soit **81 ko sur 165 ko** une fois compressé. La
moitié n'est jamais lue, puisqu'une seule langue s'affiche.

## Critères d'acceptation

- [ ] Les deux langues vivent dans deux modules distincts.
- [ ] Seule la langue résolue est chargée, avant le premier rendu.
- [ ] Mesure avant/après du paquet compressé consignée dans le ticket.
