---
{
  "id": "T-0239",
  "titre": "La vitrine traduit au runtime une page déjà traduite",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit",
    "site"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "s"
}
---

## Contexte

La vitrine traduit deux fois, par deux chemins différents. Au déploiement,
`scripts/build-site-fr.js` dérive `site/fr/index.html` de la page anglaise et de
`dict.json`. Au runtime, `traduire()` (`site/app.js:267`) refait le même travail
sur le DOM : il `fetch` `dict.json`, construit la table — ou son inverse pour
repasser en anglais — puis marche tous les nœuds de texte du `body`.

Et il le refait à **chaque** `rendre()` : changement d'onglet, redimensionnement,
bascule d'échelle. Le walk complet du document pour trois libellés injectés par
le gabarit.

`/fr/` existe déjà comme page servie. La bascule de langue peut donc être ce
qu'elle est vraiment : deux liens, `/` et `/fr/`, et la navigation du
navigateur.

**Pourquoi ce ticket est en « à spécifier »** : la traduction runtime tient
aussi les libellés que le gabarit injecte après coup (`MÉTA[état.lang]`,
`site/app.js:79`) — ceux-là ne sont pas dans le HTML au moment où
`build-site-fr.js` passe. Il faut décider ce qu'ils deviennent : émis par
langue dans le gabarit, ou lus dans `dict.json` au seul endroit qui en a encore
besoin. Tant que ce point n'est pas tranché, l'estimation ne vaut rien.

## Critères d'acceptation

- [ ] La question ci-dessus est tranchée, et le ticket passe en « prêt » avec sa réponse écrite ici.
- [ ] `/` s'affiche en anglais et `/fr/` en français, sans réécriture du DOM après le premier paint.
- [ ] La bascule de langue mène d'une page à l'autre.
- [ ] `dict.json` reste la source unique du texte français.
- [ ] `scripts/build-site-fr.test.js` vert.
