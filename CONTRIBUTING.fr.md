<p align="center">
  <a href="./CONTRIBUTING.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./CONTRIBUTING.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Contribuer

Merci de regarder ce projet. Il est maintenu par une seule personne : ouvrez une
issue avant d'écrire du code pour une fonctionnalité, ça évite de travailler sur
quelque chose qui ne sera pas fusionné.

## Mise en route

```bash
pnpm install
pnpm dev        # interface seule, port 5180, sans terminal
pnpm electron   # l'application complète, terminal compris
```

Il faut Node ≥ 22 et pnpm. La version de pnpm est épinglée par le champ
`packageManager` : Corepack la fait respecter, ne la contournez pas.

## Avant d'ouvrir une PR

```bash
pnpm test        # node --test sur hooks/ crawl/ server/ mcp/, puis app/src compilé
pnpm typecheck   # tsc — ne couvre QUE app/src
pnpm lint
```

Les trois doivent passer. La CI les rejoue sur macOS et sur Windows.

**Vérifiez sur ce que git contient, pas sur votre copie de travail.** Certains
fichiers présents chez vous sont ignorés par git : un test qui en dépend passe
en local et casse en CI. C'est arrivé.

```bash
mkdir /tmp/verif && git archive HEAD | tar -x -C /tmp/verif
cd /tmp/verif && pnpm install && pnpm test
```

## Les règles qui ne se négocient pas

**`pnpm` exclusivement.** Pas `npm`, pas `yarn`, pas `bun`. Un seul lockfile,
`pnpm-lock.yaml`, toujours commité.

**Aucun framework de test.** Les tests utilisent `node:test` et `node:assert`,
rien d'autre. N'introduisez ni vitest, ni jest, ni mocha — écrivez dans le style
existant. `app/src` ne fait pas exception : `scripts/test-ui.js` le compile dans
un dossier jetable et lance le même `node --test` dessus.

**Demandez avant d'ajouter une dépendance.** Le projet en a quatre en
production, et c'est un choix — de sécurité autant que de maintenance. Ouvrez
une issue qui explique pourquoi la bibliothèque standard ou une dépendance déjà
présente ne suffit pas.

**Pas de fichier `.css` dans `app/src`.** Les styles passent par l'utilitaire
`s()` de `app/src/style.ts`, sur les jetons du design system.

## Langue

Français pour les commentaires, la documentation et les messages d'interface.
Anglais pour les identifiants et le code.

Les messages de commit suivent les Conventional Commits, en français :

```
feat: ajoute le filtre par étiquette au tableau
fix: corrige le bit d'exécution de spawn-helper au postinstall
docs: précise la marche à suivre sous Windows
chore: monte electron-builder en 26.16
```

## Ce qu'on ne modifie pas

- **`ovrsee/`** est produit par des hooks. Seuls `ovrsee/tickets/*.md` et
  `ovrsee/board.json` se saisissent. Les plans, les pages, les scans et les
  captures s'écrivent tout seuls : les corriger à la main produit un état que le
  prochain commit écrasera.
- **`legacy/Ovrsee-A-Nocturne.dc.html`** est la maquette, du code tiers embarqué.
  Hors périmètre.
- **`_ds/`** est une bibliothèque de design systems. L'application ne charge que
  `_ds/ovrsee/styles.css`.
- **`graphify-out/graph.json`** est engendré. Il est versionné volontairement,
  mais il se régénère — ne l'éditez pas.

## Deux pièges qui coûtent une demi-journée

**Une route testée dans le navigateur n'est pas une route testée dans Electron.**
`server/api.js` a trois hôtes — le middleware Vite, le protocole `ovrsee://` du
processus principal, et le serveur MCP — qui appellent tous la même fonction
`resolve()`. Le protocole custom n'a ni CORS, ni `Origin`, ni les mêmes en-têtes.
Vérifiez les deux.

**Le stdout du serveur MCP est le transport, pas un journal.** Un `console.log`
ajouté n'importe où dans `hooks/` ou `server/` se retrouve au milieu d'un flux
JSON-RPC et coupe la conversation. Les traces vont sur stderr.

## Le reste

`CLAUDE.md` documente l'architecture, les pièges connus et les arbitrages déjà
tranchés. Le cadrage — problème, alternatives écartées, périmètre — est dans
`cadrage-ovrsee.md`. Les deux valent d'être lus avant de proposer un changement
de structure.
