---
{
  "id": "T-0229",
  "titre": "Le terminal xterm suit la bascule à chaud",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "terminal",
    "issue-64"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "m"
}
---

## Contexte

C'est le point qui fait ou défait l'issue #64 : sans lui, basculer le thème
laisse un terminal noir au milieu d'une interface claire. La demande est
explicite dans l'issue.

`getTerminalTheme()` n'est lu qu'à `new XTerm({…})` (`useTerminal.ts:226`) et
n'est jamais réappliqué — limite déjà notée par T-0039. Recréer le terminal
n'est pas une option : le panneau est en `lazy()` et son démontage ferme les
ptys (`useTerminal.ts:199-213`, `pty.ts:115-126`), donc tue la session.

La sortie est courte : `panes` est déjà une `Map` de tous les xterm vivants, et
le pty vit dans le processus principal, indifférent aux options du rendu — une
affectation de `options.theme` suffit à réafficher.

La chrome autour du terminal (`Terminal.tsx`) passe déjà par les jetons du
design system : elle suivra seule. Seul le canvas xterm ne suit pas.

Les vingt couleurs ANSI actuelles sont calibrées pour un fond noir : une palette
claire leur est nécessaire, sans quoi tout ce que `claude` écrit en couleur
devient illisible.

## Critères d'acceptation

- [ ] Basculer le thème pendant qu'une session `claude` tourne change le fond, le
      texte et **l'historique déjà affiché**.
- [ ] Le pty n'est pas recréé, la session ne meurt pas, l'historique est intact.
- [ ] Un terminal ouvert après la bascule naît dans le bon thème.
- [ ] Les vingt couleurs ANSI ont une variante claire lisible.
- [ ] Un test atteint la bascule sans xterm — fonction pure, faux pane — et
      échoue si elle se recasse.
