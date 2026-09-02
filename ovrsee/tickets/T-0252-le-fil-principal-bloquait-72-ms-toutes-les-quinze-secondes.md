---
{
  "id": "T-0252",
  "titre": "Le fil principal bloquait 72 ms toutes les quinze secondes",
  "colonne": "fait",
  "priorite": "haute",
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

Mesuré, pas supposé : `snapshot()` prend **72 ms** en médiane sur ce dépôt,
dont 44 ms en cinq commandes git synchrones. Dans Electron il est calculé sur
le **fil principal** — `protocol.handle` appelle `resolve()` de façon
synchrone. Pendant ces 72 ms, l'écho du terminal et l'ouverture d'un menu
attendent. Le tour se répétait toutes les 15 s, fenêtre masquée comprise.

Un second poll (4 s) rapporte 386 ko dont 309 ko de corps de tickets que le
Kanban n'affiche pas.

Mesuré aussi : `cat` d'un fichier de 4 Mo produit **4 081 morceaux** d'un
kilo-octet, donc 4 081 messages, chacun suivi d'un scan d'attention et d'une
écriture xterm.

## Critères d'acceptation

- [x] Les deux rafraîchissements ne tournent plus fenêtre masquée, et rattrapent au retour.
- [x] Les données du terminal sont regroupées au tour de boucle suivant, sans retard perceptible.
- [ ] Reste à faire : mémoïser les commandes git sur la date de `.git/HEAD` et `.git/index`, et sortir le corps des plans et des tickets des deux réponses de poll. Effort M, mesuré à 44 ms et 1,7 Mo.
