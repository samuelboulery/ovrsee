---
{
  "id": "T-0149",
  "titre": "Abaisser le seuil d'autocompact du contexte",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "xs",
  "tags": [
    "perf",
    "config"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-de-consommation-de-tokens-constats-et-correctifs.md"
}
---

## Contexte

`~/.claude/settings.json` porte `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "70"`. Sur le
modèle `claude-opus-5[1m]`, l'autocompact ne se déclenche donc qu'à 700 000
tokens. Chaque tour paie l'intégralité du contexte accumulé — d'où les 396 k de
moyenne relevés sur la session la plus longue.

À l'équilibre, le contexte moyen vaut environ la moitié du seuil. Passer de 70 %
à 45 % ramène la moyenne de ~350 k à ~225 k. C'est le seul changement de l'epic
à effet multiplicatif : il divise le coût de **chaque tour** de **chaque session
longue**, tous projets confondus. Tout le reste est marginal à côté.

Contrepartie assumée : plus de compactions, donc plus de résumés intermédiaires
et une perte de détail plus fréquente en cours de session longue.

Une ligne à changer, mais celle qui rapporte le plus — d'où la priorité haute
sur une charge `xs`.

## Critères d'acceptation

- [ ] `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` vaut `"45"` dans
      `/Users/sam/.claude/settings.json`.
- [ ] Le changement est répercuté dans `/Users/sam/code/claude-config/claude/`,
      qui est la source versionnée.
- [ ] Une session longue confirme que la compaction se déclenche bien vers
      450 k et non 700 k.
