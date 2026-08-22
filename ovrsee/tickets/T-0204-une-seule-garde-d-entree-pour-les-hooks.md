---
{
  "id": "T-0204",
  "titre": "Une seule garde d'entrée pour les hooks",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "s",
  "tags": ["hooks", "dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

Douze fichiers de `hooks/` finissent sur la même ligne, au caractère près :

```js
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
```

Elle oblige chacun à importer `resolve` de `node:path` et `fileURLToPath` de
`node:url` pour ce seul usage. Une fonction partagée — `estPrincipal(import.meta.url)`
— dit la même chose en un appel et retire deux imports par fichier.

`import.meta.main` ferait le travail nativement, mais il arrive en Node 24 et le
projet déclare `node >= 22` : ce n'est pas encore l'option.

## Critères d'acceptation

- [ ] Une seule implémentation de la garde, dans un module de `hooks/`.
- [ ] Les douze entrées l'utilisent ; les imports `resolve`/`fileURLToPath` devenus
      inutiles sont retirés.
- [ ] Chaque hook, lancé directement en ligne de commande, se comporte comme avant,
      et importé depuis un test ne s'exécute toujours pas.
