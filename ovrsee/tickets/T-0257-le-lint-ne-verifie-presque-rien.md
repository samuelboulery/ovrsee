---
{
  "id": "T-0257",
  "titre": "Le lint ne vérifie presque rien",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "dette"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

La configuration du linter ne déclare aucune règle ni aucun plugin : `pnpm lint`
passe sur sept dossiers sans rien vérifier de spécifique à React ou TypeScript.
Activer les plugins React remonte 39 signalements, dont une majorité de
dépendances d'effet incomplètes **volontaires** — le dépôt pratique la lecture
fraîche au déclenchement, documentée à trois endroits seulement sur dix.

La catégorie « suspicious » en remonte 52 de plus, surtout du renommage.

## Critères d'acceptation

- [ ] Les plugins React sont activés, et les cas volontaires portent une annotation qui dit pourquoi.
- [ ] `pnpm lint` reste vert.
