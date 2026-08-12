---
{
  "id": "T-0106",
  "titre": "Copie — parenthèses de pluriel (règle d'or §5.7)",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "copie"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §5.7 : « pas de parenthèses de pluriel (`3 fichiers modifiés`,
pas `3 fichier(s) modifié(s)`) ». Vérifié par grep direct (pas de fork cette
fois — le premier audit avait halluciné des résultats de commandes jamais
exécutées) :

`hooks/i18n.js`, bloc fr et bloc en (12 clés) :
`sante.tree_dirty`, `sante.unpushed`, `tableau.tickets_to_relocate`,
`navigateur.console_title`, `skills.install_count`, `config.hooks_label`.

Littéraux hors i18n (6 occurrences) :
`ActivityPanel.tsx:271` (`plan(s)/ticket(s)/commit(s)`), `:331` et `:333`
(`activité(s)`), `Illisibles.tsx:37` (`ligne(s) perdue(s)`),
`EquipmentPanel.tsx:35` (`commande(s) écrite(s)`), `Tableau.tsx:582`
(`ticket(s)`).

Le codebase a déjà l'idiome correct ailleurs (`produit.pages_count` /
`produit.pages_count_plural`, choisi par `n > 1 ? ... : ...`) — appliquer
la même forme partout plutôt que de la réinventer.

## Critères d'acceptation

- [ ] Chaque clé i18n listée éclatée en forme singulière/plurielle,
      sélectionnée par `n`.
- [ ] Chaque littéral `.tsx` listé remplacé par la même logique
      singulier/pluriel (i18n ou ternaire inline selon le contexte).
- [ ] `grep -rn "(s)\|(es)\|(x)" app/src hooks/i18n.js` ne retourne plus de
      pluriel entre parenthèses (hors commentaires).
- [ ] `pnpm typecheck && pnpm test` passent.
