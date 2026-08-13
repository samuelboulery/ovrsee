---
{
  "id": "T-0135",
  "titre": "Trois onglets dépassent la limite de 800 lignes",
  "colonne": "en-cours",
  "priorite": "basse",
  "charge": "l",
  "tags": [
    "dette"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

`Tableau.tsx` fait 1213 lignes, `Navigateur.tsx` 1006, `Produit.tsx` 899. La règle du projet fixe 800. L'audit conclut que leur taille vient d'une cohésion réelle, pas d'un fourre-tout — d'où le report plutôt que le découpage la veille d'une release.

## Critères d'acceptation

- [ ] Chaque fichier repasse sous 800 lignes, ou l'écart est justifié par écrit dans CLAUDE.md.
- [ ] Aucun changement de comportement : vérifié en lançant l'application, faute de test d'interaction.
