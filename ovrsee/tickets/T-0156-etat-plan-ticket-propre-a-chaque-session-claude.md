---
{
  "id": "T-0156",
  "titre": "État plan/ticket propre à chaque session Claude",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "hooks",
    "multi-session"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "type": "epic",
  "charge": "l"
}
---

## Contexte

Plusieurs sessions Claude Code tournent en parallèle sur le même dépôt. L'ovrsee garde
l'état de travail dans deux fichiers uniques par dépôt — `ovrsee/.active-plan` et
`ovrsee/.active-ticket` — que n'importe quelle session écrase.

Quatre symptômes, tous constatés à l'usage, et le dernier pendant la rédaction du plan
lui-même : une session a capturé dans `ovrsee/plans/` le plan d'une session voisine
travaillant sur un autre dépôt.

## Critères d'acceptation

- [ ] Deux sessions approuvent un plan chacune : deux plans `open`, aucune n'a fermé
      celui de l'autre.
- [ ] Chaque session édite du code sans être bloquée par le plan de l'autre.
- [ ] Chaque commit atterrit dans le plan de la session qui l'a produit.
- [ ] Une session qui se termine libère son pointeur sans clore son plan.
- [ ] `pnpm test`, `pnpm typecheck` et `pnpm build:ui` restent verts.
