---
{
  "status": "open",
  "title": "Lire un ticket en grand, et rendre les terminaux bavards",
  "opened": "2026-08-19",
  "closed": null,
  "commits": []
}
---

# Lire un ticket en grand, et rendre les terminaux bavards

## Contexte

Le lot précédent (epics hors du Kanban, pastille de session, renommage manuel) est
posé et vert. Trois manques constatés en l'utilisant :

1. **Le panneau de ticket est trop étroit.** 340 px figés : un corps de ticket
   markdown s'y lit en colonne de trois mots. Il faut pouvoir l'élargir, et
   pouvoir l'ouvrir vraiment grand pour une longue lecture.
2. **Les onglets terminal ne disent pas ce qu'ils font.** « shell 1 », « shell 2 »
   ne se distinguent pas ; le renommage manuel existe mais on ne va pas nommer
   chaque session à la main.
3. **La pastille est muette pendant le travail.** Elle ne connaît que « a fini »
   et « attend une réponse ». Or l'essentiel du temps, Claude *travaille* — et
   c'est justement l'état qu'on regarde pour savoir s'il faut revenir.

Le fil commun des deux derniers : le canal de signal existe déjà et ne porte que
deux genres. Il en manque un troisième, `busy`, et il porte avec lui le texte de
la demande — donc le nom de l'onglet.

Décisions prises : panneau redimensionnable **plus** bouton d'agrandissement en
modale ; nom automatique tiré du **prompt soumis** ; un nom saisi à la main
**gagne définitivement** sur l'automatique.

---

## 1. Le panneau de ticket s'élargit, et s'agrandit

**`app/src/tabs/Tableau.tsx` → extraire `Detail` dans `app/src/tabs/TableauDetail.tsx`.**
`Detail` fait ~330 lignes dans un fichier qui en compte encore 1133 (T-0135
signale le dépassement) ; il doit de toute façon savoir se rendre dans deux
enveloppes, autant le sortir maintenant.

- **Largeur tirable** — `useResizable` (`app/src/useResizable.tsx`), avec son
  compagnon `Divider`, exactement comme le rail de Produit
  (`Produit.tsx:53`) : `{ key: 'tableau.detail', initial: 340, min: 300, max: () => innerWidth * 0.7, axis: 'x', invert: true }`.
  La largeur est retenue en `localStorage` par le hook, et le double-clic sur la
  poignée revient à 340 — les deux sont déjà dans le hook, rien à écrire.
  La constante `PANNEAU` (`Tableau.tsx:396`) perd son `width` figé, qui devient
  la valeur rendue par le hook.
- **Bouton `⤢`** dans l'en-tête du panneau, à côté de la fermeture : il bascule
  un état `agrandi`. Icône `ArrowsOut` / `ArrowsIn` de `@phosphor-icons/react`,
  déjà en dépendance.
- **Enveloppe modale** quand `agrandi` : motif de `CommandPalette.tsx:150-261` —
  `position: fixed; inset: 0; z-index: 50`, fond `rgba(6,7,14,.88)` +
  `backdrop-filter: blur(3px)`, boîte `role="dialog"` `aria-modal="true"` avec
  `aria-label`, `onClick` du fond qui ferme, `stopPropagation` sur la boîte,
  `Escape` qui referme (vers le panneau, pas vers rien : on ne perd pas le
  ticket ouvert). Boîte `width: min(900px, 100%); max-height: 85vh;
  overflow-y: auto`.
  Les classes `.dialog-backdrop` / `.dialog` du design system
  (`_ds/ovrsee/styles.css:393-408`) sont calibrées pour une boîte de 440 px : les
  citer ici obligerait à les surcharger, le motif `CommandPalette` est le bon.
- **Un seul corps**, deux enveloppes : `TableauDetail` prend une prop
  `mode: 'panneau' | 'modale'` et choisit son emballage. Le contenu — lecture,
  édition, métadonnées, suppression — ne se dédouble pas.

---

## 2. Un troisième genre de signal : `busy`, qui porte la demande

**`hooks/ovrsee-notify.js`** — le fichier est déjà écrit pour ça, `sequence()`
ne connaît pas les genres qu'elle encode :

- `genrePour` : `hook_event_name === 'UserPromptSubmit'` → `'busy'`.
- `detailPour` : pour cet événement, rendre `payload.prompt` nettoyé (le champ
  est du texte libre, `sequence()` le tronque déjà à `MAX_DETAIL` et l'encode en
  base64 — un retour à la ligne ou un BEL dans un prompt ne casse donc rien).
- La garde `projetEquipe` et le contrat stdout ne bougent pas.

**`hooks/install.js`** — ajouter `'UserPromptSubmit'` à la boucle
d'enregistrement (ligne 272) **et** à la liste exigée par `signalInstalle`
(ligne 143). Conséquence assumée et voulue : une machine équipée avant ce lot
sera signalée « signal non installé » par la barre de menu jusqu'à un
`pnpm ovrsee:install`. C'est exactement le piège que `CLAUDE.md` décrit — mieux
vaut le dire que laisser la fonctionnalité manquer en silence.

Attention : `ovrsee-capture-audit.js` est déjà enregistré sur `UserPromptSubmit`.
Les entrées s'ajoutent au tableau, elles ne s'écrasent pas — le `isOvrsee(e, 'ovrsee-notify')`
distingue bien les deux.

**`app/src/attention.ts`** — `AttentionKind` gagne `'busy'`, `isKind` l'accepte.
Le `COMPLETE` (`[a-z-]+`) le reconnaît déjà sans changement.

Y ajouter aussi la fonction pure qui fabrique l'étiquette :

