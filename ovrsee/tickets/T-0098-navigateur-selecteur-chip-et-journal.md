---
{
  "id": "T-0098",
  "titre": "Navigateur — chip sélecteur actif, glyphes de journal, webview vide",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "navigateur"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.2. Vérifié dans `Navigateur.tsx` :

- Bouton « Sélectionner » (lignes 610-618) : `btn btn-primary`/`btn btn-secondary`
  générique. L'audit demande un **chip** dédié — actif = fond `#24252c`,
  filet `#383a44`, texte `#f2f3f5`, picto `ph-fill ph-cursor` en accent
  (seul un état persistant « sélecteur actif », pas un simple bouton qui
  bascule de couleur).
- Journal DevTools (lignes 752-767) : `log.level === 'error'` colore en
  `var(--color-accent)` (violet, règle d'or §5.1 : l'accent n'est pas la
  couleur d'un état). Aucune distinction visuelle pour `warning`. L'audit
  veut des glyphes colorés en préfixe (`✕` err via `--color-err`, `▲` warn
  via `--color-warn`) et un séparateur mono `·` `#4e5158` avant la source,
  au lieu des parenthèses actuelles.
- Zone webview (ligne 670) : fond `#ffffff` fixe. Cas réel : l'app a
  toujours un `baseUrl`, donc la zone n'est presque jamais vide — mais si
  `url` est vide (avant toute navigation), le fond blanc plein ne dit rien.
  Ajouter le fond hachuré + légende mono de l'audit uniquement pour ce cas
  (`!url`), sans toucher au rendu une fois une page chargée.

## Critères d'acceptation

- [ ] Bouton « Sélectionner » devient un chip : actif = fond `#24252c` +
      filet `#383a44` + texte `#f2f3f5` ; inactif = état neutre actuel.
- [ ] Journal : glyphe `✕` `var(--color-err)` pour `error`, `▲`
      `var(--color-warn)` pour `warning`, séparateur `·` `#4e5158` avant la
      source (au lieu de `(source)`).
- [ ] Zone webview vide (`!url`) : fond hachuré `repeating-linear-gradient`
      + légende mono `#4e5158`, uniquement quand aucune URL n'est chargée.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome (état
      sélecteur actif, un log d'erreur et un d'avertissement dans DevTools).
