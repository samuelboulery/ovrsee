---
{
  "id": "T-0309",
  "titre": "Suivi des sessions Claude Code dans la barre",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "notifications",
    "barre-de-menus"
  ],
  "cree": "2026-10-28",
  "maj": "2026-10-28",
  "plan": null
}
---

## Contexte

Est-ce qu'on peut faire ne sorte qu'ovrsee traque aussi les session claude code en dehors de l'app ? Et il faudrais les différencier visuellement pour qu'on puisss les distinguer dans la barre de menu MacOs

Le popover ne montre que les sessions du terminal de l'app. Une session lancée
dans iTerm, Terminal ou VS Code notifie (inbox ou osascript, T-0306) mais
n'apparaît nulle part : on ne sait pas qu'elle travaille, ni qu'elle attend.

## Critères d'acceptation

- [ ] hors du terminal de l'app, le hook `ovrsee-notify.js` tient
      `~/.claude/ovrsee/sessions/<session_id>.json` (idle → busy → stop/question),
      et l'efface au `SessionEnd`, testé avec un dossier temporaire
- [ ] `install.js` retire la garde `OVRSEE_TERMINAL` de `UserPromptSubmit` et
      `SessionStart`, ajoute `SessionEnd`, migre une installation précédente, testé
- [ ] le principal lit et surveille le dossier, valide chaque fichier
      (`validerSessionExterne`, testé), oublie ce qui a plus de 24 h
- [ ] le popover montre une section « Hors d'Ovrsee », pastille du terminal,
      état et âge, bouton « Ouvrir <terminal> » qui passe par la liste blanche
      `TERMINAUX` du principal
