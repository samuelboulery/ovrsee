---
{
  "id": "T-0227",
  "titre": "Les jetons se redéfinissent par thème",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system",
    "issue-64"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "l"
}
---

## Contexte

`_ds/ovrsee/styles.css` porte ses 84 jetons dans un `:root` **seul** : aucune
structure ne permet de les redéfinir par thème. Ce ticket en ajoute une, et y
écrit la palette claire arrêtée en T-0226.

Le piège tient à la spécificité. `:root[data-theme='light']` pèse 0,2,0 ;
`[data-accent='ambre']` pèse 0,1,0 — un bloc de thème qui redéfinirait
`--color-accent-*` écraserait les six accents de projet, et le sélecteur nu sert
aussi les pastilles de préférences, qui doivent garder leur teinte. L'accent
s'adapte donc par indirection sur le palier 800, une ligne pour les six teintes.

Sur fond blanc, ces paliers mesurent violet 14,3:1, rose 9,4, orange 8,6,
cyan 5,6, ambre 4,7 — et **vert 4,42**, sous AA de 0,08. Les paliers 800 et 900
n'ont aujourd'hui aucun consommateur : les retoucher ne bouge pas le sombre.

Restent les couleurs déguisées en autre chose : le `#0a0a12` de `.btn-primary`,
le `--ring-selected` blanc, les trois `--shadow-*` dont deux sont des filets
clairs, le `.dialog-backdrop` qui détourne `--color-neutral-900`, le
`color-mix(… white)` du survol et le `mix-blend-mode: lighten`.

## Critères d'acceptation

- [ ] Un bloc `:root[data-theme='light']` redéfinit surfaces, texte, filets,
      statuts, ombres et voile — et **aucun** jeton n'a sa seule définition dans
      un bloc de thème.
- [ ] Le bloc clair ne redéfinit aucun palier `--color-accent-*` ; les six
      accents de projet et les pastilles de choix gardent leur teinte.
- [ ] `color-scheme` est déclaré dans les deux thèmes.
- [ ] Le sombre est identique au pixel près : `:root` inchangé, et
      `hooks/accents.test.js` continue d'y lire ses valeurs (son extraction
      dépend du `:root` fermé en colonne 0 — le bloc clair vient après).
- [ ] Un test neuf atteste qu'aucun jeton n'existe que dans un thème, que le
      bloc clair ne touche pas les rampes, et que les sept niveaux de texte
      tiennent 4,5:1 sur les surfaces claires.
- [ ] `hooks/accents.test.js` mesure aussi le contraste sur fond clair : sans ça
      il resterait vert avec une palette illisible.
