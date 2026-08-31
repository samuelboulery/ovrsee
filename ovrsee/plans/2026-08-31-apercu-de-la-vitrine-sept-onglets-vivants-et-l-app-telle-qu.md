---
{
  "status": "closed",
  "title": "Aperçu de la vitrine : sept onglets vivants, et l'app telle qu'elle est",
  "opened": "2026-08-31",
  "closed": "2026-09-01",
  "commits": [
    {
      "sha": "1f97b41",
      "date": "2026-09-01",
      "files": [
        "scripts/build-site-fr.test.js",
        "site/app.js",
        "site/dict.json",
        "site/index.html",
        "site/styles.css"
      ]
    },
    {
      "sha": "357b425",
      "date": "2026-09-01",
      "files": []
    }
  ]
}
---

# Aperçu de la vitrine : sept onglets vivants, et l'app telle qu'elle est

## Contexte

La démo de `ovrsee.app` (le « stage » de `site/index.html`, piloté par `site/app.js`)
montre une fenêtre de l'application à l'échelle 1400×820. Trois défauts :

- **Quatre vues sur sept ont une maquette.** `DÉMONTRABLES` (`site/app.js:39`) limite les
  clics à `apercu`, `produit`, `historique`, `tableau` ; cliquer *Browser*, *Data* ou
  *Stack* ne fait rien, en silence. La barre latérale annonce pourtant « Views 7 ».
- **Aucun survol sur ces lignes.** Rien ne dit qu'elles sont cliquables.
- **La maquette a dérivé de l'app.** Le graphique d'activité pend du haut au lieu de
  pousser depuis une ligne de base ; le Kanban montre encore une carte *epic* avec sa
  barre de progression, alors que les epics ont quitté le Kanban pour la vue Epics
  (`app/src/tabs/Tableau.tsx:296` les filtre) ; les colonnes ne sont pas les six par
  défaut de `hooks/board.js:24-29`.

Résultat visé : les sept onglets se visitent, réagissent au survol, et ce qu'ils montrent
est ce que l'application affiche vraiment.

Contrainte de tout le travail : **la source est l'anglais**, `site/fr/` en dérive
(`scripts/build-site-fr.js`). Toute chaîne nouvelle doit avoir sa clé dans
`site/dict.json`, sinon la page française reste anglaise à cet endroit, sans erreur.

## 1. Survol des lignes de vues

`site/app.js`, fonction `valeurs()` (~ligne 76) : chaque ligne reçoit déjà `rowStyle`.
Ajouter sur le gabarit (`site/index.html:192`) un attribut marqueur `data-view-row`, et
`data-active` quand la vue est active (le fond actif est inline, il doit gagner).

`site/styles.css`, section « survols » (après la ligne 135) :

```css
[data-view-row]:not([data-active]):hover {
  background: #16181e !important;
}
[data-view-row] { transition: background-color .15s, color .15s; }
```

Même mécanique `!important` que les règles `style-hover` existantes, et pour la même
raison : battre le `style` inline.

## 2. Les trois maquettes manquantes

Retirer `DÉMONTRABLES` de `site/app.js` (les sept vues deviennent cliquables ; `pick` et
`rowStyle` se simplifient), ajouter `isNavigateur` / `isDonnees` / `isStack` aux valeurs
rendues, et trois entrées `fr`/`en` dans `MÉTA` (titre de barre de vue, meta, statut
gauche/droite).

Chaque maquette est un `<div data-if="isX">` inséré dans `site/index.html` à côté des
quatre existants (`isApercu:260`, `isHistorique:422`, `isTableau:543`, `isProduit:672`),
dans le même style : mise en page en attributs `style`, aucun CSS ajouté.

**Navigateur** (`app/src/tabs/Navigateur.tsx`) — seul onglet **sans barre de vue** : la
barre de vue partagée doit être masquée pour lui (une valeur `showViewBar` de plus, à
poser en `data-if` sur le bandeau). De haut en bas :

- barre d'outils 40 px : `←` `→` `⟳`, champ URL en mono, bouton *Select* (icône curseur),
  bouton *DevTools*, mini-segmenté *Bottom* / *Right* ;
- zone d'aperçu **fond blanc avec un faux site clair** (en-tête, héro, deux colonnes),
  surmontée de la carte d'élément flottante 286 px en haut à droite : sélecteur CSS en
  mono, zone de texte « What's wrong here… », boutons *Create a ticket* et avion en papier
  *Send to Claude* ;
- **bandeau console déplié** : `▾ Console — 3 errors, 1 warning`, liste mono avec `✕`
  rouge et `▲` orange, source en suffixe, bouton *Send to Claude* à droite ;
- barre d'état : puce verte, `localhost:5173 responds · loaded in 412 ms` à gauche,
  `selector: ⇧⌘E | ⌘K` à droite.

