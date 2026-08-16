---
{
  "id": "T-0143",
  "titre": "État vide utile, et bandeau quand le signal n'est pas installé",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "ui",
    "hooks",
    "ux"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-16",
  "plan": "2026-08-14-barre-de-menu-macos-les-trois-defauts-du-premier-jet.md"
}
---

## Contexte

Deux manques qui se répondent.

Sans session, le popover ne montre rien — « Aucune session ouverte » et c'est
tout. Un coup d'œil à la barre de menu devrait apprendre quelque chose : où en
est le projet courant.

Et quand rien ne remonte, rien ne dit pourquoi. Le hook `ovrsee-notify.js`
s'enregistre dans `~/.claude/settings.json`, pas dans le dépôt : une machine
équipée avant son arrivée n'a aucun signal, aucune notification, un popover
vide — et rien à l'écran ne l'explique. Ce défaut a déjà coûté un test pour
rien.

Le popover est un rendu isolé : il ne connaît ni le projet affiché ni son
instantané. Le rendu principal tient déjà le `Snapshot` — c'est lui qui publie
le résumé, avec l'état des sessions. Une seule source, un seul aller-retour ;
faire refaire un `fetchSnapshot` au popover en créerait une seconde.

## Critères d'acceptation

- [ ] La charge publiée devient `{ sessions, projet, signalInstalle }`.
- [ ] `projet` porte le nom, le plan actif, les tickets restants, la branche et
      le nombre de fichiers modifiés, la date du dernier scan — dérivés de
      `restant()` et `plansOuverts()` (`app/src/data.ts`), `snapshot.gitStatus`
      et `snapshot.scans`. Rien n'est recalculé à la main.
- [ ] Le bloc projet paraît quand aucune session ne tourne.
- [ ] `hooks/install.js` exporte `signalInstalle()` : lit
      `~/.claude/settings.json` et vérifie `ovrsee-notify` dans `Stop` **et**
      dans `Notification`.
- [ ] `electron/tray.js` l'appelle à **chaque ouverture** du popover, pas au
      démarrage — l'installateur peut tourner entre-temps.
- [ ] Un bandeau nomme la commande `pnpm ovrsee:install` quand le signal
      manque, et disparaît une fois l'installateur passé.
- [ ] `hooks/install.test.js` couvre `signalInstalle()` : vrai, faux,
      `settings.json` absent, `settings.json` illisible.
- [ ] `app/src/render.test.tsx` couvre le bloc projet et le bandeau.
- [ ] Les libellés existent en FR et en EN.
- [ ] `pnpm test`, `pnpm typecheck` et `pnpm lint` passent.
