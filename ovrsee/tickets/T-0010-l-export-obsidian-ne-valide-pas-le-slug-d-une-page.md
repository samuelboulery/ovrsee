---
{
  "id": "T-0010",
  "titre": "L'export Obsidian ne valide pas le slug d'une page",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["securite", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`hooks/obsidian.js:215` et `:255` composent des chemins d'écriture à partir de
`page.slug`, lu tel quel dans `cockpit/pages/pages.json` :

```js
copyFileSync(source, join(dir, 'shots', `${page.slug}.png`))
writeFileNoFollow(join(dir, 'pages', `${page.slug}.md`), corps)
```

Aucune validation. Un `slug` valant `../../../quelque-chose` fait écrire hors du
coffre. `pages.json` est engendré par le crawl, qui assainit ses slugs — mais
c'est un fichier versionné : il arrive avec le dépôt qu'on ouvre, et le bouton
« Exporter en coffre Obsidian » est à un clic.

Ce qui rend le trou net, c'est que le projet fait déjà l'inverse partout ailleurs :
`isSafePlanFileName` (`plans.js:432`) et `isSafeTicketFileName` (`tickets.js:294`)
refusent `/`, `\`, `\0`, `..` et les noms commençant par un point. Le slug d'une
page est le seul nom composé sans passer par cette porte.

Menace : un dépôt hostile qu'on clone et qu'on ouvre — pas le renderer, qui n'a
pas accès à ce chemin.

## Critères d'acceptation

- [ ] Un `pages.json` dont un `slug` contient `/`, `\`, `..` ou commence par un
      point fait échouer l'export avec un message nommant le slug, sans rien
      écrire hors de `cockpit/obsidian/`.
- [ ] La validation réutilise la fonction existante plutôt que d'en écrire une
      troisième.
- [ ] Un test couvre le slug hostile.
