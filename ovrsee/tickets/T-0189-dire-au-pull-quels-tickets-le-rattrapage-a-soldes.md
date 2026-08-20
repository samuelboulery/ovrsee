---
{
  "id": "T-0189",
  "titre": "Dire au pull quels tickets le rattrapage a soldés",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": ["hooks"],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
  "plan": "2026-08-20-corriger-les-trois-issues-ouvertes.md",
  "charge": "s"
}
---

## Contexte

Issue #29. `reconcile()` tourne à chaque `git pull` et solde des tickets d'après
le texte de messages de commit venus du remote. La portée est étroite —
`avancerTicketsDuPlan` ne touche que les tickets déjà en vol et liés à un plan
ouvert local : un message hostile ne fabrique rien et ne solde rien du backlog.
Mais le mouvement est **muet**, et un ticket soldé à tort ne se découvre que
dans le tableau.

Arbitrage retenu : garder le comportement — c'est la raison d'être de T-0186 —
et rendre la limite visible, comme le dépôt le fait déjà pour `signalInstalle`
et les avertissements de `planFrom`.

## Critères d'acceptation

- [ ] `avancerTicketsDuPlan()` retourne les identifiants des tickets déplacés
      (ses deux appelants ignorent aujourd'hui la valeur : non cassant).
- [ ] La ligne écrite sur stderr par `reconcile()` nomme le plan **et** les
      tickets soldés.
- [ ] Un test de `hooks/reconcile.test.js` constate le ticket dans la trace.
- [ ] CLAUDE.md consigne ce piège, et celui de la trace de crawl (T-0187), dans
      « Pièges connus ».
