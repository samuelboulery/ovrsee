---
{
  "id": "T-0207",
  "titre": "Signer et notariser le paquet macOS",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "packaging",
    "securite"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-audit-de-cybersecurite-complet-findings-et-correctifs.md",
  "charge": "m"
}
---

## Contexte

`electron-builder.yml` porte `identity: null` : le DMG sort non signé et non
notarisé. `release.yml` le publie pourtant déjà sur GitHub Releases, à des
destinataires qui doivent être collaborateurs du dépôt privé pour le voir.

Un binaire non signé ne dit rien de son origine. Le destinataire doit contourner
Gatekeeper à la main pour l'ouvrir — et prendre ce réflexe est exactement ce
qu'on ne veut pas lui apprendre. Il n'y a pas d'auto-updater, donc pas de canal
de mise à jour à protéger : c'est ce qui rend le sujet important sans le rendre
urgent.

Constat de l'audit du 2026-08-22, différé hors de la PR de correctifs.

## Critères d'acceptation

- [ ] `electron-builder.yml` déclare une identité de signature réelle, lue depuis
      un secret de la CI, jamais écrite dans le dépôt.
- [ ] `release.yml` notarise le DMG et attend le verdict d'Apple avant de publier.
- [ ] Un DMG téléchargé depuis Releases s'ouvre sur un Mac neuf sans passer par
      « Ouvrir quand même » dans les Réglages Système.
- [ ] `spctl --assess --verbose` sur l'application installée rend `accepted`.
- [ ] La construction Windows n'est pas touchée : `release.yml` continue de
      produire son NSIS.
