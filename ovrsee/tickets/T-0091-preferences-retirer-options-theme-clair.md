---
{
  "id": "T-0091",
  "titre": "Préférences — retirer les options Clair/Système du segmenté Apparence",
  "colonne": "fait",
  "priorite": "basse",
  "epic": "T-0084",
  "tags": [
    "design",
    "preferences"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

`PreferencesControls.tsx` expose un segmenté `Apparence` avec `Sombre / Clair
/ Système` alors qu'aucune maquette claire n'existe (`theme.ts` ne définit
qu'une palette sombre, commenté explicitement). Décidé avec l'utilisateur :
retirer les options plutôt que les laisser promettre quelque chose
d'inexistant — cohérent avec la décision déjà prise de rester dark-only.
Ticket isolé, indépendant du reste de l'epic.

## Critères d'acceptation

- [ ] Le segmenté `Apparence` ne propose plus que `Sombre` (ou est masqué si
      une seule option n'a pas de sens en segmenté).
- [ ] Aucune tentative de construire un thème clair.
- [ ] `pnpm typecheck && pnpm test` passent.
