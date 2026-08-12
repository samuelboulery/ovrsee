---
{
  "id": "T-0073",
  "titre": "Audit visuel exhaustif ovrsee vs Ovrsee App.dc.html (round 2, sans correction)",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["ui", "design-system", "audit"],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-audit-visuel-exhaustif-ovrsee-vs-ovrsee-app-dc-html-round-2.md",
  "charge": "l"
}
---

## Contexte

Le round précédent (T-0070/T-0072, commits `56d5573`/`04639b4`) a corrigé des écarts de
*jetons* (rayons, tailles, poids de police) trouvés en grep-ant les valeurs hex/px de la
maquette. Il n'a pas relu la structure DOM complète ni comparé le placement réel des
éléments — l'utilisateur pointe qu'il reste des écarts de structure, de position de
titre, de libellés, de couleurs de tags, de positionnement d'éléments, et de fond de
canvas.

Vérifié avant ce ticket : le canvas du graphe Produit dans la maquette a un fond à
points (`background-image: radial-gradient(#16171c 1px, transparent 1px);
background-size: 22px 22px;`, `Ovrsee App.dc.html#2d` ligne 773) que
`app/src/tabs/Produit.tsx` n'a pas (fond plat). Un écart réel que le round précédent n'a
pas vu — confirme qu'il faut une relecture structurelle, pas une nouvelle passe de grep.

Ce ticket est un **audit seul, aucune correction de code**. Le livrable prépare la
prochaine passe d'intégration pixel-perfect.

## Critères d'acceptation

- [x] Les 13 sections de `Ovrsee App.dc.html` (`#2a`–`#2m`) comparées élément par
      élément à l'écran vivant correspondant (structure, titre, libellés, tags,
      positionnement, fonds de canvas) — pas seulement les jetons déjà vérifiés au round
      précédent.
- [x] Livrable : page Artifact HTML, une section par écran, capture maquette | capture
      app actuelle côte à côte, liste d'écarts groupée par nature avec fichier:ligne du
      code concerné, sommaire avec badge de nombre d'écarts par écran.
- [x] Aucun fichier du dépôt `ovrsee` modifié par ce ticket.
- [x] Lien Artifact donné à l'utilisateur.

## Résultat

13 écarts trouvés sur 9 sections (4 sections conformes : Système, Aperçu, États,
Vides & pleine) :

- **#2c Navigateur** : barre d'outils DevTools 40px/12px au lieu de 46px/14px
  (`Navigateur.tsx:546`).
- **#2d Produit** : fond à points manquant sur le canvas du graphe ; légende à 2
  entrées au lieu de 3 (« capture périmée » absente) (`Produit.tsx`).
- **#2e/#2l Historique** : les 3 couleurs du graphe empilé ne suivent pas les rôles de
  la maquette (`Historique.tsx:124-128`) ; libellé « Plan » singulier au lieu de
  « plans » ; état « aucune activité » sans placeholder graphique.
- **#2f Tableau** : colonnes à 268px au lieu de 236px, panneau de détail à 340px au
  lieu de 372px — écart de 32px dans les deux sens (`Tableau.tsx:366-369`).
- **#2g Données** : interlignage figé à 1.5 au lieu de varier 1.6/1.7 selon le message
  (`Donnees.tsx:147`), mineur.
- **#2h Stack** : barre de progression 4px/999px/pleine largeur au lieu de
  5px/3px/max 420px (`Stack.tsx:115,120`).
- **#2i Préférences** : « Apparence » (thème, densité) vit dans l'onglet Général au
  lieu de l'onglet Interface avec Vues et Terminal (`PreferencesPanel.tsx`).
- **#2j Onboarding** : le 4ᵉ préréglage s'appelle « Découverte » dans la maquette,
  « Revue produit » dans le code (libellé et description différents) ; ordre des 4
  cartes différent (`PreferencesProfils.tsx:37,53-58`).

Livrable : https://claude.ai/code/artifact/3f801fe7-0610-46b2-b457-d28bc8bfa030
