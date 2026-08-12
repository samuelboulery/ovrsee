---
{
  "id": "T-0100",
  "titre": "Produit — contrôle de zoom encadré, canevas, bouton Ouvrir dans le Navigateur",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "produit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.3. Vérifié dans `Produit.tsx` :

- `Controls` (lignes 304-343) : quatre boutons flottants indépendants,
  glyphes texte (`−`, `+`, `⤢`), fond translucide par bouton. L'audit veut
  un **conteneur unique** (`#0e0f12`, filet `#1e1f25`, rayon 8, padding 3),
  icônes Phosphor (`Minus`, `Plus`, `ArrowsOutSimple` — déjà utilisées
  ailleurs dans ce fichier, ex. `Compass`), séparateur vertical 1×14 avant
  le bouton d'ajustement.
- Canevas (ligne ~144) : fond uni, pas de `radial-gradient(#16171c 1px,
  transparent 1px)` en pas de 22px demandé par l'audit.
- Panneau `DetailPanel` (lignes 494-655) : aucun bouton pour rouvrir la page
  courante dans l'onglet Navigateur. L'audit le liste explicitement
  (« bouton secondaire Ouvrir dans le Navigateur »). Câblage nécessaire
  entre onglets — même mécanique que `onOuvrirTicket` dans `App.tsx`
  (lignes 439-443, `setTab` + état de focus + `pushUrl`) : ajouter
  `focusRoute`/`setFocusRoute`, un `onOuvrirDansNavigateur(route)` dans
  `App.tsx`, et un effet dans `Navigateur.tsx` qui charge la route reçue.
  Un bouton qui ne change pas d'onglet serait un mensonge d'interface.

## Critères d'acceptation

- [ ] `Controls` : conteneur unique stylé audit, icônes Phosphor, séparateur
      avant `ArrowsOutSimple`.
- [ ] Canevas : fond `#08090a` + grille `radial-gradient` pas 22px.
- [ ] Bouton « Ouvrir dans le Navigateur » dans `DetailPanel`, fonctionnel :
      bascule sur l'onglet Navigateur et charge la route de la page.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome (clic sur
      le bouton depuis Produit, vérifier l'arrivée sur Navigateur avec la
      bonne route chargée).

## Écarté

Groupe visuel « HORS CHEMIN » (nœuds en filet pointillé pour les pages hors
graphe) et légende « capture périmée » (puce `#e3b341`) : pas de notion de
page hors-chemin ni de capture périmée dans le modèle de données actuel
(`orphanShots` ne contient que des noms de capture, pas des pages avec route
— déjà affiché en note de bas de page). Inventer cette donnée dépasse un
correctif visuel ; à traiter dans son propre chantier si le besoin se
confirme.
