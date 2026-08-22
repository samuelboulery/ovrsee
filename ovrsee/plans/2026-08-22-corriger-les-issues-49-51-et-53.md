---
{
  "status": "closed",
  "title": "Corriger les issues #49, #51 et #53",
  "opened": "2026-08-22",
  "closed": "2026-08-22",
  "commits": [
    {
      "sha": "67eed85",
      "date": "2026-08-22",
      "files": [
        "app/src/App.tsx"
      ]
    },
    {
      "sha": "0284088",
      "date": "2026-08-22",
      "files": [
        "app/src/Terminal.tsx",
        "app/src/useTerminal.ts"
      ]
    }
  ]
}
---

# Corriger les issues #49, #51 et #53

## Contexte

Trois bugs déposés par Floriane sur l'application empaquetée (macOS) :

- **#49** — un raccourci de commande écrit toujours dans la session `claude` du projet
  et bascule l'onglet vers elle, même si l'utilisateur regardait un autre terminal.
  Attendu : le raccourci écrit dans le terminal qu'on a sous les yeux.
- **#51** — layout shift au survol d'une ligne du dropdown des projets : le bouton
  « × » (retirer) n'existe que pendant le survol, il pousse le badge et tronque le nom.
- **#53** — l'icône d'état d'une session reste au point gris pendant que Claude
  travaille. Deux causes : cliquer sur un onglet efface aussi l'état `busy`, et une
  question à laquelle on répond **dans le terminal** reste en `question` (masqué sur
  l'onglet actif, donc affiché en point) jusqu'au `Stop` suivant.

Aucun changement de hook Claude Code : tout se corrige dans le rendu.

## #49 — le raccourci vise l'onglet actif

`app/src/useTerminal.ts`

- Extraire de `injectToClaude` (l.160) l'écriture vers un pty donné :
  `injectTo(ptyId, text)` / `pasteTo(ptyId, text)` (mêmes délimiteurs de bracketed
  paste que `pasteToClaude`, l.175). `injectToClaude`/`pasteToClaude` restent, ils
  servent à l'onglet Navigateur qui n'est pas enfant du panneau.
- Généraliser `focusClaude` (l.516) en `focusSession(key)` — un seul appelant
  aujourd'hui (`Terminal.tsx:414`) ; mettre à jour l'objet rendu (l.576).

`app/src/Terminal.tsx`

- `activate()` (l.409) : cible = `active` s'il a un pty dans `ptyIds`, sinon
  `claudeKey`, sinon presse-papier (repli navigateur inchangé). Écrire via
  `pasteTo(ptyIds[cible], text)`, `setActive(cible)` (sans effet si déjà actif),
  `setTimeout(() => focusSession(cible), 0)`.
- Adapter le commentaire de tête : ce n'est plus « la session Claude » mais
  « le terminal affiché ».
- `CommandPalette.tsx:139` reste sur `pasteToClaude` : la palette s'ouvre aussi
  panneau replié, où il n'y a pas d'onglet actif.

## #51 — plus de layout shift au survol

`app/src/App.tsx`, `ProjectRow` (l.1350-1367)

Toujours rendre le bouton « × », et le masquer par `visibility` au lieu de le
retirer du flux :

```
style={s('... visibility: ' + (hover || confirming ? 'visible' : 'hidden') + ';')}
```

Ajouter `aria-hidden` + `tabIndex={-1}` quand il est masqué pour qu'il ne soit ni
lu ni tabulable au repos. La largeur est réservée en permanence → le nom et le
badge ne bougent plus. Convention du dépôt : ne rien faire varier qui prenne de la
place (cf. `Produit.tsx:554` — bordure constante, couleur variable).

## #53 — l'état « il réfléchit » ne disparaît plus

`app/src/Terminal.tsx`, clic d'onglet (l.500-508)

N'effacer que ce qui a été *vu* : `stop` et `question`. Un `busy` n'est pas une
notification, c'est un état en cours — le garder.

`app/src/useTerminal.ts` (l.398) + `Terminal.tsx`

- Nouveau paramètre optionnel `onSaisie(sessionKey)` de `useTerminals`, appelé
  depuis `xterm.onData` (l.398), à côté de l'écriture dans le pty.
- Dans `Terminal.tsx`, `onSaisie` ne fait rien sauf si
  `attentions.current[key]?.kind === 'question'` : dans ce cas, répondre au clavier
  vaut réponse → passer l'entrée à `{ kind: 'busy', detail: null, at: Date.now() }`
  et `setSignaux(n => n + 1)`. `detail: null` : pas de renommage d'onglet.

Hors périmètre, à dire dans la PR : répondre depuis le popover de la barre de menu
(`electron/tray.js:284`) éteint l'attente côté principal mais pas côté rendu, qui
la republie au `report` suivant. Symptôme différent (« ? » persistant), non signalé.

## Tests

`pnpm test` — aucun framework, `node:test` + `node:assert` (voir `CLAUDE.md`).

- Les trois correctifs sont des branches d'une ligne dans du code React non couvert
  (les tests d'`app/src` ne couvrent que les fonctions pures et un rendu d'onglets) ;
  pas de nouveau test unitaire, conformément au style du dépôt.
- Vérifier que `pnpm test`, `pnpm lint`, `pnpm typecheck` et `pnpm build:ui` passent.

## Vérification manuelle (`pnpm electron` — `pnpm dev` n'a pas de terminal)

1. **#49** : ouvrir un shell nu (2ᵉ onglet), y rester, cliquer un raccourci de
   commande → le texte se colle dans ce shell, l'onglet ne change pas, le curseur y
   est. Revenir sur l'onglet claude, cliquer un raccourci → colle chez claude.
   Replier le panneau, ⌘K sur une commande → toujours la session claude.
2. **#51** : ouvrir le dropdown des projets, balayer les lignes à la souris → ni le
   nom ni le badge ne bougent. Cliquer « × » → « retirer ? » s'affiche, second clic
   retire le projet du registre.
3. **#53** : envoyer une demande à claude, cliquer sur l'onglet pendant qu'il
   travaille → les points battent toujours. Provoquer une demande de permission,
   répondre au clavier dans le terminal → l'icône repasse aux points battants, puis
   à la coche au `Stop`.

## Livraison

Une branche, trois commits (`fix:` par issue), une PR citant `Fixes #49`, `#51`,
`#53`. La CI tourne lint/typecheck/build sur ubuntu et `pnpm test` sur macOS et
Windows.
