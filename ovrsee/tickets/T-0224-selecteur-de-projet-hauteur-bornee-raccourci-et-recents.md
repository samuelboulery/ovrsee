---
{
  "id": "T-0224",
  "titre": "Sélecteur de projet : hauteur bornée, raccourci, récents",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "multi-projets",
    "issue-47"
  ],
  "cree": "2026-09-01",
  "maj": "2026-08-31",
  "plan": "2026-08-31-issue-47-voir-les-autres-projets-sans-derouler.md",
  "charge": "s"
}
---

## Contexte

Trois défauts du même geste — choisir un projet — relevés en même temps que
l'issue #47, mais indépendants de l'état des sessions.

- Le popover du `ProjectSwitcher` (`app/src/Shell.tsx:349-388`) n'a **ni
  `max-height` ni `overflow`** : onze projets au registre donnent une fenêtre
  qui déborde, et rien n'arrête sa croissance.
- Basculer de projet demande deux clics. ⌘1..9 est déjà pris par les vues
  (`electron/menu.js:152`), donc le raccourci doit passer par un autre
  modificateur.
- La palette ⌘K liste **tous** les projets sans limite
  (`CommandPalette.tsx:75-86`), sous le titre « Projets ». À onze projets la
  section mange la palette avant qu'on ait tapé quoi que ce soit.

## Critères d'acceptation

- [ ] Le popover du sélecteur borne sa hauteur et défile au-delà ; le bouton
      « Ouvrir un projet » reste visible sans défiler.
- [ ] ⇧⌘1 à ⇧⌘9 basculent sur les neuf premiers projets de la liste, dans
      l'ordre affiché (`lastOpened`), dans Electron **et** dans le navigateur.
- [ ] ⌘1..9 continue d'ouvrir les vues : aucun raccourci existant n'est perdu.
- [ ] Le raccourci est lisible sur la ligne du projet dans le sélecteur.
- [ ] Sans recherche, ⌘K montre au plus 5 projets, sous un titre qui dit
      « récents ». Avec une recherche, elle porte sur tous les projets du
      registre, sans limite.
- [ ] Rien de nouveau n'est écrit dans `projects.json` : l'ordre vient du tri
      par `lastOpened` qui existe déjà (`hooks/snapshot.js:70-76`).
