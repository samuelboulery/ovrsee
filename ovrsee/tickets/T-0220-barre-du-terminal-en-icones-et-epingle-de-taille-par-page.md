---
{
  "id": "T-0220",
  "titre": "Barre du terminal en icônes et épingle de taille par page",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "terminal"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-barre-de-disposition-du-terminal-icones-epingle-par-page.md"
}
---

## Contexte

La barre d'en-tête du panneau terminal consacre ~250 px à `DISPOSITION`
et trois libellés (`Bas`, `Côté`, `Plein`) plus `Réduire`. C'est la part
qui rogne le plus les pastilles de session, pour un choix purement
géométrique — alors que les sept vues du rail sont déjà pictographiées.

Second manque : la taille du panneau est globale à l'application
(`settings.terminal.hauteur` / `.largeur`, une valeur pour les sept vues).
Le besoin diffère par page — court sur Tableau pour laisser voir le Kanban,
haut sur Produit — et chaque changement d'onglet demande de retirer la
poignée à la main.

## Critères d'acceptation

- [ ] La barre montre trois carrés Phosphor en `weight="fill"`
      (`SquareHalfBottom`, `SquareHalf`, `Square`), une épingle et un moins ;
      le kicker « Disposition » devient l'`aria-label` du groupe.
- [ ] Chaque bouton garde son infobulle et son `aria-label` traduits, et le
      groupe reste traversable au clavier avec son anneau de focus.
- [ ] Cliquer l'épingle retient la taille courante pour le couple
      (onglet, disposition) ; revenir sur cet onglet la restaure.
- [ ] Tant qu'une page est épinglée, son séparateur ne répond plus au
      glissement ; dépingler le rend sans faire sauter le panneau.
- [ ] Restaurer une taille épinglée n'écrase pas la taille globale des
      préférences.
- [ ] « Plein » n'a pas d'épingle — il n'a pas de taille propre.
- [ ] Les épingles survivent au redémarrage de l'application.
