---
{
  "id": "T-0258",
  "titre": "Les gardes d'Electron n'ont aucun test",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "test"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Le processus principal (775 lignes), la barre de menu, le pty, le menu et le
pont ne sont importés par aucun test : ils n'apparaissent pas dans le rapport
de couverture. Or c'est là que vivent les gardes — le registre comme liste
blanche, la réécriture des privilèges d'un invité, l'appartenance d'un panneau
d'outils à sa fenêtre. Aujourd'hui elles ne sont vérifiées qu'à la lecture.

La voie est tracée par le module de liens externes, déjà extrait et testé.

## Critères d'acceptation

- [ ] Les prédicats de garde sont extraits dans un module pur et testés sans Electron.
- [ ] Trois hooks aujourd'hui sans test en ont un.
