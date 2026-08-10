---
{
  "id": "T-0026",
  "titre": "Markdown, badge non commité et auto-refresh dans le panneau ticket",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["ui", "tableau", "git"],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-markdown-badge-non-commite-et-auto-refresh-dans-ovrsee.md"
}
---

## Contexte

Le panneau de lecture d'un ticket dans l'onglet Tableau affiche `##`,
`- [ ]` etc. en texte brut au lieu du markdown rendu. Rien ne signale non
plus qu'un ticket a été créé/modifié mais pas encore commité — il faut
sortir de l'app pour le savoir via `git status`. Enfin, seul l'onglet
Tableau se rafraîchit automatiquement (poll 4s sur board/tickets) ; les
autres onglets restent figés sur le snapshot d'ouverture tant qu'on ne
clique pas sur reload.

## Critères d'acceptation

- [ ] Le panneau de lecture d'un ticket (`app/src/tabs/Tableau.tsx`) rend le
      corps du ticket via le composant `Markdown` existant
      (`app/src/markdown.tsx`), au lieu du texte brut actuel — titres,
      listes à cocher, etc. s'affichent correctement.
- [ ] `hooks/git-status.js` expose les chemins de fichiers modifiés/indexés/
      non suivis (`dirty.files: string[]`), en plus des compteurs existants.
- [ ] Un badge « Non commité » apparaît dans le panneau de lecture d'un
      ticket dont le fichier (`ovrsee/tickets/<file>`) figure dans
      `gitStatus.dirty.files`, et disparaît une fois le fichier commité.
- [ ] Tous les onglets (pas seulement Tableau) se rafraîchissent
      automatiquement quand un changement est fait sur le disque du projet
      (poll snapshot complet, ~15s), sans clic sur reload.
- [ ] `pnpm test` et `pnpm typecheck` verts.
