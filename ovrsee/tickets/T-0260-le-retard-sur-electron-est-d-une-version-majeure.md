---
{
  "id": "T-0260",
  "titre": "Le retard sur Electron est d'une version majeure",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "dependances"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

La version installée est 43.4.1, la ligne courante est 44. Un moteur de rendu
en retard d'une majeure porte des correctifs de sécurité non appliqués, et
c'est le composant qui affiche des pages tierces dans l'onglet Navigateur.

La montée demande de revérifier le comportement de l'attachement des invités,
puis de reconstruire le paquet natif du terminal.

## Critères d'acceptation

- [ ] Electron monté à la ligne 44, application lancée et vérifiée à l'écran.
- [ ] Le paquet macOS se construit et le terminal fonctionne dedans.
