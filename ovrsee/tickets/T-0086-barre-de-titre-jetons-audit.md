---
{
  "id": "T-0086",
  "titre": "Barre de titre — bouton icône, sélecteur projet sans préfixe, badge scan, bouton terminal",
  "colonne": "fait",
  "priorite": "moyenne",
  "epic": "T-0084",
  "tags": [
    "design",
    "chassis"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

`App.tsx` header : le bouton de rétractation est un glyphe texte `⇤`/`⇥` en
`.btn-ghost` (violet) au lieu d'une icône Phosphor. Le sélecteur de projet
répète « Ovrsee — » avant le nom. Le badge de scan écrit « commit » avant le
sha. Le bouton terminal n'a pas d'état visuel ouvert/fermé. Dépend de T-0085
pour les jetons de couleur.

## Critères d'acceptation

- [ ] Bouton de rétractation : icône Phosphor `SidebarSimple` 14px, bouton
      24×24 rayon 6, `#62666e` au repos / fond `#1c1d24` + `#b6bac1` sidebar
      fermée.
- [ ] Sélecteur de projet : nom seul (plus de préfixe « Ovrsee — »), hauteur
      24, padding `0 9px`, rayon 6, fond `#101114`, filet `#1c1d22`, carré
      accent 5×5 rayon 2, nom 12/500, caret 10px `#55585f`. Dropdown inchangé.
- [ ] Badge de scan : « dernier scan · date · sha », sans le mot « commit ».
- [ ] Bouton terminal : ouvert = fond `#1c1d24` + picto plein `#b6bac1` ;
      fermé = pas de fond, picto outline `#62666e`.
- [ ] `pnpm dev` : comparaison Chrome contre `Ovrsee App.dc.html#2a`.
