---
{
  "id": "T-0084",
  "titre": "Fondations + Châssis — audit design (Lots 1-2)",
  "colonne": "fait",
  "priorite": "haute",
  "type": "epic",
  "tags": [
    "design",
    "audit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

L'audit design frais (`AUDIT-DESIGN-Ovrsee-2026-08-12.md`) documente que deux
langages de style cohabitent dans le code : les zones portées littéralement
(barre de titre, sidebar, Aperçu, dock terminal) et le reste de l'app qui
dépend encore de `_ds/ovrsee/styles.css` — rampe de gris bleutée, un seul
jeton de filet pour quatre rôles, classes `.btn`/`.seg`/`.tag` en ancienne
identité (texte violet). Il documente aussi l'absence totale de la barre de
vue (46px) et de la barre d'état (26px) présentes sur tous les écrans de la
maquette.

Cet epic regroupe les Lots 1 (fondations styles.css) et 2 (châssis) — les
5 lots suivants de l'audit (écrans, modales, finitions) sont hors périmètre,
chantiers séparés à venir une fois ces fondations posées.

## Critères d'acceptation

- [ ] Les 7 tickets enfants sont clos.
- [ ] `grep -rn "color-neutral-" app/src` ne retourne rien.
- [ ] Les six vues (hors Aperçu) ont exactement une `ViewBar` et une
      `StatusBar` ; plus aucun `<h2>` `--font-heading` 19px de page.
