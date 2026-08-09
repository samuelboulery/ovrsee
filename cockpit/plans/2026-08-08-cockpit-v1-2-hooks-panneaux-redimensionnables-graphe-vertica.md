---
{
  "status": "closed",
  "title": "Cockpit v1.2 — hooks, panneaux redimensionnables, graphe vertical, icône",
  "opened": "2026-08-08",
  "closed": "2026-08-08",
  "commits": []
}
---

# Cockpit v1.2 — hooks, panneaux redimensionnables, graphe vertical, icône

## Contexte

Cockpit est livré de v0.1 à v1.1 : capture des plans, crawl post-commit,
interface à cinq onglets, réinjection au démarrage de session, application
macOS empaquetée avec Claude Code tournant dedans. 71 tests verts.

Quatre manques apparaissent maintenant qu'on s'en sert.

**Les hooks ne sont pas branchés.** C'est le plus grave, et de loin. Le hook de
capture et celui de réinjection existent, sont testés, et ne s'exécutent
jamais : ils ne figurent pas dans `~/.claude/settings.json`. Chaque plan
approuvé doit donc être capturé à la main — et le cadrage est formel, ce
contenu est le seul qui soit périssable. Chaque semaine sans lui est
définitivement perdue.

**Tous les panneaux ont une taille figée.** Barre latérale 236 px, terminal
244 px de haut, rail de détail 330 px : des valeurs héritées de la maquette,
calibrées pour une fenêtre de 1320×860. Sur un grand écran l'espace est perdu ;
quand le terminal travaille, on ne peut pas l'agrandir sans perdre le graphe.

**L'icône est celle d'Electron par défaut.** Une application qu'on veut ouvrir
par réflexe doit être reconnaissable dans le Dock.

**Le graphe s'écoule horizontalement.** Avec les 8 pages de
`humankindr-platform`, les cartes sortent déjà du cadre et les dernières sont
coupées. Un site se lit de haut en bas ; une carte de navigation aussi.

**Résultat visé** : plus rien à capturer à la main, une fenêtre qu'on ajuste à
son écran, un graphe lisible au-delà de dix pages, et une icône qu'on repère.

## Décisions prises en amont

- **Icône** : le graphe de navigation lui-même — trois nœuds reliés en
  descente, celui d'entrée en accent. Fond `#161826`, accent `#9184d9`. Il dit
  ce que fait le produit et reprend la nouvelle disposition verticale.
- **Graphe vertical, cartes élargies** : de 150 à 220 px, en colonne centrée.
  Les titres et routes longues cessent d'être tronqués. Les pages de même
  profondeur restent côte à côte.

---

## Lot A — Brancher les hooks

Le plus petit lot, et celui qui a le plus de valeur.

`~/.claude/settings.json` définit **déjà** `SessionStart` et `PostToolUse` —
caveman-activate et DetachIsland y vivent. Il faut donc **ajouter une entrée
aux tableaux existants**, jamais les remplacer.

```jsonc
"SessionStart": [ …caveman…, …DetachIsland…, {
  "hooks": [{ "type": "command",
              "command": "node \"$HOME/code/cockpit/hooks/cockpit-session-start.js\"",
              "timeout": 5 }]
}],
"PostToolUse": [ …DetachIsland (matcher "*")…, {
  "matcher": "ExitPlanMode",
  "hooks": [{ "type": "command",
              "command": "node \"$HOME/code/cockpit/hooks/cockpit-capture-plan.js\"" }]
}]
```

> **Modification de configuration globale.** Le fichier n'est pas versionné :
> une copie horodatée est écrite à côté **avant** toute écriture, et le JSON
> est relu et validé après. Les deux hooks sortent toujours en code 0, donc un
> échec ne peut pas bloquer une session — c'est vérifié par les tests
> existants, mais je le contrôlerai aussi sur une vraie session.

Mettre à jour `hooks/install.js`, qui affiche encore ce bloc comme « reste à
faire ».

## Lot B — Panneaux redimensionnables

Quatre séparateurs, tous à la souris :

| Séparateur | Aujourd'hui | Bornes |
|---|---|---|
| Barre latérale | 236 px | 180–420 |
| Terminal, disposition « Bas » | 244 px de haut | 120–70 % de la fenêtre |
| Terminal, disposition « Côté » | 468 px de large | 320–70 % |
| Rail de détail de l'onglet Produit | 330 px | 260–560 |

Un seul mécanisme : `app/src/useResizable.ts` — un hook qui rend la taille
courante et les gestionnaires d'une poignée, plus un composant `Divider` de
4 px avec la zone de saisie élargie et le bon curseur (`col-resize` /
`row-resize`).

Tailles conservées dans `localStorage`, une clé par séparateur. Un
double-clic remet la valeur d'origine — sans quoi une poignée mal tirée est
irrattrapable.

Les fichiers touchés sont ceux qui portent les tailles figées repérées :
`App.tsx` (barre latérale), `Terminal.tsx` (`PANEL.bottom`, `PANEL.side`),
`tabs/Produit.tsx` (rail de détail).

## Lot C — Graphe vertical

Dans `app/src/data.ts`, `layoutGraph()` place aujourd'hui la profondeur en `x`
et les frères en `y`. On échange : **la profondeur descend, les frères
s'étalent horizontalement**, colonne centrée.

