---
{
  "id": "T-0003",
  "titre": "Aucun garde-fou de rendu : une exception vide l'écran",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["robustesse", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`app/src/` ne contient aucun `ErrorBoundary`, aucun `componentDidCatch`, aucun
`getDerivedStateFromError`. Conséquence : n'importe quelle exception levée pendant
le rendu d'un onglet démonte l'arbre React entier. On ne perd pas seulement
l'onglet fautif, on perd la barre latérale, la barre d'onglets et l'en-tête — donc
tout moyen de se rabattre sur un autre projet ou un autre onglet.

Constaté en vrai pendant l'audit ([[T-0002]]) : écran noir, aucun message, aucune
indication de la cause. La console dit tout ; l'interface, rien.

Un cockpit qui lit des fichiers écrits par des hooks lira tôt ou tard un fichier
que personne n'a prévu. Le corriger champ par champ est sans fin ; le garde-fou,
lui, tient pour les cas qu'on n'a pas imaginés.

Ce qu'il doit afficher n'est pas « une erreur est survenue » : le chemin du projet,
le nom de l'onglet, le message de l'exception, et un bouton qui revient à la liste
des projets.

## Critères d'acceptation

- [ ] Une exception levée dans le rendu d'un onglet laisse la barre latérale, la
      barre d'onglets et l'en-tête en place.
- [ ] Le panneau d'erreur nomme l'onglet fautif et affiche le message de
      l'exception, pas un texte générique.
- [ ] Depuis cet écran, on peut basculer sur un autre onglet ou un autre projet
      sans recharger.
- [ ] Un test monte un composant qui lève et vérifie que le reste de l'interface
      survit.
