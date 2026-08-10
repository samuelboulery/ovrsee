---
{
  "id": "T-0008",
  "titre": "Les terminaux cachés restent tabulables",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["a11y", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

**Le constat d'origine visait l'onglet Navigateur, et il était faux.** Il venait
d'un `document.querySelectorAll` sur les éléments focusables, qui rend les
éléments quel que soit leur affichage. Or le conteneur du Navigateur passe en
`display: none` quand on quitte l'onglet, et `display: none` retire déjà tout
son contenu de l'ordre de tabulation. Rien à corriger là.

Le vrai cas est dans le panneau terminal. Les sessions y sont toutes montées et
empilées, l'inactive rendue transparente (`Terminal.tsx`, autour de la ligne
255) :

```
opacity: 0; pointer-events: none;
```

`display: none` est **exclu** volontairement — un conteneur de largeur nulle
fait calculer à FitAddon une grille fausse, et `claude` se réafficherait de
travers au retour. Mais la transparence ne retire rien de l'ordre de
tabulation : la zone de saisie de chaque terminal caché y reste. Avec trois
sessions ouvertes, le clavier traverse deux terminaux invisibles avant
d'atteindre le suivant, et une frappe part dans le mauvais.

La réponse est `inert` : il retire le sous-arbre du clavier et des lecteurs
d'écran sans toucher à la mise en page, donc FitAddon continue de mesurer juste.

## Critères d'acceptation

- [x] Avec plusieurs terminaux ouverts, la tabulation ne rencontre que celui
      qui est affiché.
- [x] Un terminal caché puis réaffiché garde son contenu et sa grille — pas de
      réaffichage de travers.
- [x] Vérifié dans le navigateur : les 23 éléments atteignables au clavier
      appartiennent tous à l'onglet visible, et chacun porte un nom.
