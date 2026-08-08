---
{
  "status": "closed",
  "title": "Produit — le graphe passe dans un canevas zoomable",
  "opened": "2026-08-08",
  "closed": "2026-08-08",
  "commits": [
    {
      "sha": "f18104f",
      "date": "2026-08-08",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Produit.tsx",
        "app/src/useMeasure.ts",
        "app/src/usePanZoom.ts"
      ]
    }
  ]
}
---

# Produit — le graphe passe dans un canevas zoomable

## Contexte

Le graphe de navigation est aujourd'hui *responsive* : `Produit.tsx:50-54` mesure la largeur
disponible, en déduit `maxPerRow`, et `layoutGraph()` (`data.ts:252`) découpe une profondeur
trop large en sous-rangées via `chunk()`.

Conséquence — **des pages de même profondeur ne sont plus sur la même rangée**. C'est
précisément ce que la carte est censée montrer : « ces quatre pages sont à un clic de
l'accueil ». Repliées, elles se lisent comme deux niveaux distincts. Les arêtes rattrapent le
sens (`Edges` trace un détour par une voie latérale, `Produit.tsx:234-244`), mais rattraper
n'est pas montrer. Trois emplâtres cohabitent pour la même raison : le repli en sous-rangées,
le détour d'arête, et un `transform: scale(0.82)` quand le terminal passe sur le côté
(`Produit.tsx:101-107`).

Un canevas les remplace tous les trois. La disposition devient **une rangée par profondeur,
sans exception** ; quand elle ne tient pas dans la fenêtre, on dézoome — le geste est explicite
et réversible, contrairement à un repli qui, lui, ment sur la structure.

Décidé avec l'utilisateur : gestes façon Figma/Miro (deux doigts = déplacer, pincement ou
⌘+molette = zoomer), et les blocs « Redirections » / « Captures sans page correspondante »
passent dans un bandeau repliable en bas.

---

## 1. Une rangée par profondeur — `app/src/data.ts`

`layoutGraph(pages, maxPerRow)` perd son second paramètre, et `chunk()` (l. 239-244) disparaît
avec lui — plus aucun appelant. Le corps garde tout le reste : parcours en largeur pour la
profondeur, page orpheline rangée au bout, sous-rangée centrée sur la plus large.

```ts
export function layoutGraph(pages: Page[]): { placed: Placed[]; width: number; height: number }
```

`width = widest * COL_STEP`, `height = rows * ROW_STEP`. Les constantes `CARD_W`, `CARD_H`,
`COL_STEP`, `ROW_STEP` ne bougent pas : les arêtes s'y ancrent.

Le commentaire du `@param maxPerRow` (l. 246-251) est remplacé par la raison inverse : une
profondeur large déborde volontairement, et c'est le zoom qui la ramène à l'écran.

---

## 2. Le canevas — `app/src/usePanZoom.ts` (nouveau)

Hook d'une centaine de lignes, sans dépendance. Il possède le viewport, sa taille, le zoom et
le décalage.

```ts
usePanZoom() → {
  ref,                       // le viewport, mesuré par ResizeObserver
  width, height,             // taille du viewport
  zoom, pan,                 // état courant
  panning,                   // pour le curseur grab / grabbing
  fit(contentW, contentH),   // ajuste et centre
  zoomBy(factor),            // boutons − / +
  reset(),                   // retour à 100 %
}
```

- **Molette** : `deltaX`/`deltaY` déplacent. `ctrlKey`/`metaKey` zooment — Chrome rapporte le
  pincement trackpad comme un `wheel` avec `ctrlKey`, donc le même chemin sert aux deux.
  Le zoom est ancré sur le pointeur : `pan ← point − (point − pan) × facteur`.
  L'écouteur est posé en `useEffect` avec `{ passive: false }` : `onWheel` de React est
  passif, et `preventDefault()` y est ignoré — la page défilerait sous le canevas.
- **Glisser** : `pointerdown` / `pointermove` / `pointerup` sur le viewport. Le déplacement ne
  commence qu'au-delà de 4 px ; en deçà, c'est un clic et la carte le reçoit. Un glisser qui a
  dépassé le seuil arrête le `click` suivant en phase de capture, sinon relâcher sur une carte
  la sélectionnerait.
- **Bornes** : zoom entre 0,2 et 2.
- `fit()` prend le plus petit rapport entre la place et le contenu, plafonné à 1 — on ne
  grossit jamais au-delà de la taille naturelle des cartes, dont les vignettes sont des PNG.

`app/src/useMeasure.ts` est **supprimé** : son unique appelant est ce graphe, et le hook ne
suivait que la largeur alors qu'un ajustement demande aussi la hauteur.

### Pas de test unitaire

La bascule est un comportement de pointeur : le vérifier demanderait jsdom et un lanceur de
tests pour le TypeScript de l'interface, qui n'en a aucun aujourd'hui. La seule ligne de calcul
— l'ancrage du zoom — se vérifie à l'œil en un geste (§ Vérification). On n'installe pas une
chaîne de tests pour une multiplication.

