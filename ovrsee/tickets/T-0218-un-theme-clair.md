---
{
  "id": "T-0218",
  "titre": "Un thème clair",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system",
    "issue-64"
  ],
  "cree": "2026-08-31",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "charge": "l",
  "type": "epic"
}
---

## Contexte

Issue #64. L'interface est illisible en plein jour — dehors, ou face à une
fenêtre. Le terminal devrait suivre, et l'ensemble suivre le réglage système.

**Ce ticket rouvre une décision.** Le thème clair a été *retiré*, pas oublié :
T-0075 d'abord, puis T-0200 qui a supprimé le champ `theme` des préférences.
`app/src/theme.ts:1-8` porte la trace de l'arbitrage. Le rouvrir suppose de
l'assumer, et c'est ce qui a été fait le 31 août 2026 — la gêne est réelle et
quotidienne.

**Pourquoi c'est le plus gros du lot.** Trois obstacles, cumulés :

1. Les ~90 jetons `--color-*` sont définis en `:root` **seul**
   (`_ds/ovrsee/styles.css:39-129`) : aucune structure ne permet aujourd'hui de
   les redéfinir par thème.
2. `app/src/theme.ts` ne porte qu'un `darkTheme` (l.13-47), injecté en 12
   variables `--theme-*` par `initializeTheme()` (l.53-100).
3. **Le thème xterm n'est appliqué qu'à la création du terminal**
   (`getTerminalTheme()`, `theme.ts:105-130`, consommé par
   `app/src/useTerminal.ts:226`) et jamais réappliqué à chaud. La limite est
   déjà notée dans T-0039. C'est ce point-là qui fait le gros du travail : sans
   lui, basculer le thème laisse un terminal sombre dans une interface claire.

Quatre fichiers portent encore un hex hors design system et devront suivre :
`app/src/tabs/navigateur-webview.ts:201,203`, `app/src/tabs/Produit.tsx:515,518`,
`app/src/tabs/Navigateur.tsx:494`, `app/src/ActivityPanel.tsx:27` — plus les
`rgba()` d'ombres et de voiles disséminés.

## Le cadrage, fait

Le plan existe (`2026-09-01-theme-clair-complet-issue-64-t-0218.md`) et ce
ticket devient l'epic de ses six enfants, T-0226 à T-0231. Trois choses y ont
été tranchées : la palette se dessine avant de se coder (T-0226), le défaut est
`système`, et l'accent en clair dérive du palier 800 de la rampe existante
plutôt que de six teintes neuves — une ligne pour les six accents, et les blocs
`[data-accent]` restent intacts.

Un quatrième point n'était pas dans le ticket d'origine et pèse autant : les
quinze `rgba()` de voiles, d'ombres et — dans la lightbox — de **texte** sont
invisibles au garde-fou, qui ne connaît que le hex (T-0230).

## Critères d'acceptation

- [ ] Les jetons `--color-*` se redéfinissent par thème ; aucune couleur n'a sa
      seule définition dans un bloc de thème.
- [ ] Trois réglages : clair, sombre, système. Le système suit
      `prefers-color-scheme` et réagit au changement sans rechargement.
- [ ] **Le terminal xterm suit la bascule à chaud**, sans recréer le pty ni
      perdre l'historique de la session.
- [ ] La palette claire tient les contrastes ; le test qui l'atteste rejoint
      `hooks/couleurs.test.js`.
- [ ] Les quatre fichiers à hex et les `rgba()` littéraux sont traités.
- [ ] Le thème sombre est identique au pixel près à celui d'aujourd'hui — la
      maquette reste la référence (`hooks/couleurs.test.js`, `FICHIERS_PORTES`).
- [ ] `theme.ts:1-8` est réécrit : le commentaire dit encore que le clair a été
      retiré.
