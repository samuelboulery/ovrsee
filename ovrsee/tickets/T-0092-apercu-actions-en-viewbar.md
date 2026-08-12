---
{
  "id": "T-0092",
  "titre": "Aperçu — actions dans la ViewBar (éditeur, Finder, copier le chemin, ⋯)",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "apercu"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design (Lot 3 — Aperçu + terminal) : les actions de l'onglet Aperçu
(ouvrir dans l'éditeur, révéler dans le Finder, copier le chemin, terminal)
vivent encore dans la ligne d'en-tête à côté du nom du projet, en boutons
`.btn-secondary` séparés + un `<select class="input">` natif pour le choix
d'éditeur. La maquette les déplace dans la barre de vue (déjà posée par
T-0088, actuellement vide sur cet écran) : une puce éditeur avec caret
ouvrant un menu (au lieu du `<select>`), Finder, Copier le chemin avec
l'indice `⌘⇧C`, et un bouton `⋯` carré 27×27 pour le reste (terminal ici).

Vérifié en relisant le code actuel (`Apercu.tsx`, `Sante.tsx`, `Branches.tsx`,
`Deploiements.tsx`, `Environnements.tsx`) : le bandeau de chiffres, les chips
de santé, la liste encadrée des plans ouverts, les chips de branches et les
cartes de déploiement sont **déjà conformes** à l'audit (chantiers T-0074,
T-0081, T-0082, T-0083) — ce ticket ne couvre que les actions restées dans
l'en-tête. Nuance mineure notée mais pas bloquante : Branches et
Environnements s'empilent au lieu d'être côte à côte — inclus ici puisque
c'est un simple changement de layout, pas une réécriture.

## Critères d'acceptation

- [ ] Menu déroulant éditeur (remplace le `<select>` natif) : puce avec
      picto `Code` 14px `#6ea8fe` + nom de l'éditeur courant + caret ;
      cliquer la puce ouvre l'éditeur courant, le menu liste les 4 éditeurs
      et change à la fois le réglage et lance l'éditeur choisi.
- [ ] Bouton Finder (« Révéler dans le Finder ») relocalisé dans la ViewBar.
- [ ] Bouton Copier le chemin relocalisé, avec l'indice `⌘⇧C` — le
      raccourci clavier est réellement câblé sur l'onglet Aperçu, pas
      seulement affiché (même principe que ⇧⌘E sur Navigateur, T-0089 :
      un indice non câblé est un mensonge d'interface).
- [ ] Bouton `⋯` 27×27 : menu avec au moins « Terminal ici » (relocalisé).
- [ ] Les 4 actions ne sont plus rendues dans la ligne d'en-tête à côté du
      nom du projet.
- [ ] Branches et Environnements côte à côte (flex row) au lieu
      d'empilés — seulement si Environnements a du contenu à montrer.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome contre
      `Ovrsee App.dc.html#2b`.
