---
{
  "id": "T-0146",
  "titre": "Version anglaise de la vitrine à sa propre URL",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "site",
    "seo",
    "i18n"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-seo-de-la-vitrine-site-constats-et-correctifs.md"
}
---

## Contexte

`site/dict.json` porte 183 traductions FR→EN, appliquées par `traduire()`
(`site/app.js`) qui réécrit les nœuds de texte du DOM après rendu. La traduction
existe donc, elle est bonne, et personne ne la trouvera : pas d'URL, pas de
`hreflang`, pas d'état persisté, rien à indexer. Claude Code a une audience
majoritairement anglophone — c'est le plus gros écart entre ce que le site contient et
ce qu'il expose.

La page anglaise se génère au déploiement plutôt qu'elle ne se commite : une copie
figée dériverait de `index.html` sans que rien ne le signale. La source reste unique —
`index.html` en français, plus `dict.json`.

Piège à ne pas rater : l'état initial d'`app.js` est figé sur `lang: 'fr'`. Sur une
page déjà anglaise, `traduire()` applique la table inverse et **retraduit tout en
français**. La langue doit se dériver de `document.documentElement.lang`.

## Critères d'acceptation

- [ ] `https://ovrsee.app/en/` répond 200, en `lang="en"`, entièrement en anglais —
      contenu statique comme libellés de vues injectés par `app.js`.
- [ ] La page est générée par `node scripts/build-site-en.js` depuis `index.html` +
      `dict.json`, sans dépendance ajoutée, et le workflow `site.yml` la produit avant
      publication. `site/en/` n'est pas versionné.
- [ ] Un test `node:test` échoue si une clé française du dictionnaire subsiste dans le
      corps de la page générée.
- [ ] Les deux pages déclarent `hreflang` `fr`, `en` et `x-default`, et chacune son
      canonical propre.
- [ ] La bascule FR/EN est faite de vrais liens (`/` et `/en/`), pas d'un `onClick`.
- [ ] La démo interactive fonctionne des deux côtés, et la page EN ne se retraduit pas
      en français au premier rendu.
- [ ] `pnpm test` et `pnpm lint` passent.
