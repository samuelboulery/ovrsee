---
{
  "id": "T-0162",
  "titre": "L'interface montre tous les plans actifs",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "m"
}
---

## Contexte

`snapshot()` (`hooks/snapshot.js:393-411`) rend `activePlan: string | null`. Avec un
pointeur par session, plusieurs plans peuvent être actifs en même temps — et le serveur, qui
n'appartient à aucune session, ne peut pas honnêtement en désigner un seul.

## Critères d'acceptation

- [ ] `snapshot()` rend `activePlans: string[]`.
- [ ] Le motif `plan.file === activePlan` devient `activePlans.includes(plan.file)` dans
      `app/src/data.ts`, `tabs/Apercu.tsx`, `tabs/Historique.tsx`, `tabs/Sante.tsx`.
- [ ] La barre de menu (`app/src/menubar.ts`) prend le premier plan actif, à défaut le
      premier plan ouvert.
- [ ] `pnpm typecheck` et `pnpm build:ui` verts ; `menubar.test.ts` suit le renommage.
