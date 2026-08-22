---
{
  "id": "T-0208",
  "titre": "Le graphe est relu à chaque ouverture de l'onglet Données",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["perf", "ui"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-suites-de-la-revue-de-la-pr-61.md"
}
---

## Contexte

T-0134 a sorti `graph.json` du snapshot : l'onglet Données le demande lui-même
au montage. Gain net au démarrage, mais l'onglet est en rendu conditionnel
(`App.tsx`, `tab === 'donnees' && <Donnees/>`) — le quitter le démonte, y
revenir refait un aller-retour de 687 ko. Avant, la lecture était payée une
fois par changement de projet ; elle est maintenant payée à chaque va-et-vient
d'onglets, ce qui est le geste le plus courant de l'interface.

## Critères d'acceptation

- [ ] Aller sur Données, passer sur un autre onglet, revenir : aucun second
      appel à `/api/graph` dans l'onglet Réseau des devtools.
- [ ] Changer de projet relit le graphe du nouveau projet.
- [ ] Un rechargement explicite (`reload`) invalide ce qui est gardé — un
      graphe régénéré par un commit ne reste pas affiché périmé.