```ts
/** Le nom d'onglet tiré d'une demande : première ligne, coupée court. */
export const etiquetteDe = (prompt: string): string => { /* première ligne, trim, ~28 car., ellipse */ }
```

Elle vit ici parce que c'est déjà le fichier des fonctions pures éprouvées
d'`attention.test.ts`, et qu'une coupe de chaîne se teste au lieu de se
constater à l'œil.

---

## 3. Le nom automatique, et le nom manuel qui gagne

**`app/src/useTerminal.ts`** — `renommer(key, label)` existe. Lui ajouter la
distinction :

- Une référence `nommesMain = useRef(new Set<string>())`.
- `renommer(key, label, { manuel = true })` : inscrit la clé dans le `Set` quand
  l'appel vient du double-clic ; un appel automatique qui trouve la clé dedans
  **ne fait rien**.
- Rien n'est persisté, comme aujourd'hui : les sessions ne survivent pas à
  l'application.

**`app/src/Terminal.tsx`** — dans le gestionnaire `onAttention`, sur un
`busy` porteur d'un détail : `renommer(sessionKey, etiquetteDe(detail), { manuel: false })`.
La session Claude par défaut (`label: 'claude'`) se renomme donc dès la première
demande, ce qui est le but.

Deux gardes à ne pas oublier dans ce même gestionnaire :

- **Aucune notification système sur `busy`.** La branche `new Notification(...)`
  doit sortir avant : une notification à chaque demande envoyée serait un
  harcèlement, et elle annoncerait un événement que l'utilisateur vient de
  provoquer lui-même.
- **La barre de menu** : `estDecidable` (`app/src/menubar.ts`) ne teste que
  `kind === 'question'`, et le titre du tray aussi — rien à changer, mais le
  vérifier. `composer` classera une session `busy` avant une session muette :
  c'est le bon ordre.

---

## 4. La pastille devient un état animé

Trois états dans une case de largeur fixe (12 px), à la place de la pastille de
5 px (`Terminal.tsx:339-343`) :

| Genre | Signe | Rendu |
|---|---|---|
| `busy` | trois points | animation d'opacité en cascade, décalage 0 / 160 / 320 ms |
| `stop` | `Check` (Phosphor) | vert `--color-ok` |
| `question` | `Question` (Phosphor) | accent |
| aucun | pastille actuelle | inchangé |

`s()` ne sait pas déclarer une `@keyframes` : la règle va dans
**`_ds/ovrsee/styles.css`** (`@keyframes ovrsee-battement` + une classe
`.battement`), le décalage de chaque point restant en style inline. C'est le
seul endroit possible — `app/src` n'a pas de `.css`, par convention.

**Sous `@media (prefers-reduced-motion: reduce)`, l'animation est neutralisée**
et les trois points restent affichés fixes : l'information ne dépend jamais du
mouvement.

Comportement au clic : ouvrir un onglet efface un `stop` ou un `question` — ils
ont été vus. Un `busy` **ne s'efface pas** : la session travaille toujours, et
l'éteindre mentirait. Il sera remplacé par le `stop` qui suit.

---

## 5. Tests, textes, docs

- **`app/src/attention.test.ts`** — un `busy` avec détail se décode ;
  `etiquetteDe` sur une demande multi-lignes, une demande vide, une demande plus
  longue que la coupe.
- **`hooks/notify.test.js`** — `genrePour({hook_event_name:'UserPromptSubmit'})`
  rend `'busy'` ; `detailPour` rend le prompt ; un `UserPromptSubmit` sans
  `prompt` ne casse rien.
- **`hooks/install.test.js`** — `UserPromptSubmit` reçoit bien l'entrée
  `ovrsee-notify` **à côté** de celle de `ovrsee-capture-audit` ;
  `signalInstalle` rend `false` quand elle manque.
- **`app/src/render.test.tsx`** — le détail rendu dans ses deux modes sur les
  instantanés dégradés, comme les onglets.
- **`hooks/i18n.js` + `hooks/i18n.d.ts`** — clés fr **et** en :
  `tableau.expand`, `tableau.collapse`, `terminal.attention_busy`.
- **`CLAUDE.md`** — le piège s'étend : le signal de session compte désormais
  **trois** événements, et `UserPromptSubmit` renomme l'onglet.
- **`CHANGELOG.md` / `CHANGELOG.fr.md`**.
- **Tickets** `ovrsee/tickets/` via le skill `ovrsee-tickets`, un par lot.

---

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:ui
pnpm ovrsee:install          # sans quoi UserPromptSubmit n'émet rien
pnpm electron
```

1. **Panneau** — ouvrir un ticket, tirer la poignée : le panneau s'élargit
   jusqu'aux 70 % de la fenêtre, double-clic pour revenir à 340 px, largeur
   retrouvée après redémarrage.
2. **Modale** — `⤢` ouvre la grande lecture ; `Escape` et le clic sur le fond
   ramènent au panneau sans fermer le ticket ; le markdown du corps s'y lit sur
   toute la largeur.
3. **Nom automatique** — envoyer une demande dans un terminal : l'onglet prend
   ses premiers mots. En envoyer une autre : le nom change.
4. **Nom manuel** — double-clic, nommer « build », envoyer une demande :
   le nom reste « build ».
5. **Animation** — pendant que Claude travaille, trois points battent ; à la fin,
   une coche verte ; sur une demande de permission, un point d'interrogation.
   Aucune notification système au départ d'une demande. Activer « réduire les
   animations » dans macOS : les points restent, immobiles.
6. **Barre de menu** — une session `busy` n'y propose pas Autoriser/Refuser.
