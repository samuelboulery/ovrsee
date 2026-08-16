---
{
  "id": "T-0141",
  "titre": "Lister les sessions ouvertes, pas seulement celles qui ont signalé",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "electron",
    "terminal",
    "ux"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-barre-de-menu-macos-les-trois-defauts-du-premier-jet.md"
}
---

## Contexte

Le popover annonce « Aucune session ouverte » alors qu'une session Claude tourne
sous les yeux. C'est une erreur de conception du premier jet : l'état publié ne
contient que les sessions qui ont **signalé** quelque chose. Une session ouverte
et silencieuse n'existe pas pour la barre de menu.

Une session existe parce que son pty est ouvert, pas parce qu'elle a parlé. Ce
sont deux listes, et il faut les composer.

L'identifiant de pty vit dans la Map `panes` de `useTerminal.ts`, une `useRef` :
rien ne re-rend quand il apparaît, et rien ne l'expose hors du hook. C'est ce
qui manque pour publier la liste complète.

## Critères d'acceptation

- [ ] `useTerminals` expose un état `ptyIds` (clé de session → identifiant de
      pty), posé dans `attach()` après `bridge.open()`, retiré sur `pty:exit` et
      sur `closeShell`.
- [ ] `app/src/menubar.ts` remplace `fusionner()` par `composer(ouvertes,
      attentions)` : les deux sources deviennent une liste où
      `session.attention` peut valoir `null`.
- [ ] Tri : les attentes d'abord, puis le signal le plus récent, puis l'ordre
      alphabétique — deux sessions muettes ne changent pas de place d'un rendu
      à l'autre.
- [ ] `estDecidable` lit `session.attention` ; une session muette n'offre aucun
      bouton de décision.
- [ ] Seules les sessions `claude` dont le pty est réellement ouvert sont
      publiées : un onglet dont le terminal n'a jamais été monté n'a rien à
      faire dans le popover.
- [ ] Une attention dont la session s'est fermée disparaît avec elle.
- [ ] `app/src/menubar.test.ts` couvre : session ouverte sans attention, avec
      attention, deux sessions dont une muette, attention orpheline, ordre de
      tri.
- [ ] Vérifié à la main : terminal ouvert sur une session Claude au repos, elle
      **apparaît** dans le popover, sans boutons ; fermer le terminal l'en
      retire.
- [ ] `pnpm test` et `pnpm typecheck` passent.
