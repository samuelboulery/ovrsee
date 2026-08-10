---
{
  "id": "T-0017",
  "titre": "Dashboard de santé sur l'onglet Aperçu",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["ui", "apercu"],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-dashboard-pour-l-onglet-apercu.md",
  "type": "epic"
}
---

## Contexte

L'onglet Aperçu affiche aujourd'hui le README en permanence, entouré d'un
bandeau de chiffres. Le besoin : en faire un vrai tableau de bord — README
consultable à la demande plutôt que toujours visible, et remontée de signaux
concrets (git, audits, environnements) qui n'apparaissent nulle part ailleurs
dans l'app.

Voir le plan lié pour le détail des choix (indicateurs factuels plutôt qu'un
score composite, fetch git manuel plutôt qu'automatique, environnements
déclarés dans `ovrsee.config.json`).

## Critères d'acceptation

- [ ] Les deux tickets enfants sont terminés.
- [ ] L'onglet Aperçu affiche santé, branches et environnements sans casser
      les chiffres existants ni le README.
