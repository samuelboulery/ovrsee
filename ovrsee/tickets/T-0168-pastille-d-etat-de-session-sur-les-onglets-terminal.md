---
{
  "id": "T-0168",
  "titre": "Pastille d'état de session sur les onglets terminal",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "ui",
    "terminal"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "epic": "T-0164"
}
---

## Contexte

Issue #18 : avec plusieurs sessions Claude, savoir laquelle a fini oblige à
changer d'onglet une par une. Le signal existe déjà de bout en bout — séquence
OSC du hook, `extractAttention`, `attentions.current` dans `Terminal.tsx` — il
n'est affiché que dans la barre de menu macOS. La pastille de 5 px de l'onglet
ne dit aujourd'hui que « actif / inactif ».

## Critères d'acceptation

- [ ] La pastille d'un onglet prend une couleur distincte selon `stop`
      (Claude a rendu la main) et `question` (attend une réponse).
- [ ] Un `title` et un `aria-label` disent lequel des deux.
- [ ] Le signal s'efface quand l'onglet devient actif.
