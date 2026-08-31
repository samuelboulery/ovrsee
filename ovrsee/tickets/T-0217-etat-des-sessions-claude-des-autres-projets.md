---
{
  "id": "T-0217",
  "titre": "État des sessions Claude des autres projets",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "multi-projets",
    "issue-47"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-tour-du-depot-ovrsee-backlog-priorise-et-lot-d-intendance.md",
  "charge": "m"
}
---

## Contexte

Issue #47. Avec plusieurs projets ouverts, on ne sait pas lequel attend une
réponse sans dérouler le sélecteur et cliquer. Le Claude d'un autre projet peut
poser une question et rester bloqué sans que rien ne le signale à l'écran.

**La donnée existe, elle n'est simplement pas routée là.**

- L'état est émis par `hooks/ovrsee-notify.js` en séquence OSC
  `ESC]777;ovrsee;<kind>BEL`, parsé par `extractAttention`
  (`app/src/attention.ts:98`), branché sur le flux pty
  (`app/src/useTerminal.ts:139`).
- Il est stocké **par projet** : le `useRef attentions`
  (`app/src/Terminal.tsx:222`) a pour clé `` `${cheminProjet}#claude` ``
  (`useTerminal.ts:42-47`).
- Il est **déjà agrégé pour tous les projets vivants** vers la barre de menu
  macOS (`Terminal.tsx:341-368`, types dans `app/src/menubar.ts`).

Ce qui manque : le `ProjectSwitcher` (`app/src/Shell.tsx:288-397`) n'affiche cet
état pour **aucun** projet. Sa pastille (`Shell.tsx:551-559`) ne dit que « c'est
le projet courant » ; le badge textuel à côté compte des tickets
(`Shell.tsx:539-548`), pas des sessions.

## La limite à écrire, pas à masquer

**Un projet jamais ouvert dans cette instance n'a pas de pty, donc pas
d'état.** Le registre `projects.json` n'en stocke aucun, et le faire
contredirait l'invariant — l'ovrsee n'exécute que le terminal qu'on lui demande.
L'affichage doit donc distinguer « aucune session » de « session au repos »,
sans inventer un état pour la première.

## Critères d'acceptation

- [ ] Chaque ligne du sélecteur montre l'état de sa session Claude quand elle
      existe : question, au travail, au repos.
- [ ] Un projet sans session ouverte affiche l'absence d'état, distincte du
      repos — jamais un état deviné.
- [ ] Un état condensé est visible **sans dérouler** le sélecteur, agrégé selon
      la règle de l'issue : une question l'emporte sur au travail, qui l'emporte
      sur le repos.
- [ ] La règle d'agrégation est une fonction pure, testée dans `node:test`, y
      compris le cas « aucune session ».
- [ ] L'état se met à jour sans rechargement quand un autre projet change
      d'état.
- [ ] Rien de nouveau n'est écrit dans `projects.json`.
- [ ] La barre de menu macOS continue de recevoir ce qu'elle reçoit
      aujourd'hui : la source est partagée, pas dédoublée.
