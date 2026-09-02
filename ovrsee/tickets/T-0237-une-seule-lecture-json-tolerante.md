---
{
  "id": "T-0237",
  "titre": "Une seule lecture JSON tolérante",
  "colonne": "fait",
  "priorite": "basse",
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

Neuf endroits lisent un fichier JSON dont l'absence, l'illisibilité et la
corruption doivent se valoir — et chacun réécrit son `try` / `JSON.parse` /
`catch → défaut` : `snapshot.js:27`, `board.js:45`, `plans.js:260`,
`active.js:92`, `skills.js:85`, `install.js:181`,
`ovrsee-capture-audit.js:176`, `crawl/confiance.js:84`, `electron/crawl.js:54`.

Le contrat est le même partout et il est déjà écrit dans le dépôt, plusieurs
fois : « un fichier corrompu ou absent rend le défaut complet, jamais une
exception ». Un `lireJson(path, defaut)` le tient à un seul endroit.

Deux réserves qui bornent le ticket :

- **Le défaut doit être cloné**, pas partagé. `readSettings()` rend déjà un
  `structuredClone(DEFAULT_SETTINGS)` pour cette raison précise — un appelant
  qui mute le défaut empoisonnerait tous les suivants.
- **Tous les appelants ne veulent pas le même repli.** `active.js` et
  `skills.js` veulent `null`, `snapshot.js` un objet. Le paramètre défaut
  couvre les deux ; ce qui ne rentre pas dans le moule reste dehors plutôt que
  d'élargir la signature.

## Critères d'acceptation

- [ ] Un `lireJson(path, defaut)` unique, dans un module que `hooks/`, `crawl/` et `electron/` peuvent tous importer.
- [ ] Le défaut rendu est cloné : deux appels successifs ne partagent pas d'objet.
- [ ] Les appelants convertis n'ont plus de `try`/`catch` autour de leur lecture.
- [ ] Un appelant resté à l'écart, s'il y en a, porte un commentaire disant pourquoi.
- [ ] `pnpm test` vert.