```
CARD_W  150 → 220      COL_STEP  175 → 244 (carte + gouttière)
CARD_H  (nouveau) ~210  ROW_STEP  150 → 250 (carte + gouttière)
```

`CARD_H` est calculée à partir du lot E : la vignette au bon rapport occupe
~120 px, le reste va au titre, à la route et au pied.

`CARD_H` doit devenir explicite : les arêtes s'y ancrent, et une hauteur
implicite les décalerait dès qu'un titre passe sur deux lignes. Les cartes
prennent donc une hauteur fixe avec débordement masqué.

Dans `tabs/Produit.tsx`, `Edges` change d'ancrage : sortie au **milieu du bas**
de la carte, entrée au **milieu du haut** de la suivante, avec le même tracé
orthogonal en L. La distinction reste inchangée — trait plein accent pour un
lien direct, pointillé gris pour un retour vers une profondeur déjà atteinte.

Les marqueurs de flèche existants (`#na`, `#nab`) sont conservés tels quels.

## Lot D — Icône

`scripts/make-icon.js` : un SVG écrit en dur dans le script est rendu par
Playwright — déjà installé pour le crawl, aucune dépendance nouvelle — capturé
en 1024×1024, décliné aux tailles de l'iconset par `sips`, puis assemblé en
`build/icon.icns` par `iconutil`. Les deux outils sont fournis par macOS.

`electron-builder.yml` déclare déjà `buildResources: build` : l'icône est
reprise automatiquement, sans configuration supplémentaire.

Le script est réexécutable : l'icône se régénère à la demande plutôt que
d'exister comme binaire opaque dans le dépôt.

## Lot E — Le ratio des captures

Une vignette de carte fait aujourd'hui 150×34, soit un rapport de 4,4:1, pour
une capture prise en 1280×800, soit 1,6:1. En `object-fit: cover`, l'image
n'est pas déformée — elle est **rognée à l'extrême** : on ne voit qu'une bande
horizontale du haut de l'écran, ce qui rend toutes les pages identiques. Le
rail de détail souffre du même défaut, en moins visible.

Le correctif juste n'est pas de deviner un rapport, c'est de **l'enregistrer au
moment de la capture**. `crawl/index.js` connaît la taille du viewport ; il
écrit désormais `shotSize: {width, height}` par page dans `pages.json`, et
l'interface pose `aspect-ratio` à partir de cette valeur. Un changement de
`viewport` dans `cockpit.config.json` reste alors correct sans rien retoucher.

Repli sur 16/10 pour les `pages.json` déjà écrits, qui n'ont pas le champ.

Conséquence sur la mise en page : avec 220 px de large, une vignette au bon
rapport fait environ 120 px de haut. La carte passe donc à ~210 px, et
`ROW_STEP` suit. C'est plus haut, mais on reconnaît enfin l'écran — ce qui est
tout l'objet d'une capture.

---

## Vérification

**Lot A — les hooks**

```bash
diff <(python3 -m json.tool ~/.claude/settings.json) /dev/null | head -1  # JSON valide
```
Puis le seul test qui compte : approuver un plan dans une session Claude Code
sur un dépôt suivi, et vérifier qu'un fichier apparaît dans `cockpit/plans/`
sans intervention. Ouvrir ensuite une nouvelle session et vérifier que le brief
est injecté.

**Lot B — les panneaux**

Dans l'application : tirer chacun des quatre séparateurs, vérifier les bornes,
fermer et rouvrir l'application, vérifier que les tailles sont retenues.
Double-cliquer pour revenir à l'origine. Vérifier que les trois dispositions du
terminal (Bas / Côté / Plein) restent cohérentes.

**Lot C — le graphe**

```bash
pnpm build:ui && COCKPIT_CAPTURE=/tmp/graphe.png pnpm exec electron .
```
Lire la capture : les 8 pages de `humankindr-platform` doivent tenir sans
troncature, l'entrée en haut, les liens de retour en pointillé. Vérifier aussi
sur `cockpit` (5 pages, graphe complètement connecté), le cas le plus dense.

Relancer ensuite `node crawl/index.js` sur cockpit : les captures de l'onglet
Produit se régénèrent avec la nouvelle disposition, et `pages.json` porte
désormais `shotSize`.

**Lot E — le ratio**

Comparer une vignette de carte à la capture d'origine dans
`cockpit/pages/shots/` : on doit reconnaître le même écran, en réduction, sans
bande rognée ni déformation. Vérifier qu'un ancien `pages.json` sans
`shotSize` s'affiche quand même correctement, en 16/10.

**Lot D — l'icône**

```bash
node scripts/make-icon.js && pnpm package
```
Vérifier l'icône dans le Finder, puis dans le Dock à l'ouverture — c'est là
qu'elle est petite et qu'un dessin trop chargé se révèle illisible.

**Transverse**

`pnpm test` (71 tests) et `pnpm typecheck` verts. Aucun port ouvert :
`lsof -i -P -a -c Cockpit` reste vide.

---

## Ce que ce plan ne fait pas

- **Signature et notarisation** — inutiles tant que l'application n'est pas
  distribuée.
- **Windows et Linux** — macOS seulement.
- **Redimensionnement du panneau d'injection** du terminal (268 px) : trop
  étroit pour que le réglage serve à quelque chose.
