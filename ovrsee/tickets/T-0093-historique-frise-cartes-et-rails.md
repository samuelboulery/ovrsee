---
{
  "id": "T-0093",
  "titre": "Historique — frise : segmenté vue, cartes de ticket encadrées, rails de bande de plan",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "design",
    "historique"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design, Lot 4 (Historique). Vérifié en relisant `Historique.tsx` :
plusieurs écarts réels, pas de suppositions.

1. `ViewSwitch` (Par tickets / Par commits) : encore deux boutons
   `.btn-primary`/`.btn-ghost` au lieu du `.seg`/`.seg-opt` posé au Lot 1.
2. `DayHeading` : police de corps 11px `--color-neutral-500`, au lieu de
   mono 10.5 capitales `#55585f` + filet `#17181d`.
3. `CommitRow` : le sha est en `var(--color-accent)` (violet) — l'audit est
   explicite, l'accent n'est pas la couleur des commits, doit être `#6ea8fe`.
4. `TicketCard` (dans la frise) : id aussi en accent violet, doit être
   `#62666e`. Plus grave : ce n'est qu'une ligne de texte inline, sans fond
   ni filet — l'audit décrit une vraie carte (rayon 10, padding 11px 12px,
   filet `#1c1d22`/fond `#0c0d10`, variante « en cours » filet `#22232a`/fond
   `#0e0f12`, puce de statut 5px, titre tronqué, heure mono à droite).
5. `PlanBandShell` : rail toujours en accent (`border-left: 2px solid
   var(--color-accent-700)`) + fond en dégradé accent — ne distingue jamais
   un plan actif d'un plan clos. L'audit veut un rail 2px `#2a2660` pour le
   plan actif, `#24252c` sinon ; l'étiquette de statut doit dire « clos par
   {sha} » (neutre) plutôt que juste « clos »/« ouvert » en `.tag-outline` ;
   une méta mono (ex. `3 tickets · 5 commits`) à droite du titre. Nécessite
   de faire descendre `snapshot.activePlan` jusqu'à `PlanBandShell`, absent
   aujourd'hui de la chaîne de props.

## Critères d'acceptation

- [ ] `ViewSwitch` en `.seg`/`.seg-opt` (radio), plus de `.btn-primary`.
- [ ] `DayHeading` : mono 10.5px, capitales, `#55585f`, filet `#17181d`
      en `flex: 1`.
- [ ] Sha de commit : `#6ea8fe`, plus jamais `var(--color-accent)`.
- [ ] `TicketCard` : vraie carte (fond/filet/rayon selon la colonne),
      id `#62666e`, statut visible, structure conforme à l'audit §4.4.
- [ ] `PlanBandShell` reçoit si le plan est actif ; rail et étiquette de
      statut corrects (actif = teinte plan, clos = « clos par {sha} »
      neutre — sha = dernier commit du plan). Méta ticket/commit count
      ajoutée à droite du titre.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome contre
      `Ovrsee App.dc.html#2e`.
