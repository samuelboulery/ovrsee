---
{
  "id": "T-0214",
  "titre": "Commenter une zone depuis le navigateur",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": [
    "ui",
    "navigateur",
    "issue-65"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-t-0214-commenter-une-zone-depuis-le-navigateur.md",
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

## Ce que la demande a élargi

Le 31 août 2026, la saisie du commentaire ne s'ajoute plus au panneau existant :
**elle le remplace**. `ElementPanel` est une colonne de 340 px redimensionnables
qui pousse l'aperçu et occupe la moitié de l'écran pour trois champs de texte.

Trois décisions prises :

- **Une seule carte flottante**, en haut à droite, posée au-dessus du site — pas
  de pastille repliée à déplier, un seul objet à l'écran.
- **Elle n'affiche que le sélecteur.** Le texte et la route disparaissent : la
  route est déjà dans la barre d'URL juste au-dessus.
- **La liste « Routes connues » est supprimée.** Elle n'avait aucun rapport avec
  l'élément cliqué, et l'onglet Produit liste déjà les pages.

## Critères d'acceptation

- [ ] Après un `pickElement`, une carte flotte en haut à droite **au-dessus de
      l'aperçu**, au lieu du panneau latéral. Le focus est dans la saisie.
- [ ] La carte porte le sélecteur, une zone de commentaire et deux actions —
      envoyer, créer un ticket.
- [ ] `Entrée` envoie le commentaire **et** le descriptif à Claude via
      `pasteToClaude()` ; le repli presse-papier hors Electron est conservé.
- [ ] `Maj+Entrée` insère un retour à la ligne au lieu d'envoyer.
- [ ] « Créer un ticket » crée le ticket avec le commentaire en tête du corps et
      le tag `navigateur`.
- [ ] `Échap` ferme la carte **et** annule la sélection — le `CANCEL_PICK`
      (`navigateur-webview.ts:38`) reste la voie d'annulation, non dédoublée.
- [ ] Un commentaire vide reste permis : la sortie est alors identique à celle
      d'aujourd'hui, au caractère près.
- [ ] `ElementPanel`, `PanelField` et le `useResizable` du panneau sont retirés ;
      l'aperçu occupe toute la largeur.
- [ ] `describe()` et `corpsDepuis()` restent des fonctions pures testées dans
      `node:test`, commentaire compris.
- [ ] Aucune couleur en dur — `hooks/couleurs.test.js` reste vert.