---

## 3. La zone Produit — `app/src/tabs/Produit.tsx`

Trois blocs empilés, plus de défilement d'ensemble :

```
flex: 1, colonne
├─ en-tête        titre, compte, légende, alerte de scan raté   (flex: none)
├─ viewport       overflow: hidden, position: relative           (flex: 1)
│   ├─ <div transform: translate(pan) scale(zoom); transform-origin: 0 0>
│   │     <Edges/> + <PageCard/>…
│   └─ <Controls/>   en surimpression, en bas à gauche
└─ <Footnotes/>   bandeau repliable                              (flex: none)
```

- **`Controls`** : `[−] 68 % [+] ⤢`. Le pourcentage cliquable revient à 100 %, `⤢` ajuste.
  Mêmes boutons que la barre de disposition du terminal (`Terminal.tsx:136-150`), pour que
  le cockpit garde un seul vocabulaire.
- **Ajustement automatique** : `fit()` au premier rendu, puis à chaque changement de projet ou
  de nombre de pages, **et** au redimensionnement du viewport tant que l'utilisateur n'a pas
  zoomé ou déplacé lui-même. Un `touched` en `useRef` garde la main une fois qu'il l'a prise :
  reformater sous les doigts serait le défaut qu'on corrige, en pire.
- Le `transform: scale(0.82)` de la disposition « côté » (l. 101-107) **disparaît** :
  l'ajustement automatique fait mieux, et pour la bonne raison.
- **`Edges`** perd sa branche de détour (l. 234-244) et la constante `lane` : avec une rangée
  par profondeur, un lien vers `depth + 1` descend toujours d'exactement un `ROW_STEP`. Le
  commentaire de tête garde l'essentiel — pourquoi seuls les liens vers la profondeur suivante
  sont tracés — et perd le paragraphe sur les sous-rangées, qui n'existent plus.
- **`Footnotes`** (nouveau, dans le même fichier) : replié, une ligne
  `▸ 1 redirection · 2 captures orphelines` ; déplié, les corps actuels de `Redirects`
  (l. 526) et `Orphans` (l. 506) inchangés, dans un bloc `max-height: 34%; overflow: auto`.
  Rien du tout quand les deux sont vides.
- La visionneuse de captures et le rail de détail ne bougent pas : `DetailPanel` reste tel
  quel, `Lightbox` reste en `position: fixed` — au-dessus du canevas, insensible à son zoom.

---

## Fichiers

| Fichier | Nature |
|---|---|
| `app/src/usePanZoom.ts` | nouveau |
| `app/src/useMeasure.ts` | supprimé (absorbé) |
| `app/src/data.ts` | `layoutGraph` sans `maxPerRow`, `chunk` retiré |
| `app/src/tabs/Produit.tsx` | canevas, `Controls`, `Footnotes`, `Edges` simplifié |

Aucune dépendance ajoutée — pas de react-zoom-pan-pinch ni de d3 : deux `transform` CSS et
un `ResizeObserver` suffisent, et le rendu reste du DOM, donc les cartes gardent leurs
vignettes, leur survol et leur clic.

---

## Vérification

1. `pnpm typecheck` et `pnpm test` (88 tests) — la partie Node n'est pas touchée, elle ne doit
   pas bouger.
2. `pnpm dev`, onglet **Produit**, sur le projet `cockpit` (5 pages, une profondeur à 3 sœurs) :
   - les trois pages de profondeur 1 sont **sur la même ligne**, quelle que soit la largeur de
     la fenêtre ; rétrécir la fenêtre dézoome au lieu de replier ;
   - deux doigts vers le bas déplacent le graphe, ne font pas défiler la page ;
   - pincement trackpad : le point sous le curseur reste sous le curseur — c'est le contrôle
     de l'ancrage du zoom ;
   - glisser le fond déplace ; relâcher sur une carte après un glisser **ne la sélectionne
     pas** ; un clic net la sélectionne et ouvre le rail ;
   - `⤢` recadre, le `%` revient à 100 %, les bornes 20 %–200 % tiennent ;
   - passer le terminal en disposition « Côté » : le graphe se réajuste ; après un zoom manuel,
     il ne se réajuste plus.
3. Ouvrir un projet à profondeur large (`associa` ou `humankindr-platform` dans la barre
   latérale) : vérifier qu'une rangée de six sœurs sort du cadre au zoom 100 % et rentre
   entièrement après `⤢`.
4. Bandeau du bas : sur `cockpit`, `/backlog` est redirigé — le bandeau affiche
   « 1 redirection », se déplie au clic, se replie.
5. `pnpm package` puis relancer `release/mac-arm64/Cockpit.app` pour vérifier le geste de
   pincement dans la vraie fenêtre, où le trackpad se comporte comme dans le reste de macOS.
