---
{
  "id": "T-0047",
  "titre": "Rail de navigation verticale, repli ⌘B",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "chassis"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

Remplacer la barre d'onglets horizontale (`App.tsx:572-614`) par un rail
d'icônes vertical à gauche (7 vues), repliable via ⌘B (rail icône-seule avec
tooltips, catalogué en maquette 2k). État actif = picto plein + surface
élevée, jamais un filet coloré (maquette 2a).

**Contrainte dure :** `crawl/index.js` découvre les routes via
`page.$$eval('a[href]')` — le commentaire de `App.tsx:585-588` le dit
explicitement. Le rail doit donc rendre de vrais `<a href>`, pas des
`<button onClick>`, sous peine de casser le crawl du projet ovrsee
lui-même.

Dépend de T-0045 (tokens) et idéalement T-0046 (pictos) pour l'état actif —
peut démarrer avant si les pictos actuels servent de placeholder.

## Critères d'acceptation

- [ ] Les 7 vues restent accessibles via de vrais `<a href>` dans le rail.
- [ ] `pnpm ovrsee:crawl .` (sur le projet ovrsee lui-même) retrouve les 7
      routes après le changement — vérification manuelle en Electron, pas
      seulement `pnpm dev`.
- [ ] Repli/dépli du rail via ⌘B, état persisté (comme l'actuelle sidebar,
      `App.tsx:222-236`).
- [ ] État actif = picto plein + surface élevée, sans filet de couleur.
- [ ] `pnpm test` et `pnpm typecheck` passent.
