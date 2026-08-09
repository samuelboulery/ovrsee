---
{
  "status": "open",
  "title": "Édition des colonnes directement sur le tableau",
  "opened": "2026-08-09",
  "closed": null,
  "commits": []
}
---

# Édition des colonnes directement sur le tableau

## Contexte

L'édition des colonnes vit aujourd'hui dans un panneau latéral de 340 px
(`Colonnes` dans `app/src/tabs/Tableau.tsx`) : une liste de lignes avec des
flèches ↑ ↓, un champ titre et une croix. On y règle des colonnes sans les voir
— le tableau est masqué par le panneau, et réordonner se fait à l'aveugle, un
cran à la fois.

On veut manipuler les colonnes **là où elles sont** : un bouton discret bascule
le tableau en mode édition, et à partir de là on renomme sur place, on fait
glisser une colonne entre deux autres, on la retire, et on en ajoute une par une
tuile en bout de rangée. Le panneau latéral disparaît.

Le panneau de détail d'un ticket, lui, reste : il porte un corps markdown qui n'a
pas sa place dans une colonne de 268 px.

## Ce qui ne change pas

- Un `id` de colonne reste dérivé du titre à la création et **jamais modifiable**
  — c'est ce qui rend les tickets orphelins impossibles. Renommer ne touche que
  le `titre`.
- Retirer une colonne non vide exige toujours une destination, et les fichiers
  de tickets sont réellement réécrits (`removeColumn`, `hooks/tickets.js`).
- La validation d'écriture (`writeBoard`) et les actions HTTP `column-*` de
  `server/api.js` restent en place.

## Travail

### 1. `hooks/tickets.js` — réordonner vers un index

Le glisser-déposer dépose une colonne à une position, pas d'un cran. Remplacer
`moveColumn(cockpitDir, id, delta)` par :

```js
export function reorderColumn(cockpitDir, id, index)
```

- index hors bornes → borné à `[0, longueur-1]` plutôt que de refuser : une
  colonne lâchée après la dernière veut manifestement finir dernière.
- retire la colonne de sa position, la réinsère à `index`, passe par `writeBoard`.
- `moveColumn` disparaît : plus aucun appelant une fois les flèches supprimées.

Tests dans `hooks/tickets.test.js` : remplacer le test `moveColumn` par
`reorderColumn` — déplacement vers la gauche, vers la droite, index négatif,
index au-delà de la fin, colonne inconnue.

### 2. `server/api.js` — action `column-reorder`

Remplacer le `case 'column-move'` par `case 'column-reorder'` appelant
`reorderColumn(cockpitDir, body?.id, body?.index)`. Adapter le test
`/api/tickets édite les colonnes du tableau` dans `server/api.test.js`.

### 3. `app/src/data.ts`

Dans `TicketAction`, `'column-move'` → `'column-reorder'`. Rien d'autre.

### 4. `app/src/tabs/Tableau.tsx` — l'essentiel

**Supprimer** le composant `Colonnes` (~180 lignes), le bouton « Colonnes » de
l'en-tête, l'état `colonnesOuvertes`, et la constante `PANNEAU` retourne à son
seul usage restant (`Detail`).

**Ajouter** un état `edition: boolean` et un bouton discret en haut à droite de
l'en-tête — libellé `Éditer les colonnes` / `Terminer`, `btn btn-ghost`.

**`ColonneVue` en mode édition** (nouvelles props `edition`, `onRenommer`,
`onLimite`, `onRetirer`, `onReordonner`, `tickets` déjà là pour le compte) :

- L'en-tête de colonne devient : poignée `⠿` + `<input>` titre + champ numérique
  limite + `✕`. Le titre garde exactement la taille et la graisse du titre
  affiché (`font-size: 12.5px; font-weight: 500;`) avec une bordure discrète, de
  sorte que le passage en édition ne fasse pas sauter la mise en page.
- Validation du titre au `blur` et à `Entrée` ; `Échap` restaure la valeur.
- La colonne entière devient `draggable` **par la poignée uniquement**
  (`onMouseDown` sur la poignée pose un drapeau local, `onDragStart` de la
  colonne l'exige). Sans ça, glisser une carte depuis l'intérieur d'une colonne
  déplacerait la colonne.
- Hors mode édition, `ColonneVue` se comporte exactement comme aujourd'hui.

**Deux glisser-déposer sur la même surface.** Les distinguer par type MIME plutôt
que par devinette :

- carte : `text/plain` = nom de fichier du ticket (déjà en place, inchangé).
- colonne : `application/x-cockpit-colonne` = `id` de la colonne.

`onDrop` d'une colonne lit d'abord le type colonne ; s'il est présent c'est un
réordonnancement, sinon c'est un ticket. `onDragOver` distingue de même pour
choisir le retour visuel : liseré vertical entre deux colonnes pour un dépôt de
colonne, fond accentué pour un dépôt de ticket.

**Index de dépôt** : la position visée est celle de la colonne survolée, corrigée
par la moitié franchie — `event.clientX` comparé au centre de la colonne cible
donne « avant » ou « après ». C'est ce qui permet de lâcher *entre* deux
colonnes, ce que le panneau ne savait pas faire.

**Tuile d'ajout** : en bout de rangée, en mode édition seulement, une tuile
pointillée de la largeur d'une colonne, « + Ajouter une colonne ». Un clic la
transforme en champ de saisie ; `Entrée` crée, `Échap` annule. Elle sert aussi de
cible de dépôt pour envoyer une colonne en dernière position.

**Suppression sur place** : `✕` ouvre une confirmation **dans la colonne**, à la
place de sa liste de cartes — « n ticket(s) à reloger », un `<select>` des autres
colonnes, `Annuler` / `Retirer`. Colonne vide : confirmation sans `<select>`.
`✕` désactivé s'il ne reste qu'une colonne.

**Repère conservé** : la mention « vaut *terminé* » de la dernière colonne migre
du panneau vers l'en-tête de colonne, en mode édition seulement.

### 5. `skills/cockpit/SKILL.md`

La phrase qui renvoie au bouton « Colonnes » devient « le mode édition de
l'onglet Tableau ».

## Vérification

```bash
pnpm test          # hooks/tickets.test.js + server/api.test.js
pnpm typecheck
pnpm dev           # http://localhost:5180/tableau
```

Dans le navigateur, sur ce dépôt :

1. Basculer en édition → poignées, champs de titre, croix et tuile d'ajout.
2. Faire glisser « Prêt » entre « Backlog » et « À spécifier » → vérifier l'ordre
   dans `cockpit/board.json`.
3. Renommer une colonne → `id` inchangé dans `board.json`, aucun fichier de
   ticket touché (`git diff cockpit/tickets/`).
4. Poser une limite WIP, la retirer.
5. Ajouter une colonne par la tuile, la retirer aussitôt (vide → pas de select).
6. Retirer la colonne qui porte T-0001 avec une destination → le fichier du
   ticket porte la nouvelle colonne.
7. Sortir du mode édition, glisser une carte entre deux colonnes → le
   glisser-déposer des tickets fonctionne toujours, et en mode édition aussi.
8. Remettre `cockpit/board.json` et T-0001 dans leur état d'origine, puis
   `pnpm package`.
