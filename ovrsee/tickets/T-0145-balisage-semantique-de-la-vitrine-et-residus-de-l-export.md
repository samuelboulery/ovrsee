---
{
  "id": "T-0145",
  "titre": "Balisage sémantique de la vitrine, et résidus de l'export",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "site",
    "seo",
    "a11y"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-seo-de-la-vitrine-site-constats-et-correctifs.md"
}
---

## Contexte

`site/index.html` compte 414 `<div>`, 255 `<span>`, et aucun `<header>`, `<nav>`,
`<main>`, `<footer>` ni `<section>`. C'est l'héritage direct de l'export Claude
Design : la page se lit bien à l'œil et ne se lit pas du tout à la machine — ni pour
un robot qui cherche le contenu principal, ni pour un lecteur d'écran qui cherche un
repère.

Deux résidus du même export traînent avec : `<h2>ovrsee</h2>` (ligne 203) est le nom
de dépôt affiché *dans la maquette de l'application*, que Google lit comme un titre de
section de la page ; et `<script type="text/x-dc" data-dc-script data-props="…">`
(ligne 924) n'est jamais exécuté.

Contrainte : les styles restent inline, le rendu ne bouge pas d'un pixel. On change
les balises, pas la mise en page.

## Critères d'acceptation

- [ ] La barre collante est un `<header>` et ses liens de section un `<nav>`.
- [ ] Le contenu principal est dans un `<main>`, chaque bloc porteur d'un `<h2>` est
      une `<section aria-labelledby>`, le dernier bloc est un `<footer>`.
- [ ] `<h2>ovrsee</h2>` est redevenu un `<span>` : la page ne compte plus que les cinq
      vrais titres de section.
- [ ] Le `<script type="text/x-dc">` a disparu.
- [ ] Les sept `target="_blank"` portent `rel="noopener noreferrer"`.
- [ ] Capture avant/après identique — aucun décalage visuel.
- [ ] `pnpm lint` passe.
