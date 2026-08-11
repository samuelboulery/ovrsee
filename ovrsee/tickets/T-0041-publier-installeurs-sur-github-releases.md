---
{
  "id": "T-0041",
  "titre": "Publier les installeurs sur GitHub Releases via CI",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "packaging",
    "ci",
    "electron-builder"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-publier-des-installeurs-pre-empaquetes-sur-github-releases.md"
}
---

## Contexte

`pnpm package:mac` / `pnpm package:win` (T-0040) produisent les installeurs,
mais il faut les construire à la main et les distribuer soi-même. Le dépôt
`samuelboulery/ovrsee` est privé, les destinataires sont des proches invités
comme collaborateurs GitHub. But : qu'un tag de version déclenche la
construction (sur runners mac + windows, natifs) et la publication sur
l'onglet Releases, qui devient la liste des versions téléchargeables sans
terminal.

## Critères d'acceptation

- [ ] `electron-builder.yml` a un bloc `publish` (provider `github`, owner
      `samuelboulery`, repo `ovrsee`) et un `artifactName` par plateforme sans
      numéro de version (`Ovrsee-mac-${arch}.${ext}`, `Ovrsee-win-${arch}.${ext}`)
      pour des liens `/releases/latest/download/…` stables.
- [ ] `.github/workflows/release.yml` existe : déclenché sur tag `v*` et
      `workflow_dispatch`, matrice mac/windows, `permissions: contents:
      write`, lance `pnpm test` avant de packager, publie avec
      `electron-builder --publish always` et le `GITHUB_TOKEN` par défaut.
- [ ] `CLAUDE.md` documente le geste de sortie de version (bump + tag +
      push) et le fait que les destinataires doivent être collaborateurs du
      dépôt.
- [ ] `pnpm package:mac` / `pnpm package:win` restent utilisables en local
      sans publier (non-régression T-0040).
- [ ] Un tag de test poussé produit une Release avec les deux installeurs
      attachés — à vérifier avec l'utilisateur avant un vrai tag de version.