**Données** (`app/src/tabs/Donnees.tsx`) — barre de vue « **Tables** » (c'est bien ce mot,
pas « Data »), puce de provenance `read from Graphify — 2026-08-14`, bouton *Check live
schema*. Corps : une phrase d'intro grise, puis un tableau pleine largeur à quatre
colonnes `Table` · `Columns` · `Used by` · `Confidence` (en-têtes 11 px majuscules
espacées, filets horizontaux). Cellules : nom en mono, nombre, jusqu'à trois pages jointes
par « · », pastille `LIVE` / `EXTRACTED` / `INFERRED` / `AMBIGUOUS` (cette dernière en
pointillé). Barre d'état : rien à gauche, `⌘K` seul à droite.

**Stack** (`app/src/tabs/Stack.tsx`) — barre de vue « Stack » + segmenté *All* /
*Production* / *Without a reason*. Corps : rail de progression 4 px + `18 of 42 have one.`,
puis deux colonnes (`PRODUCTION · 4`, `DEVELOPMENT · 38`) de cartes en grille : à gauche
nom 13 px et version en mono dessous, à droite la raison — ou le gris
« No reason written. A `WHY:` comment above its import will show up here. » Barre d'état
comme Données.

## 3. Les écarts des maquettes existantes

**Graphique d'activité** (`site/index.html:503-509`, données `HAUTEURS` dans
`site/app.js:43`). Le markup se dit déjà ancré en bas (`align-items: flex-end`,
`justify-content: flex-end`) et pourtant les barres pendent du haut : **diagnostiquer la
cause dans le navigateur avant de corriger** — le suspect est le moteur de gabarit
(`appliquer()`/`lier()`, `site/app.js:135-190`), qui clone le patron et pourrait perdre la
hauteur du conteneur. Corriger la cause, puis reproduire l'algorithme réel de
`app/src/ActivityPanel.tsx:267-286` :

- normalisation sur le total le plus chargé (la plus haute colonne touche les 88 px) —
  aujourd'hui `HAUTEURS` sont des pixels bruts qui n'occupent qu'un tiers de la boîte ;
- ordre dans la colonne, du haut vers le bas : commits, tickets, plans (donc l'accent en
  bas), inchangé — c'est celui de l'app ;
- segment minimum 2 px, et trait résiduel de 3 px en `#2b2d35` pour un jour vide ;
- 14 colonnes, la plus ancienne à gauche.

**Tableau** (`site/index.html:543-671`) :

- supprimer la carte *epic* T-0125 (badge `epic`, barre de progression, « View 3
  children ») : un epic n'est plus une carte ;
- ajouter le segmenté **Kanban | Epics** dans la barre de vue, à côté de *Edit columns*
  (`site/index.html:255`), Kanban actif ;
- coller aux six colonnes par défaut : ajouter `Backlog` et `To spec` avant `Ready`,
  garder `In progress` (WIP `⚠ 3/2`), `Review`, `Done`. Le rail défile déjà
  (`overflow-x: auto`) ;
- poser sur un ticket le badge outline `child of T-0125`, qui est ce que l'app affiche
  désormais à la place (`app/src/tabs/TableauCarte.tsx:77-97`).

## 4. Traductions

Ajouter dans `site/dict.json` une entrée par chaîne anglaise nouvelle (barres d'outils,
en-têtes de tableau, pastilles, textes de console, libellés de colonnes). Les clés sont le
texte anglais exact, tel qu'il apparaît entre deux balises — c'est ainsi que
`traduire()` (`site/app.js:233`) et `scripts/build-site-fr.js` le retrouvent.

## 5. Garde-fou

Un test de plus dans `scripts/build-site-fr.test.js`, dans le style du fichier : pour
chacun des sept ids de vue, la page contient `data-if="is<Vue>"`. C'est exactement la
régression du jour — une vue listée sans maquette — et elle ne coûte que trois lignes.

## Vérification

1. `node scripts/build-site-fr.js && node --test scripts/build-site-fr.test.js` — la page
   française se régénère, les tests passent.
2. `pnpm lint` (oxlint couvre `site`).
3. Servir la vitrine en local (`python3 -m http.server` depuis `site/`, ou `pnpm dev` puis
   le fichier) et, sur `/` **et** `/fr/` :
   - survoler les sept lignes : fond qui s'éclaircit, sauf sur la ligne active ;
   - cliquer les sept : chacune montre sa maquette, barre de vue et barre d'état
     comprises ;
   - le graphique d'activité : barres posées sur la ligne du bas, la plus chargée touchant
     le haut de la boîte ;
   - le Tableau : six colonnes, aucun epic parmi les cartes, segmenté Kanban/Epics visible ;
   - réduire la fenêtre sous 900 px : le stage se réduit et défile sans casser.
4. Comparer côte à côte avec l'application (`pnpm electron`) les trois nouveaux onglets.
