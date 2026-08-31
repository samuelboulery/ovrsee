---
{
  "status": "open",
  "title": "Panneau des commandes : rétraction sur place, et exécution au clic",
  "opened": "2026-08-31",
  "closed": null,
  "commits": [
    {
      "sha": "5dd23c9",
      "date": "2026-09-01",
      "files": [
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/EtatSession.tsx",
        "app/src/Shell.tsx",
        "app/src/Terminal.tsx",
        "app/src/menubar.test.ts",
        "app/src/menubar.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "776034b",
      "date": "2026-09-01",
      "files": [
        "app/src/Terminal.tsx",
        "app/src/pty.test.ts",
        "app/src/pty.ts",
        "app/src/useTerminal.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "53fac6b",
      "date": "2026-09-01",
      "files": []
    }
  ]
}
---

# Panneau des commandes : rétraction sur place, et exécution au clic

## Contexte

Le travail de l'issue #47 est fini et vérifié (tickets T-0217 et T-0224) mais **pas
encore commité** — c'est le premier geste de ce plan.

Suivent deux corrections du panneau des commandes, livré par T-0216 :

1. **Le bouton de rétraction est dans la barre d'outils du terminal**
   (`Terminal.tsx:665-686`), loin du panneau qu'il commande, et rétracter fait
   **disparaître le panneau entier** (`:783` `{bandeOuverte && …}`). Rien ne reste à
   l'écran pour dire qu'il existe ni comment le rouvrir.

2. **Une commande ne se lance jamais.** `activate` (`:492-513`) colle avec `pasteTo`,
   sans valider — y compris pour `/graphify` et les `!…`. `decideInjection` est bien
   appelé (`:819`) mais **seulement pour choisir l'icône** : le `+ '\n'` qu'il produit
   est jeté. L'interface promet pourtant le contraire — pastille `Play`, titre
   « Exécutée au clic » (`terminal.mode_run`). Et lancer une commande dans un terminal
   déjà occupé écraserait ce qui y tourne.

Décidé : « occupé » = ce qu'on a lancé soi-même (aucune devinette) ; état rétracté =
bande fine le long du bord ; les commandes en mode « colle sans valider » ne changent pas.

---

## 0. Commiter l'issue #47

Un seul commit, message français en Conventional Commits, citant T-0217 et T-0224 et
l'issue #47. Le hook `post-commit` fera avancer les deux tickets.

## 1. Le bouton passe dans le panneau — `app/src/Terminal.tsx`

- **Retirer** le bouton `SidebarSimple` de la barre d'outils (`:665-686`) ; l'épingle et
  la réduction y restent.
- Le panneau n'est **plus conditionné** par `bandeOuverte` : il est toujours rendu, dans
  l'une de deux formes.
  - **Déployé** : ce qu'il est aujourd'hui (268 px en colonne, bande basse en `side`),
    avec le bouton posé en tête, sur la ligne du titre « Mes commandes ».
  - **Rétracté** : une bande de 28 px le long du même bord, ne contenant que ce bouton.
    Le panneau garde ainsi sa place dans la mise en page — rien ne saute au dépliage.
- **Icône** : `CaretRight`/`CaretLeft` de Phosphor en disposition `bottom` et `full`,
  `CaretDown`/`CaretUp` en `side`, où la bande est horizontale. Les libellés
  `terminal.actions_hide` / `terminal.actions_show` et `aria-expanded` restent.
- `bandeOuverte` et sa clé `localStorage` `ovrsee.terminal.actions` ne bougent pas.

## 2. Une commande se lance vraiment — `activate` (`Terminal.tsx:492-513`)

`decideInjection(action.text).mode` décide, comme il décide déjà l'icône :

- `context` → `pasteTo`, **inchangé**. C'est du texte à relire.
- `command` → `submitTo` (`app/src/pty.ts:167`, déjà écrit et déjà utilisé par
  `tabs/Navigateur.tsx`). Passer `action.text` **brut** : `submitTo` ajoute son `\r`,
  et le `+ '\n'` de `decideInjection` ferait un retour de trop.

Le repli navigateur (presse-papier) ne change pas.

## 3. « Occupé », et le nouveau terminal

**La règle, en fonction pure** — dans `app/src/pty.ts`, testée dans `pty.test.ts` (les
deux existent, pas de nouveau fichier) :

```ts
/** Où part une commande cliquée : la session visée, ou un terminal neuf. */
export function cibleDeCommande(entree: {
  mode: 'command' | 'context'
  actif: string | null
  claudeKey: string | null
  ptyIds: Record<string, string>
  occupees: ReadonlySet<string>
}): { cible: string } | { neuf: true } | null
```

- Cible de départ : l'onglet actif s'il a un pty, sinon `claudeKey` — la règle
  d'aujourd'hui (issue #49), déplacée telle quelle.
- `mode === 'command'` **et** cible occupée → `{ neuf: true }`.
- `mode === 'context'` → toujours la cible, occupée ou non.

**Ce qui remplit `occupees`** — un `useRef<Set<string>>` dans `Terminal.tsx`, à côté de
`attentions` :

- **posé** quand une commande immédiate part dans une session ;
- **retiré** quand l'utilisateur tape dedans — le rappel `onSaisie` de `useTerminals`
  existe déjà (`useTerminal.ts`, type `OnSaisie`), il sert aujourd'hui à repasser une
  session de `question` à `busy` ; une frappe veut dire qu'on a repris la main ;
- **retiré** quand le pty disparaît de `ptyIds` (session fermée ou morte) ;
- une session Claude dont le dernier signal est `busy` compte comme occupée, sans qu'on
  ait rien posé : `attentions.current[key]?.kind === 'busy'` est déjà là.

**Ouvrir et écrire dedans.** `openShell()` (`useTerminal.ts:283-299`) ne rend rien, et
le pty n'existe pas à son retour — il apparaît dans `ptyIds` après l'aller-retour IPC.
Deux petits changements :

1. `openShell` rend la clé de la session qu'il vient de créer (`return session.key`) ;
   ses appelants actuels (⌘D, bouton `+`) ignorent la valeur, rien à changer chez eux.
2. Dans `Terminal.tsx`, un `useRef<{ key: string; text: string; label: string } | null>`
   retient l'écriture en attente ; un effet sur `ptyIds` la vide dès que la clé y
   apparaît. Sans ce relais, le texte retomberait sur `claudeKey` et partirait chez
   Claude.

Le message de statut dit lequel des deux a eu lieu — « lancé dans le terminal » ou
« lancé dans un nouveau terminal ».

## 4. Ce que l'interface annonce — `hooks/i18n.js`

`terminal.click_injects` dit « Un clic écrit dans le terminal, sans envoyer » : faux
pour les commandes à partir de maintenant. Réécrire la phrase (FR et EN) pour dire les
deux comportements, celui que la pastille montre déjà par ligne.

## 5. Tickets

Un ticket pour ce lot, lié au plan capturé, colonne `pret` — le gate d'édition en exige
un de toute façon. Les critères d'acceptation sont ceux listés en vérification.

---

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — `cibleDeCommande` couverte : mode
   `context` sur session occupée → la cible ; mode `command` sur session occupée →
   `{ neuf: true }` ; aucun pty nulle part → `null` (repli presse-papier) ; onglet actif
   sans pty → repli sur `claudeKey`.
2. `pnpm electron` :
   - rétracter : le panneau devient une bande fine avec le seul chevron, le terminal
     prend la place, le chevron rouvre. L'état survit à un redémarrage de l'app.
   - cliquer « Graphe complet » (`/graphify`) dans un terminal au repos → elle **part**,
     sans qu'on ait à appuyer sur Entrée.
   - relancer la même commande pendant qu'elle tourne → un nouvel onglet shell s'ouvre
     et la commande y part, l'ancien continue sans être touché.
   - taper quoi que ce soit dans l'onglet occupé, puis recliquer → la commande repart
     dans cet onglet, pas dans un nouveau.
   - une commande sans `!` ni `/` → toujours collée sans validation, même occupé.
   - dans le navigateur (`pnpm dev`, sans terminal) → toujours copiée dans le
     presse-papier.
