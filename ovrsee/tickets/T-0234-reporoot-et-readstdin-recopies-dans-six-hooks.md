---
{
  "id": "T-0234",
  "titre": "repoRoot et readStdin recopiés dans six hooks",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "dette",
    "audit",
    "hooks"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "s"
}
---

## Contexte

Six hooks portent le même `repoRoot(cwd)` au caractère près — `execFileSync`
sur `git rev-parse --show-toplevel`, `stdio` muet, `catch → null` — et sept le
même `readStdin()`. `ovrsee-capture-audit`, `ovrsee-capture-plan`,
`ovrsee-session-end`, `ovrsee-tool-edit`, `ovrsee-tool-edit-gate`,
`ovrsee-tool-stop`.

C'est exactement la situation qu'a réglée [[T-0204]] pour `estPrincipal` :
douze fichiers finissant sur la même ligne, un module `principal.js`, et
l'affaire close. Le geste est connu, la place est trouvée — à côté de
`principal.js`, sans dépendance Node de plus que ce que ces deux fonctions
exigent déjà.

L'enjeu n'est pas le nombre de lignes : c'est qu'une correction de sécurité sur
l'une des six copies laisse les cinq autres derrière. Le commentaire « execFile
sans shell : `cwd` vient d'un JSON externe » est lui aussi recopié six fois, et
un jour l'une des copies ne l'aura plus.

Cinq autres appels à `rev-parse --show-toplevel` vivent ailleurs
(`ovrsee-session-start`, `ovrsee-post-merge`, `ovrsee-cli`, `install`,
`server/api.js`) sous des formes qui diffèrent réellement — ils lèvent, ou
n'ont pas de `cwd`. Les forcer dans le même moule n'est pas l'objet.

## Critères d'acceptation

- [ ] Une seule définition de `repoRoot()` et une seule de `readStdin()` dans tout le dépôt.
- [ ] Les six hooks l'importent, aucun ne garde de copie locale.
- [ ] Le module est testé pour ses deux replis : hors dépôt git → `null`, stdin absent → `''`.
- [ ] `pnpm test` vert, y compris sur macOS et Windows en CI.
