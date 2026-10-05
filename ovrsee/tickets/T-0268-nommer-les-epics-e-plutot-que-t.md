---
{
  "id": "T-0268",
  "titre": "Nommer les epics E- plutôt que T-",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "tickets",
    "issue"
  ],
  "cree": "2026-09-30",
  "maj": "2026-09-30",
  "plan": "2026-09-30-issue-131-nommer-les-epics-e-plutot-que-t.md",
  "fait": "2026-09-30T21:21:41.794Z"
}
---

## Contexte

Issue #131 : Claude parle d'un « ticket » qui est en fait un epic, le préfixe `T-`
commun ne les distingue pas. Les epics prennent `E-`, sur un compteur partagé avec
les tickets : un numéro désigne une seule chose, et les citations anciennes restent
lisibles.

## Critères d'acceptation

- [ ] Un epic créé (UI, CLI, MCP) porte `E-NNNN`, un ticket `T-NNNN`, sur un seul compteur.
- [ ] Cocher « epic » échange le préfixe en gardant le numéro : fichier, images, chemins du corps, champ `epic` des enfants et ticket actif suivent ; décocher fait l'inverse. Le panneau de détail reste ouvert.
- [ ] Un commit qui cite `E-XXXX` est rattaché comme un `T-XXXX`.
- [ ] `pnpm ovrsee:migrate-epics` migre les epics hérités en `T-`, et un second passage ne fait rien.
- [ ] Les 18 epics de ce dépôt sont en `E-`.
