---
{
  "id": "T-0233",
  "titre": "Supprimer la maquette Nocturne et son design system",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "dette",
    "audit",
    "design-system"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "s"
}
---

## Contexte

`legacy/Ovrsee-A-Nocturne.dc.html` (624 l) est la maquette d'origine du thème
sombre ; `_ds/nocturne-16d90168-…/` (542 l : `styles.css`, `_ds_manifest.json`,
`_adherence.oxlintrc.json`, `_ds_bundle.js`, `readme.md`) est le design system
qu'elle charge. L'application, elle, charge `_ds/ovrsee/styles.css` depuis
`main.tsx` — et rien d'autre.

Le lien est refermé sur lui-même : le seul consommateur de `_ds/nocturne-*` est
la maquette, et le seul consommateur de la maquette est la mémoire. `app/src` ne
la cite plus depuis T-0044, `hooks/couleurs.test.js` et
`hooks/theme-clair.test.js` ne la citent nulle part, et T-0230 a retiré la
dernière exemption qui la maintenait dans le champ des garde-fous.

Ce qu'elle avait à transmettre est passé dans les jetons. Le thème clair a été
livré sans elle (T-0227) — elle ne déclarait qu'un mode.

## Critères d'acceptation

- [ ] `legacy/` et `_ds/nocturne-16d90168-f621-47c2-b3bb-29511cfd6dd0/` n'existent plus.
- [ ] `grep -r nocturne` ne rend plus que de l'historique : tickets, `CHANGELOG`, `graphify-out/graph.json`.
- [ ] La mention de `legacy/` dans « Zones à ne pas toucher » de `CLAUDE.md` est retirée — la zone n'existe plus.
- [ ] `pnpm test`, `pnpm lint` et `pnpm build:ui` verts.
