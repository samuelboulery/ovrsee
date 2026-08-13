---
{
  "status": "closed",
  "title": "Ajouter un installeur Windows",
  "opened": "2026-08-11",
  "closed": "2026-08-13",
  "commits": []
}
---

# Ajouter un installeur Windows

## Contexte

`pnpm package` produit déjà un DMG mac (double-clic, pas de terminal). Rien
d'équivalent n'existe pour Windows : `electron-builder.yml` n'a pas de section
`win`, il manque une icône `.ico`, et le script `package` est câblé sur
`--mac`. But : pouvoir produire un installeur double-clic sur les deux OS,
sans jamais passer par un terminal côté utilisateur final.

Contrainte structurelle, pas un bug à corriger : `node-pty` est un module
natif compilé à l'installation (node-gyp). Une compilation croisée mac→windows
n'est pas fiable. `pnpm package:win` doit donc tourner depuis une machine
Windows (ou un runner CI Windows) après un `pnpm install` fait là-bas — pas
depuis ce Mac. Le plan livre la config ; la première build Windows se fait
sur une machine Windows.

`electron/main.js:515-518` (gestion `window-all-closed`) a été vérifié : le
test `process.platform !== 'darwin'` est déjà correct pour du cross-platform
(quitte sur Windows/Linux, reste actif sur mac). Aucun changement nécessaire
là. `scripts/fix-pty-permissions.js` est un no-op inoffensif sur Windows
(chmod échoue silencieusement, NTFS n'a pas ce concept) — aucun changement
non plus.

## Changements

### 1. `electron-builder.yml` — section `win`

Ajouter à côté de `mac:` :

```yaml
win:
  target:
    - target: nsis
      arch: [x64]
```

Pas de bloc `nsis:` custom : les défauts electron-builder (par-utilisateur,
pas d'élévation admin requise, un clic) collent déjà à l'usage personnel non
signé, au même esprit que `identity: null` côté mac. `buildResources: build`
est déjà déclaré — electron-builder y cherchera `icon.ico` automatiquement,
comme il le fait pour `icon.icns`.

### 2. `scripts/make-icon.js` — générer `build/icon.ico`

Étendre le script existant (déjà mac-only via `sips`/`iconutil`, ça reste
cohérent) pour écrire aussi `build/icon.ico` avant le `rmSync` de l'iconset :

- Ajouter un rendu 48×48 (absent des tailles `.icns`) via un appel `sips`
  supplémentaire, à côté des 16/32/256 déjà produits.
- Empaqueter ces 4 PNG (16, 32, 48, 256) dans un conteneur ICO : format
  simple (`ICONDIR` + `ICONDIRENTRY[]` + données PNG brutes), supporté nativement
  depuis Vista. Écrit à la main avec `node:fs`/`Buffer` — aucune dépendance
  nouvelle (rung stdlib de l'échelle ponytail).

`build/icon.ico` est commité comme `build/icon.icns` (le `.gitignore` actuel
n'ignore que `build/icon-1024.png` et `build/icon.iconset/`, pas les fichiers
icône finaux) — une machine Windows n'a pas besoin de rejouer le script.

Exécuter `node scripts/make-icon.js` une fois ici (Mac) pour régénérer les
deux icônes et committer `build/icon.ico`.

### 3. `package.json` — scripts de packaging

Remplacer :

```json
"package": "pnpm build:ui && electron-builder --mac"
```

par :

```json
"package:mac": "pnpm build:ui && electron-builder --mac",
"package:win": "pnpm build:ui && electron-builder --win"
```

### 4. `CLAUDE.md` — refléter les nouvelles commandes

Dans la table `## Commandes`, remplacer la ligne `pnpm package` par les deux
nouvelles, et ajouter une entrée dans `## Pièges connus` : `package:win` doit
tourner sur une machine Windows (node-pty natif, pas de cross-compile).

## Fichiers touchés

- `electron-builder.yml`
- `scripts/make-icon.js`
- `build/icon.ico` (nouveau, généré)
- `package.json`
- `CLAUDE.md`

## Vérification

- `node scripts/make-icon.js` régénère `build/icon.icns` **et**
  `build/icon.ico` sans erreur.
- `pnpm package:mac` produit toujours un DMG dans `release/` (non-régression).
- `pnpm package:win` ne peut être vérifié qu'sur une machine Windows — le
  documenter clairement plutôt que de faussement le valider ici.
