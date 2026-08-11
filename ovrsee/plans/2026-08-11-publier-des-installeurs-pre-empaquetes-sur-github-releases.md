---
{
  "status": "open",
  "title": "Publier des installeurs pré-empaquetés sur GitHub Releases",
  "opened": "2026-08-11",
  "closed": null,
  "commits": []
}
---

# Publier des installeurs pré-empaquetés sur GitHub Releases

## Contexte

Le plan précédent (déjà livré) a ajouté `pnpm package:mac` / `pnpm package:win` :
electron-builder sait produire un DMG et un installeur NSIS. Mais produire un
binaire ne suffit pas — il faut encore le construire (terminal, machine
Windows pour la partie native) et le récupérer quelque part pour qu'un proche
non technique puisse l'installer.

But de ce plan : que `git push --tags` déclenche la construction des deux
installeurs sur les vraies plateformes cibles (runners GitHub Actions mac +
windows — ça règle au passage le blocage « node-pty ne cross-compile pas
depuis ce Mac » noté dans le plan précédent) et les publie sur l'onglet
**Releases** du dépôt GitHub. Cet onglet devient « la liste des versions » :
chaque tag y apparaît avec son DMG et son .exe en pièces jointes,
téléchargeables en un clic, sans terminal.

Décisions actées avec l'utilisateur :
- Dépôt `samuelboulery/ovrsee` reste **privé** pour l'instant ; les
  destinataires sont invités comme collaborateurs GitHub (gratuit, aucun
  changement de visibilité du code). Un site public de téléchargement est
  prévu plus tard — hors périmètre ici, mais les noms de fichiers sont choisis
  dès maintenant pour rester stables d'une version à l'autre (voir plus bas),
  afin que ce futur site puisse pointer vers `.../releases/latest/download/…`
  sans se soucier du numéro de version.
- Pas de signature de code (ni mac ni Windows) : même posture que le DMG
  actuel (`identity: null`), un avertissement Gatekeeper/SmartScreen
  contournable en un clic reste acceptable. Pas de certificat à acheter.

## Changements

### 1. `electron-builder.yml` — publication GitHub + noms de fichiers stables

```yaml
publish:
  provider: github
  owner: samuelboulery
  repo: ovrsee
```

Et un `artifactName` par plateforme pour que le nom de fichier ne contienne
pas le numéro de version (sinon un lien `/releases/latest/download/…` casse à
chaque sortie) :

```yaml
mac:
  # ... inchangé ...
  artifactName: 'Ovrsee-mac-${arch}.${ext}'

win:
  # ... inchangé ...
  artifactName: 'Ovrsee-win-${arch}.${ext}'
```

electron-builder version 26.15.3 (déjà en devDependencies) publie nativement
vers GitHub Releases — aucune dépendance à ajouter.

### 2. `.github/workflows/release.yml` — nouveau workflow

- Déclencheurs : `push` sur les tags `v*`, plus `workflow_dispatch` pour
  relancer une publication à la main.
- `permissions: contents: write` (le `GITHUB_TOKEN` par défaut du workflow
  suffit à créer une Release et y attacher des fichiers — pas de secret à
  créer).
- Matrice `os: [macos-latest, windows-latest]` : chaque job tourne sur sa
  vraie plateforme, donc `node-pty` se compile nativement pour la bonne cible
  (résout la contrainte notée dans `CLAUDE.md` — plus besoin d'une machine
  Windows personnelle).
- Par job : checkout, activer pnpm via corepack, `pnpm install
  --frozen-lockfile`, `pnpm test` (garde-fou avant de publier quoi que ce
  soit), `pnpm build:ui`, puis `pnpm exec electron-builder --mac --publish
  always` (job mac) ou `--win --publish always` (job windows) avec `GH_TOKEN:
  ${{ secrets.GITHUB_TOKEN }}` dans l'environnement.

### 3. `CLAUDE.md` — documenter le geste de sortie de version

Sous `## Commandes` ou `## Pièges connus` : le geste pour publier une version
est « bump `version` dans `package.json` → commit → `git tag vX.Y.Z && git
push --tags` » ; la CI construit et publie les deux installeurs sur l'onglet
Releases. Préciser que les destinataires doivent être invités comme
collaborateurs du dépôt (privé) pour voir cet onglet et télécharger.

## Fichiers touchés

- `electron-builder.yml`
- `.github/workflows/release.yml` (nouveau)
- `CLAUDE.md`

## Vérification

- `pnpm package:mac` / `pnpm package:win` restent utilisables en local sans
  publier (pas de `--publish`, donc pas de `GH_TOKEN` requis pour un simple
  build local) — non-régression sur le plan précédent.
- Un tag de test (ex. `v0.9.0-beta-test`) poussé déclenche les deux jobs ; à
  la fin, l'onglet Releases du dépôt liste la version avec `Ovrsee-mac-arm64.dmg`
  et `Ovrsee-win-x64.exe` attachés. Ce test réel ne peut être fait qu'après
  avoir poussé le workflow — à valider avec l'utilisateur avant de créer un
  vrai tag de version.
