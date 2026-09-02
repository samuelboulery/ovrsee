---
{
  "id": "T-0264",
  "titre": "Le README montre une app d'il y a trois semaines",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": ["docs"],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-merge-104-puis-repasse-readme-captures.md"
}
---

## Contexte

Les sept captures de `docs/screenshots/` datent du 13 août (`5dacb19`). Elles
précèdent le thème clair, l'accent par projet, le panneau des commandes et les
commentaires de zone — et elles montrent encore les défauts corrigés par T-0250
(« 14 14 plans », « 1 tickets », vignettes cassées de l'onglet Produit). Le README
affiche donc à un visiteur des bugs déjà réparés.

Le texte a le même retard : `pnpm@10.34.5` quand `package.json` dit `pnpm@11.22.0`,
`electron 43.3.0` pour 43.4.1, `oxlint` absent des dépendances, et pas un mot de
l'accord requis avant d'exécuter la commande `dev` — le premier mur d'un nouveau
venu qui clique « Crawler ».

Rien dans le dépôt ne produit `docs/screenshots/` : les captures ont été prises à
la main, d'où leur péremption silencieuse.

## Critères d'acceptation

- [ ] `pnpm screenshots` régénère les sept captures depuis l'app réelle (Electron),
      sans geste manuel.
- [ ] Un onglet ajouté sans capture, ou une capture non citée par les deux README,
      fait échouer `pnpm test`.
- [ ] `README.md` et `README.fr.md` ne citent plus aucune version fausse, et
      documentent l'accord sur la commande `dev`.
