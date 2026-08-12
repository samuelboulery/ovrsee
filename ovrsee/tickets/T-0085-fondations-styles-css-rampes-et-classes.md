---
{
  "id": "T-0085",
  "titre": "Fondations styles.css — rampes, classes, .kicker, switch, touche clavier",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0084",
  "tags": [
    "design",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

`_ds/ovrsee/styles.css` (327 lignes) porte encore la rampe de gris bleutée
(`--color-neutral-*`, `#8799ab`…`#323d48`), un seul jeton de filet
(`--color-divider`) pour quatre rôles distincts dans la maquette, aucun jeton
de statut (`ok/warn/err/info/plan`), pas de `--ring-selected`, pas de
`.kicker` générique (`.card-kicker` existe mais reste en accent). Les classes
`.btn-primary`/`.btn-ghost`/`.seg-opt` portent l'ancienne identité (texte ou
anneau violet). Bloque tout le Lot 2 (le châssis dépend de ces jetons).

## Critères d'acceptation

- [ ] Rampes texte (7 niveaux), filets (4 rôles), surfaces manquantes,
      statuts, `--ring-selected` — valeurs littérales de l'audit §2.1, sans
      dérivation `color-mix`.
- [ ] Plus aucune occurrence de `--color-neutral-` dans `app/src` (`grep -rn`
      vide) — y compris `CommandPalette.tsx`.
- [ ] `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`, `.seg`/`.seg-opt`,
      `.tag-accent`/`.tag-neutral`, `.input`, `.card`, `h1..h4`, `.radio`
      réécrits aux valeurs de l'audit §2.2. Aucun `.btn-primary`/`.btn-ghost`
      en texte violet.
- [ ] `.kicker` ajouté (mono 10-10.5px, uppercase, `#55585f`), distinct de
      `.card-kicker`.
- [ ] Composant switch (28×16) et composant touche clavier (17px, police
      système) ajoutés.
- [ ] `pnpm typecheck && pnpm test` passent.
