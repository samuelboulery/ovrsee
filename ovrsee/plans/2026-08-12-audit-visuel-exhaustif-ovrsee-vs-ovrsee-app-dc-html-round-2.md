---
{
  "status": "closed",
  "title": "Audit visuel exhaustif ovrsee vs `Ovrsee App.dc.html` (round 2, sans correction)",
  "opened": "2026-08-12",
  "closed": "2026-08-13",
  "commits": []
}
---

# Audit visuel exhaustif ovrsee vs `Ovrsee App.dc.html` (round 2, sans correction)

## Contexte

Le round précédent (commits `56d5573`/`04639b4`, déjà mergés) a corrigé 9 écarts de
**jetons** (rayons, tailles d'interrupteur, colonnes de cartes, poids de police) trouvés
en comparant les valeurs hex/px de `#2a`–`#2m` au code. C'était une lecture fine mais
étroite : trois agents ont surtout grep les styles inline pour des couleurs et des
tailles, pas relu la structure DOM complète ni comparé le placement réel des éléments.

L'utilisateur pointe qu'il reste « plein d'écarts » sur une autre dimension : structure
des pages, position du titre, libellés, couleurs des tags, positionnement de certains
éléments, fond à points des canvases. **Vérifié avant d'écrire ce plan** : le canvas du
graphe Produit dans la maquette a un fond à points —
`background-image: radial-gradient(#16171c 1px, transparent 1px); background-size: 22px
22px;` (`Ovrsee App.dc.html` ligne 773, section `#2d`) — alors que
`app/src/tabs/Produit.tsx` (ligne ~505, le conteneur du canvas) n'a qu'un fond plat
(`var(--color-surface)` / `--theme-bg-secondary`, pas de `background-image`). C'est un
écart réel que le round précédent n'a pas vu, parce qu'il cherchait des valeurs de
jetons, pas des motifs de fond. Ça confirme qu'il faut une relecture structurelle
complète, pas une nouvelle passe de grep.

**Cette passe est un audit seul — aucune correction de code.** Le livrable sert à
préparer une future passe d'intégration pixel-perfect ; il ne la fait pas.

## Approche

### Méthode par écran

Pour chacune des 13 sections de `Ovrsee App.dc.html` (`#2a` Système à `#2m` Vides &
Données pleine), à chaque fois :

1. **Lire la section brute** dans le fichier maquette (pas juste grep des couleurs) :
   ordre et imbrication réelle des éléments, texte exact des titres/libellés/tags,
   position (absolute/flex) de chaque bloc, fonds/motifs (`background-image`,
   `radial-gradient`, `repeating-linear-gradient`).
2. **Capturer l'écran vivant correspondant** : `localhost:5180` (dev server déjà lancé)
   en Chrome pour les 6 onglets web-visibles, Préférences, et l'onboarding si
   déclenchable. Pour Navigateur (`#2c`), pas de rendu vivant possible hors Electron
   (confirmé au round précédent, bloqué par la permission Accessibilité macOS en tâche
   de fond) — audité sur code + maquette seulement, écart signalé « à vérifier en
   Electron » plutôt que confirmé visuellement.
3. **Comparer élément par élément**, pas seulement les jetons déjà vérifiés :
   - Structure : ordre des blocs, présence/absence de panneaux, imbrication.
   - Titre : texte exact, position, taille/graisse, alignement par rapport à son
     conteneur.
   - Libellés et tags : texte exact, couleur de fond/texte/bordure, forme.
   - Positionnement : éléments mal placés (mauvais coin, mauvais ordre, décalage).
   - Fonds de canvas : motif à points/hachures présent dans la maquette (`#2d` Produit
     confirmé ; à vérifier aussi sur `#2m` si le canvas ER de Données existe déjà —
     sinon noter hors périmètre comme convenu précédemment, cette vue n'est pas encore
     construite).
4. **Sauvegarder les deux captures** (maquette recadrée sur la section, app vivante) sur
   disque pour l'artifact.

### Répartition du travail

Dispatcher plusieurs agents (Explore, lecture seule) en parallèle, chacun sur 2–4
sections, avec la méthode ci-dessus. Chaque agent renvoie : la liste des écarts trouvés
(section, ce qui cloche, valeur/texte/position attendue vs actuelle, fichier:ligne du
code concerné) + les chemins des captures sauvegardées.

### Livrable

Une page **Artifact HTML** (confirmé avec l'utilisateur), une section par écran de la
maquette :
- Capture maquette | capture app actuelle, côte à côte.
- Liste des écarts en dessous, groupés par nature (structure / titre / libellés / tags /
  positionnement / fond de canvas), chacun avec le fichier:ligne à corriger.
- Un sommaire en haut de page listant les 13 écrans avec un badge du nombre d'écarts
  trouvés par écran, pour naviguer vite.

Aucun code n'est modifié dans cette passe. Le prochain chantier (implémentation) partira
de cette page.

## Fichiers de référence (lecture seule)

- `/Users/sam/Downloads/Redesign UI Ovrsee 2/Ovrsee App.dc.html` — maquette cible,
  sections `#2a`–`#2m`.
- `app/src/App.tsx` (châssis), `app/src/tabs/*.tsx` (7 onglets), `Onboarding.tsx`,
  `Preferences*.tsx` — code à comparer.
- `app/src/style.ts`, `app/src/theme.ts`, `_ds/ovrsee/styles.css` — jetons déjà vérifiés
  au round précédent, à ne pas re-auditer sauf si un écart structurel les touche.

## Vérification

- La page Artifact couvre les 13 sections, chacune avec sa paire de captures et sa liste
  d'écarts.
- Aucun fichier du dépôt `ovrsee` n'est modifié (audit seul).
- Le lien Artifact est donné à l'utilisateur à la fin.
