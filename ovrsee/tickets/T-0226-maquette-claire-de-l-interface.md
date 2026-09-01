---
{
  "id": "T-0226",
  "titre": "Maquette claire de l'interface",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["ui", "design-system", "issue-64"],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "m"
}
---

## Contexte

T-0218 pose la condition : « une palette claire dessinée, pas dérivée
mécaniquement de la sombre par inversion ». C'est exactement ce que la tentative
de 2026 avait raté — `24c3123` recopiait les jetons du sombre en inversant les
indices, et l'accent dérivait au passage.

Il n'existe aujourd'hui aucune maquette claire : `_ds/nocturne-*` déclare
`"themes": []`, et `Ovrsee-A-Nocturne.dc.html` est la référence du sombre seul.
Ce ticket produit son pendant clair, qui servira ensuite de référence aux
valeurs écrites dans `_ds/ovrsee/styles.css`.

Les planches se recréent **depuis la source** — jetons, rayons, hauteurs de
contrôle, graisses IBM Plex lus dans `_ds/ovrsee/styles.css` et les composants —
pour que seule la couleur diffère entre la maquette et l'application.

## Critères d'acceptation

- [ ] Trois planches d'écran en clair : Aperçu, Tableau, et le panneau terminal
      ouvert sur une sortie `claude` colorée — c'est elle qui décide les vingt
      couleurs ANSI.
- [ ] Une quatrième planche porte les rampes (surfaces, texte, filets, statuts)
      et les paires de contraste mesurées.
- [ ] Les six accents de projet y figurent sur fond clair.
- [ ] Rien n'est écrit dans `_ds/` ni dans `app/src` sous ce ticket : il produit
      une maquette, pas du code.
