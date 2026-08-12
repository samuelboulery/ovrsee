---
{
  "id": "T-0090",
  "titre": "Dock terminal — en-tête 36px, pastilles neutres, disposition en segmenté unique",
  "colonne": "fait",
  "priorite": "moyenne",
  "epic": "T-0084",
  "tags": [
    "design",
    "chassis"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

`Terminal.tsx` : en-tête 34px (cible 36px), pastilles de session teintées
accent (`#2a2660`/`#14132a`/`#a49dfa`) au lieu de neutre, trois boutons de
disposition indépendants au lieu d'un `.seg` unique, bouton « réduire » en
`.btn-ghost` violet, barre réduite non alignée aux jetons. Dépend de T-0085.

## Critères d'acceptation

- [ ] En-tête : 36px, `padding: 0 12px`.
- [ ] Pastilles de session : hauteur 24, rayon 6, mono 11.5px, puce 5px —
      active = fond `#1c1d24` texte `#f2f3f5` puce `#7d76f0` ; inactive =
      pas de fond, texte `#9096a0`, puce `#3f424a`. Bouton `+` picto 13px
      `#55585f`.
- [ ] Disposition : un seul `.seg` (au lieu de 3 boutons bordés), précédé du
      libellé mono `DISPOSITION`.
- [ ] Bouton « Réduire » : texte simple 11.5px `#62666e`, plus de
      `.btn-ghost`.
- [ ] Colonne Commandes : rangées 28px rayon 6 fond `#101114` filet `#22232a`
      texte 12px `#d5d8dd`, picto accent 14px — vérifier qu'aucun libellé
      n'est coloré par erreur après T-0085.
- [ ] Barre réduite (terminal fermé) alignée aux jetons, `.btn-ghost` retiré.
- [ ] `pnpm typecheck && pnpm test` passent ; `pnpm electron` pour vérifier
      le rendu identique via le protocole `ovrsee://`.
