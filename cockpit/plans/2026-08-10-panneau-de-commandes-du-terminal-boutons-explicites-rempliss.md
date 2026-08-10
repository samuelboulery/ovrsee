---
{
  "status": "closed",
  "title": "Panneau de commandes du terminal : boutons explicites, remplissage sans envoi",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "05839a8",
      "date": "2026-08-10",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/useTerminal.ts"
      ]
    }
  ]
}
---

# Panneau de commandes du terminal : boutons explicites, remplissage sans envoi

## Contexte

Le panneau latéral du terminal (`app/src/Terminal.tsx`) rend chaque action dans un
`<details>` avec un chevron ▼. Trois problèmes :

1. **Le dropdown n'apporte rien.** Il faut un clic de plus pour voir ce que fait le
   bouton, et le chevron laisse croire à un menu de choix alors qu'il ne révèle qu'un
   `<pre>` en lecture seule.
2. **« Crawl du projet » et « Rafraîchir le cockpit » sont côte à côte sans que rien
   ne les distingue**, alors qu'ils ne font pas la même chose (voir plus bas).
3. **Un clic sur une commande l'exécute immédiatement** : `decideInjection()` ajoute
   `\n` et `inject()` l'écrit brute dans le pty. Impossible d'ajouter du contexte à la
   commande avant de l'envoyer.

### La différence crawl / rafraîchir, pour mémoire

| Bouton | Ce qu'il fait | Écrit dans le terminal ? |
|---|---|---|
| ⟳ Crawl du projet | `!pnpm cockpit:crawl` → lance Playwright, parcourt l'app observée, écrit `cockpit/pages/` + captures | oui |
| ↻ Rafraîchir le cockpit | `onReload()` → l'interface relit `cockpit/` par l'API. Aucun processus lancé | non |

Le second sert **après** le premier : le crawl écrit sur disque, l'interface ne se
remet pas à jour toute seule. Le libellé actuel ne le dit pas, et sa place dans la
section « COMMANDES (TERMINAL SEULEMENT) » est un contresens — il n'utilise pas le
terminal.

## Ce qui change

### 1. `app/src/Terminal.tsx` — supprimer les `<details>`

Remplacer les deux blocs `<details>/<summary>/<pre>` (l. 342-369 pour les commandes,
l. 411-438 pour les contextes) par un simple `<button>` par action, avec
`title={action.text}` pour l'infobulle. Le `<pre>` et le `<span>▼</span>` disparaissent.

Le reste est inchangé : `btn-primary btn-block` pour les commandes, `btn-secondary
btn-block` pour les contextes, même gap de 7px.

### 2. `app/src/Terminal.tsx` — sortir le bouton de rechargement de la section

Le déplacer **après** la section « CONTEXTE POUR CLAUDE », séparé par un
`border-top: 1px solid var(--color-divider)`, avec une ligne d'explication sous le
bouton (même style que la ligne de `notice`, `font-size: 11px; color:
var(--color-neutral-600)`).

Retirer aussi la condition `commands.length > 0` qui le masquait : recharger
l'affichage n'a rien à voir avec la présence de commandes.

Nouveau libellé : **« ↻ Recharger l'affichage »**, sous-titre **« relit cockpit/,
n'exécute rien »**.

### 3. `app/src/Terminal.tsx` + `app/src/useTerminal.ts` — remplir sans envoyer, puis focus

Dans `activate()` (l. 118-146) :

- ne plus appeler `decideInjection()` ni `inject()` — **tout** passe par
  `pasteToClaude(text)`, y compris les commandes. Le collage encadré
  (`\x1b[200~…\x1b[201~`) dépose le texte dans la saisie de `claude` sans le valider :
  c'est exactement le comportement demandé, et c'est déjà ce que fait
  `EquipmentPanel.tsx` pour les commandes de skills.
- après un collage réussi : `setActive(<clé de la session claude>)` puis
  `focusClaude()` — le curseur est dans le terminal, l'utilisateur tape la suite ou
  appuie sur Entrée.
- le repli presse-papier (navigateur, pas d'IPC) est inchangé.
- adapter le message : « injecté » → « écrit dans le terminal ».

`decideInjection()` dans `data.ts` **reste tel quel** : `EquipmentPanel.tsx:25`
l'utilise encore. Ses tests (`data.test.ts:539-557`) ne bougent pas.

Dans `useTerminal.ts`, exposer une fonction de focus depuis `useTerminals()` :
elle cherche dans `panes.current` la clé qui finit par `#claude` et appelle
`pane.xterm.focus()`. Elle rejoint `inject` dans l'objet retourné (l. 298-308).
`inject` reste exporté — l'onglet Navigateur ne s'en sert pas, mais rien d'autre non
plus après ce changement ; à supprimer seulement s'il devient réellement mort après
vérification au grep.

### 4. `hooks/i18n.js` + `hooks/i18n.d.ts` — libellés

| Clé | FR | EN |
|---|---|---|
| `terminal.refresh_cockpit` | `↻ Recharger l'affichage` | `↻ Reload display` |
| `terminal.reload_hint` *(nouvelle)* | `Relit cockpit/. N'exécute rien.` | `Re-reads cockpit/. Runs nothing.` |
| `action.crawl` | `Crawler le projet` | `Crawl the project` |
| `terminal.click_injects` | `Un clic écrit la commande dans le terminal. À toi d'envoyer.` | `A click writes the command into the terminal. You press Enter.` |

Ajouter `'terminal.reload_hint'` à l'union `TranslationKey` de `hooks/i18n.d.ts`
(près de la l. 477). `app/src/i18n.test.ts` vérifie la parité FR/EN — les deux blocs
doivent recevoir la clé.

## Fichiers touchés

- `app/src/Terminal.tsx` — l'essentiel du diff
- `app/src/useTerminal.ts` — ajout du focus
- `hooks/i18n.js`, `hooks/i18n.d.ts` — libellés

## Vérification

1. `pnpm typecheck` — la nouvelle clé i18n doit être connue de `TranslationKey`.
2. `pnpm test` — parité FR/EN (`i18n.test.ts`), rendu des onglets (`render.test.tsx`),
   `decideInjection` inchangé (`data.test.ts`).
3. `pnpm electron` — le seul vrai test :
   - les boutons n'ont plus de chevron, l'infobulle montre la commande ;
   - clic sur « ⟳ Crawler le projet » → `!pnpm cockpit:crawl` apparaît dans la saisie
     de `claude` **sans partir**, le curseur clignote dans le terminal, taper du texte
     l'ajoute à la suite, Entrée l'envoie ;
   - clic sur une action de contexte → même chose ;
   - « ↻ Recharger l'affichage » est sous la section contexte, avec sa ligne
     d'explication, et il relit `cockpit/` sans rien écrire dans le terminal ;
   - vérifier dans les trois dispositions (bas / côté / plein).
4. `pnpm package` pour reconstruire le DMG une fois le lot validé.
