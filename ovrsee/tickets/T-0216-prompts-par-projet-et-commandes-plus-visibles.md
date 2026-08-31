---
{
  "id": "T-0216",
  "titre": "Prompts par projet et commandes plus visibles",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "terminal",
    "issue-79"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-issue-79-commandes-du-terminal-portee-libelles-visibilite-re.md",
  "charge": "m"
}
---

## Contexte

Issue #79. Trois gênes sur le panneau de commandes du terminal.

**Le libellé ment.** Le tri entre « Commandes » et « Contexte pour Claude » est
purement syntaxique : un texte qui commence par `!` ou `/` va dans la première,
tout le reste tombe dans la seconde (`app/src/Terminal.tsx:459-468`,
`decideInjection` dans `app/src/brief.ts:134`). Un `pnpm run dev` sans `!` se
retrouve donc rangé sous « Contexte pour Claude », ce qu'il n'est pas.

**La portée ment aussi.** Les actions se saisissent dans les préférences,
section **« Projet »** (`app/src/PreferencesProjet.tsx:29-180`), et son
doc-comment le laisse croire — mais `customActions` vit dans
`~/.claude/ovrsee/settings.json` (`hooks/settings.js:53`) et **n'est pas
surchargeable par projet** : `mergeSettings` (`hooks/settings.js:221-245`) ne
recopie que `onglets`, `terminal`, `packageManager`, `sourceGraphe`,
`gitignoreShots`, `gitignorePlans`. Elles sont globales, toujours.

**La fonctionnalité est invisible.** Rien dans le panneau terminal ne dit qu'on
peut en ajouter ; il faut savoir aller dans les préférences.

**Ajout hors issue** : la bande ne se replie pas. Ses 268 px sont pris au
terminal même quand on ne clique jamais dedans.

## La contrainte à ne pas contourner

Les prompts par projet **ne passent pas par `ovrsee.config.json`**. Ce fichier
est versionné, donc fourni par le dépôt observé : `bootstrap` en a été retiré
exactement pour ça (#70, commentaire `hooks/settings.js:229-232`), un dépôt
cloné ne dicte pas ce qui part dans le terminal. La portée projet s'obtient en
**indexant par chemin dans le fichier hors dépôt**, comme `trust.json` et
`integrations.json`.

## Critères d'acceptation

- [x] Les deux sections ont disparu : une seule liste, « Mes commandes », où
      chaque action porte une pastille disant ce qui arrive au clic — partir
      tout de suite (`▷`) ou s'écrire sans envoyer (`✎`). Plus de libellé à
      démentir.
- [x] Une action peut être globale ou attachée à un projet ; deux blocs dans
      les préférences, « Ce projet seulement » et « Partout ».
- [x] Les actions de projet vivent dans `~/.claude/ovrsee/settings.json`,
      indexées par chemin (`projectActions`). **Aucune n'est lue depuis
      `ovrsee.config.json`**, et un test le vérifie.
- [x] `mergeSettings` n'ouvre aucun nouveau champ surchargeable par le dépôt
      observé.
- [x] Un bouton visible dans le panneau terminal ouvre la création d'action.
- [x] Les `customActions` existantes restent lisibles et actives sans migration
      manuelle : elles deviennent les actions globales.
- [x] Le refus des actions multilignes est conservé, et vaut pour les deux
      listes (`actionValide` dans `hooks/settings.js`, `valider` dans
      `brief.ts`).
- [x] La bande de commandes se replie depuis la barre du terminal, et l'état
      est retenu d'une session à l'autre (`localStorage`, comme la barre
      latérale).
