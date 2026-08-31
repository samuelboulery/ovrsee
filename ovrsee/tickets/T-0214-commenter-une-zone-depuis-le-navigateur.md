---
{
  "id": "T-0214",
  "titre": "Commenter une zone depuis le navigateur",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "ui",
    "navigateur",
    "issue-65"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-tour-du-depot-ovrsee-backlog-priorise-et-lot-d-intendance.md",
  "charge": "s"
}
---

## Contexte

Issue #65. Sélectionner un élément dans l'onglet Navigateur envoie aujourd'hui
un descriptif brut — le sélecteur, le texte, la route — sans un mot de la
personne qui a cliqué. Or ce qu'on veut dire d'une zone (« ce bouton devrait
être à droite », « cette marge est fausse ») n'est nulle part dans le DOM.

**L'essentiel existe déjà**, c'est ce qui rend le ticket petit :

- `pickElement()` (`app/src/tabs/navigateur-webview.ts:117`) pose l'overlay, met
  en surbrillance l'élément survolé et capture au clic
  `{selector, text, html, route}`.
- `describe()` (l.207) en fait un texte destiné à Claude, `corpsDepuis()` (l.216)
  un corps de ticket markdown.
- `send()` (`app/src/tabs/Navigateur.tsx:255`) injecte via `pasteToClaude()`
  (`app/src/pty.ts:152`), avec repli presse-papier quand il n'y a pas de pty.
- `onCreerTicketDepuisElement(corps, ['navigateur'])` (`Navigateur.tsx:300`)
  ouvre déjà la création de ticket avec le corps pré-rempli.

Il manque **une seule chose** : la saisie du commentaire entre le clic et
l'envoi. Aujourd'hui le pick part directement.

## Ce qui est demandé

Après le clic sur un élément, une zone de saisie apparaît près de la sélection.
Entrée envoie à Claude ; un bouton en fait un ticket. Le commentaire se place en
tête du texte produit, avant le descriptif technique.

## Critères d'acceptation

- [ ] Après un `pickElement`, un champ de saisie s'affiche au lieu d'envoyer
      aussitôt.
- [ ] `Entrée` envoie le commentaire **et** le descriptif à Claude via
      `pasteToClaude()` ; le repli presse-papier hors Electron est conservé.
- [ ] `Maj+Entrée` insère un retour à la ligne au lieu d'envoyer.
- [ ] Un bouton « En faire un ticket » crée le ticket avec le commentaire en
      tête du corps et le tag `navigateur`.
- [ ] `Échap` annule la saisie **et** la sélection — le `CANCEL_PICK`
      (`navigateur-webview.ts:38`) reste la voie d'annulation, non dédoublée.
- [ ] Un commentaire vide reste permis : le comportement d'aujourd'hui
      (descriptif seul) ne régresse pas.
- [ ] `describe()` et `corpsDepuis()` restent des fonctions pures testées dans
      `node:test`, commentaire compris.
