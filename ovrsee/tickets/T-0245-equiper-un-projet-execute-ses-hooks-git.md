---
{
  "id": "T-0245",
  "titre": "Équiper un projet exécute ses hooks git",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

L'option « premier commit » de l'équipement lance `git add -A` puis
`git commit`. Sans `--no-verify`, git exécute les `.git/hooks/pre-commit` et
`commit-msg` du dépôt observé — du code de ce dépôt, lancé par l'application,
hors terminal et hors crawl. Le chemin part de l'interface (`/api/projects`,
action `init`).

## Critères d'acceptation

- [x] Le commit d'amorçage n'exécute aucun hook du dépôt observé.
- [x] Un test pose un `pre-commit` piégé et vérifie qu'il ne tourne pas.
