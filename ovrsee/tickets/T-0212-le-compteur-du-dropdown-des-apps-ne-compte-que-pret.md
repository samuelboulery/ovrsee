---
{
  "id": "T-0212",
  "titre": "Le compteur du dropdown des apps ne compte que « Prêt »",
  "colonne": "revue",
  "priorite": "haute",
  "tags": ["ui", "menubar"],
  "cree": "2026-08-29",
  "maj": "2026-08-29",
  "plan": null
}
---

## Contexte

Issue GitHub #52 : le popover de la barre de menu (le dropdown des apps)
affiche un compteur de tickets par projet qui totalise aujourd'hui plusieurs
colonnes (tout ce qui n'est pas en colonne finale, via `restant()`), backlog
compris. Pour l'utilisateur, le backlog n'est pas actionnable — il y range des
intentions sans savoir s'il les fera. Le compteur doit refléter ce qui est
prêt à démarrer.

## Critères d'acceptation

- [ ] Le compteur du popover ne compte que les tickets en colonne `pret`.
- [ ] La logique epic-aware (un epic avec enfants ne compte pas, ses enfants
      comptent à sa place) reste appliquée.
- [ ] Le libellé/l'infobulle du popover ne dit plus « à faire » si le sens a
      changé.
- [ ] Le badge de l'onglet Tableau dans l'app (qui utilise `restant()`) n'est
      pas affecté — hors périmètre de l'issue.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` verts.
