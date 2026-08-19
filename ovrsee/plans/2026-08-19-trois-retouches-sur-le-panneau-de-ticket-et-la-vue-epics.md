---
{
  "status": "open",
  "title": "Trois retouches sur le panneau de ticket et la vue Epics",
  "opened": "2026-08-19",
  "closed": null,
  "commits": []
}
---

# Trois retouches sur le panneau de ticket et la vue Epics

## Contexte

Suite du passage précédent, trois écarts visuels relevés à l'usage. Rien de
fonctionnel : trois valeurs et un regroupement, tous dans deux fichiers.

---

## 1. Le rembourrage du haut n'égale pas celui des côtés

`app/src/tabs/TableauDetail.tsx`, constante `EN_TETE`. Elle porte
`padding: 4px var(--detail-pad) 12px` : les côtés suivent le conteneur (18 px
dans le rail, 24 px dans la modale) mais le haut reste bloqué à 4 px. Ouvert en
grand, le ticket touche presque le bord supérieur pendant qu'il respire sur les
côtés.

**Le haut prend la même variable** : `padding: var(--detail-pad) var(--detail-pad) 12px`.
Le bas reste à 12 px — c'est un espacement interne entre l'en-tête et le titre,
pas une marge de boîte, et l'aligner sur les autres creuserait un trou.

---

## 2. Les trois boutons d'en-tête se collent

Ils héritent du `gap: 8px` de l'en-tête, qui existe pour séparer l'identifiant
du reste. Les envelopper dans un `<div style="display: flex; align-items: center;">`
sans `gap` : le groupe devient un bloc de trois icônes jointives, et le `gap`
de l'en-tête ne sépare plus que l'identifiant de ce bloc.

---

## 3. Les tags d'état sont trop petits

`TagEtat` (`TableauDetail.tsx:57`) impose `font-size: 10px` par défaut, sous les
10.5 px de la classe `.tag`, et hérite d'un `padding: 1px 6px` calibré pour une
étiquette posée dans une carte — pas pour une pastille d'état seule au bout d'une
ligne d'epic.

**Défaut du composant** : `font-size: 11.5px; padding: 3px 9px;`. L'appel du
panneau de détail (`TableauDetail.tsx:180`) passe déjà son propre style et n'est
pas touché — il vit dans une rangée de contrôles, à une autre échelle.

---

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:ui
pnpm electron
```

1. Ouvrir un ticket en grand : l'écart au-dessus de l'identifiant égale celui des
   côtés. Rouvrir dans le rail : même égalité, à 18 px.
2. Les trois icônes de l'en-tête forment un bloc jointif ; l'identifiant reste
   détaché à gauche.
3. Vue Epics : la pastille d'état se lit sans effort à côté du titre. Vérifier les
   quatre états — un tag « non commencée » est le plus long, il ne doit pas
   pousser le titre.
