---
{
  "id": "T-0160",
  "titre": "Attribution des commits en quatre étages",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "hooks",
    "multi-session"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "m"
}
---

## Contexte

`attachCommit()` (`hooks/ovrsee-post-commit.js:65-84`) rattache au pointeur global, sans
savoir quelle session a commité — c'est la source directe des tickets soldés sous le
mauvais plan. `avancerTicketsDuPlan()` (`:106`) enchaîne ensuite sur les tickets de ce
plan-là.

`CLAUDE_CODE_SESSION_ID` est exporté dans l'environnement de l'outil Bash : un `git commit`
passé par Claude transmet donc la session à son hook `post-commit`. Un commit fait depuis un
terminal externe ne l'a pas — d'où les étages de repli.

## Critères d'acceptation

- [ ] Ordre d'attribution : (1) `T-\d{4}` cité dans le message → son plan, (2) le plan de
      `CLAUDE_CODE_SESSION_ID`, (3) l'unique plan actif s'il n'y en a qu'un, (4) rien.
- [ ] L'étage 4 écrit sur stderr pourquoi rien n'a été rattaché.
- [ ] Le repli « un seul ticket en vol » de `avancerTicketsDuPlan` ne s'applique jamais
      quand le plan vient de l'étage 3 — deviner le plan et le ticket, c'est deux paris.
- [ ] Test : deux plans actifs, message sans ticket → aucun rattachement.
