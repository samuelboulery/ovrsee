---
{
  "id": "T-0112",
  "titre": "Fusion des sections Profil et Interface dans les Paramètres",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "preferences"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-fusion-des-sections-profil-interface-dans-les-parametres.md"
}
---

## Contexte

« Profils » (galerie de templates) et « Interface » (ordre des onglets +
terminal) sont deux entrées séparées du rail gauche de `PreferencesPanel.tsx`
alors qu'elles éditent le même état (`onglets`, `terminal`) — un choix de
rangement, pas une frontière fonctionnelle. La colonne d'aperçu fixe à droite
(300px, présente sur toutes les sections) est en outre redondante : chaque
carte de template a déjà sa propre miniature.

## Critères d'acceptation

- [ ] Le rail gauche des Paramètres n'a plus qu'une entrée pour Profils et
      Interface (au lieu de deux) ; les 4 templates s'affichent au-dessus des
      réglages Onglets/Terminal, dans cet ordre.
- [ ] La colonne d'aperçu à droite (300px, `PreferencesPreview`) a disparu de
      toutes les sections des Paramètres.
- [ ] `pnpm test` et `pnpm typecheck` passent.
