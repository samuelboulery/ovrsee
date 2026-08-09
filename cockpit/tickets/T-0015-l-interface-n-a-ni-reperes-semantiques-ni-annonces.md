---
{
  "id": "T-0015",
  "titre": "L'interface n'a ni repères sémantiques ni annonces",
  "colonne": "fait",
  "priorite": "basse",
  "tags": ["a11y", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

Relevé dans le DOM pendant l'audit, sur l'onglet Aperçu :

| Mesure | Valeur |
|---|---|
| `<main>`, `<nav>`, `<aside>`, `<header>` | 0 |
| `aria-label` | 3, pour 21 boutons |
| `aria-live` | 0 |
| `<h1>` | 2 sur la même page |

Ce qui marche déjà : `:focus-visible` est stylé, `Échap` ferme la lightbox et les
modales, les flèches naviguent dans les captures, les onglets sont de vraies
ancres, et le tableau se manipule au clavier par la liste déroulante de colonne du
panneau d'édition — le glisser-déposer n'est pas le seul chemin.

Ce qui manque relève d'une seule séance : envelopper la barre latérale, la barre
d'onglets et le contenu dans les balises correspondantes, nommer les boutons
muets, annoncer les erreurs et les chargements dans une région `aria-live`, et
n'avoir qu'un `<h1>`.

Ne pas confondre avec [[T-0008]], qui est un vrai piège au clavier et pèse plus
lourd que tout ce ticket.

## Critères d'acceptation

- [ ] La barre latérale, la barre d'onglets et le contenu sont dans `<aside>`,
      `<nav>` et `<main>`.
- [ ] Chaque bouton sans texte visible porte un `aria-label`.
- [ ] Les messages d'erreur et de chargement sont annoncés par une région
      `aria-live`.
- [ ] Une seule balise `<h1>` par écran.
