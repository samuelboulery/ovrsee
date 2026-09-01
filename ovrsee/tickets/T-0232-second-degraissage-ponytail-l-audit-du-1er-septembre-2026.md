---
{
  "id": "T-0232",
  "titre": "Second dégraissage ponytail : l’audit du 1er septembre 2026",
  "type": "epic",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "dette",
    "audit"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null
}
---

## Contexte

Second balayage `ponytail` de l'arbre entier, dix jours après [[T-0197]] — même
chasse : code mort, duplication, réimplémentation de ce que la plateforme
fournit. Le dépôt tient bien : cinq dépendances de production qui portent
chacune leur poids, `resolve()` toujours à une seule implémentation pour trois
hôtes, toutes les routes `/api/*` et toute la surface preload consommées.

Ce qui reste est de deux natures, et la distinction compte pour l'ordre :

- **Du mort** — la maquette Nocturne et son design system que plus rien ne
  charge, un module jamais branché, vingt-trois clés de traduction. Suppression
  sèche, risque nul.
- **Du recopié** — `repoRoot()` dans six hooks, huit POST identiques, neuf
  lectures JSON tolérantes, `Titre` quatre fois. Consolidations : à faire tests
  verts en main, jamais à l'aveugle.

Deux constats prolongent des enfants de [[T-0197]] déjà soldés, et c'est ce qui
les rend intéressants : `detect-package-manager.js` a été **amélioré** en T-0205
sans jamais être appelé, et le plafond de 800 lignes rétabli en T-0206 a été
repassé depuis. Une règle qu'aucun test ne tient dérive.

Environ 1 600 lignes à rendre, zéro dépendance. Rien n'est urgent, rien ne
corrige un bug.

## Critères d'acceptation

- [ ] Chaque ticket enfant est soldé ou explicitement écarté avec sa raison.
- [ ] `pnpm test`, `pnpm lint` et `pnpm typecheck` restent verts après chaque enfant.
- [ ] Aucun enfant n'ajoute de dépendance.
