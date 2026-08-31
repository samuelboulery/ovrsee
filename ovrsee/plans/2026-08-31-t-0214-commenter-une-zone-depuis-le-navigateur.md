---
{
  "status": "open",
  "title": "T-0214 — commenter une zone depuis le navigateur",
  "opened": "2026-08-31",
  "closed": null,
  "commits": [
    {
      "sha": "c8fdcda",
      "date": "2026-08-31",
      "files": [
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/NavigateurPanneaux.tsx",
        "app/src/tabs/navigateur-webview.test.ts",
        "app/src/tabs/navigateur-webview.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "540bd1d",
      "date": "2026-08-31",
      "files": [
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/NavigateurPanneaux.tsx",
        "app/src/tabs/navigateur-webview.test.ts",
        "app/src/tabs/navigateur-webview.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# T-0214 — commenter une zone depuis le navigateur

## Contexte

Issue #65, ticket T-0214 (priorité haute), créé lors du tour du dépôt du 31 août
2026 — ce tour est livré et fusionné (PR #80), ce plan porte sur la suite.

Aujourd'hui, dans l'onglet Navigateur, cliquer un élément envoie un descriptif
brut — sélecteur, texte, HTML, route — **sans un mot de la personne qui a
cliqué**. Or ce qu'on veut dire d'une zone (« ce bouton devrait être à droite »,
« cette marge est fausse ») n'est nulle part dans le DOM.

La demande a élargi le ticket : la saisie du commentaire ne s'ajoute pas au
panneau existant, **elle le remplace**. Le panneau latéral (`ElementPanel`, 340 px
redimensionnables) pousse l'aperçu et occupe la moitié de l'écran pour trois
champs de texte. Il devient **une carte flottante en haut à droite**, posée
au-dessus du site, qui porte l'identité de l'élément, le commentaire et les deux
actions.

Décisions prises avec l'utilisateur :

- **Une seule carte**, pas de pastille repliée à déplier — un seul objet à
  l'écran, aucun clic supplémentaire.
- **La carte n'affiche que le sélecteur.** Le texte et la route disparaissent :
  la route est déjà dans la barre d'URL juste au-dessus.
- **La liste « Routes connues » est supprimée.** Elle n'avait aucun rapport avec
  l'élément cliqué, et l'onglet Produit liste déjà les pages.

## Ce qui existe et se réutilise

L'essentiel de la chaîne est déjà là — c'est ce qui rend le ticket court.

| Brique | Où | Rôle |
|---|---|---|
| `pickElement()` | `app/src/tabs/navigateur-webview.ts:117` | Surligne au survol, capture `{selector, text, html, route}` au clic. Stringifiée puis passée à `executeJavaScript` — **doit rester autonome**. |
| `CANCEL_PICK` | même fichier, l.38 | Annule une sélection en envoyant `Escape` dans la page. La seule voie d'annulation, à ne pas dédoubler. |
| `describe()` | l.207 | Le texte pour Claude. |
| `corpsDepuis()` | l.216 | Le corps de ticket markdown. |
| `send()` | `app/src/tabs/Navigateur.tsx:255` | `pasteToClaude()` avec repli presse-papier, et le message de confirmation. |
| `onCreerTicketDepuisElement` | `Navigateur.tsx:300` | Bascule sur Tableau avec le corps pré-rempli. |
| `renderToStaticMarkup` | `app/src/shell.test.tsx:3` | Le motif de test d'un composant sans DOM. |

## Exécution

### 1. Les deux fonctions pures — test d'abord

`app/src/tabs/navigateur-webview.ts` : `describe()` et `corpsDepuis()` prennent
un second paramètre optionnel `comment`. Le commentaire se place **en tête**,
avant le descriptif technique — c'est ce qu'on a voulu dire qui compte, le
sélecteur n'est que la preuve.

Un commentaire vide ou fait d'espaces ne doit rien changer à la sortie
d'aujourd'hui : c'est la garde de non-régression, et le cas courant du clic
sans commentaire.

Nouveau fichier `app/src/tabs/navigateur-webview.test.ts` (`node:test` +
`node:assert`, aucun framework — `scripts/test-ui.js` ramasse récursivement les
`*.test.js` compilés). Cinq cas : sans commentaire pour chacune des deux
fonctions, avec commentaire pour chacune, et le commentaire d'espaces traité
comme absent.

### 2. La carte flottante

`app/src/tabs/NavigateurPanneaux.tsx` : `ElementPanel` et son `PanelField`
disparaissent — ils ne servent nulle part ailleurs, c'est vérifié. À la place,
`CarteElement`, qui prend tout en props comme les autres blocs du fichier.

```
╭──────────────────────╮
│ button.cta         ✕ │   sélecteur en mono, tronqué, title = complet
│ ┌──────────────────┐ │
│ │ commentaire…     │ │   textarea, focus à l'ouverture
│ └──────────────────┘ │
│  [Créer un ticket] [→]│  ghost + primary
╰──────────────────────╯
```

- `position: absolute; top: 12px; right: 12px; width: ~280px;` dans le conteneur
  de l'aperçu, qui est déjà `position: relative` (`Navigateur.tsx:490-498`). Le
  voile d'échec (l.521) prouve qu'un enfant positionné recouvre bien la
  `<webview>`.
- Styles par `s()` sur les jetons Nocturne (`--color-surface-card`,
  `--color-border-card`, `--radius-*`, `--shadow-*`). Aucune couleur en dur —
  `hooks/couleurs.test.js` le vérifie.
- Clavier : `Entrée` envoie, `Maj+Entrée` insère un retour à la ligne, `Échap`
  ferme la carte **et** annule la sélection par `CANCEL_PICK`, sans second
  chemin d'annulation.

### 3. Le câblage

`app/src/tabs/Navigateur.tsx` :

- Un état `comment`, remis à vide à chaque nouvelle sélection.
- `envoyerAClaude()` et `onTicketDepuisElement()` passent le commentaire.
- **Suppressions** : le `useResizable` `elementPanelWidth` (l.102-109), son
  `Divider`, et le conteneur en ligne ouvert l.478 / fermé l.639 qui n'existait
  que pour tenir la colonne de droite. La carte se monte dans le conteneur de
  l'aperçu.

### 4. Les libellés

`hooks/i18n.js` — les deux dictionnaires, `fr` et `en` : `app/src/i18n.test.ts`
exige que **chaque clé rende une chaîne non vide dans les deux langues**.

- À ajouter : le gabarit du commentaire, et l'aide clavier de la carte.
- À réutiliser tels quels : `navigateur.create_ticket`,
  `navigateur.send_to_claude`, `navigateur.dismiss_selection`.
- À retirer avec le panneau : `selected_element`, `selector_label`,
  `text_label`, `route_label`, `known_routes`, `paste_in_claude`,
  `open_ticket_from_element`.

### 5. Deux corrections en passant

- **`pickElement` peint une bordure invisible.** Son surlignage pose
  `border: 2px solid var(--color-accent)` (`navigateur-webview.ts:121`) — mais
  ce code s'exécute **dans la page inspectée**, qui n'a pas le design system de
  l'ovrsee. La variable n'existe pas là-bas, la déclaration devient invalide, et
  seul le fond `rgba()` littéral survit. La fonction devant rester autonome, la
  couleur doit y être littérale elle aussi.
- **Quatre clés i18n mortes** : `navigateur.element_selected`, `.selector`,
  `.text`, `.html` reprennent mot pour mot ce que `describe()` code en dur, et
  ne sont référencées nulle part dans `app/src`. Vérifier qu'aucun module de
  `hooks/` ou `server/` ne les lit avant de les retirer.

### 6. Le ticket

Reporter dans `ovrsee/tickets/T-0214-*.md` ce que la demande a changé : la
carte remplace le panneau, la liste des routes est supprimée, la carte n'affiche
que le sélecteur. Les critères d'acceptation suivent.

## Vérification

- `pnpm test` — les 283 d'aujourd'hui plus les nouveaux, tous verts. Le compte
  qui bouge autrement qu'à la hausse est un signal.
- `pnpm lint && pnpm typecheck` — propres.
- **`pnpm electron`, et cliquer pour de vrai** : `pnpm dev` sert l'application
  *sans* terminal, donc sans `pasteToClaude` — le repli presse-papier serait le
  seul chemin testé. C'est le point que les tests ne couvrent pas : ni
  interaction, ni mise en page.
  1. Onglet Navigateur, ⇧⌘E, cliquer un élément → la carte paraît en haut à
     droite, au-dessus du site, le focus est dans la zone de saisie.
  2. Taper un commentaire, `Entrée` → il arrive **en tête** du texte collé dans
     la session Claude, le descriptif technique dessous.
  3. `Maj+Entrée` fait un retour à la ligne au lieu d'envoyer.
  4. Recommencer sans rien taper, `Entrée` → sortie identique à celle
     d'aujourd'hui.
  5. « Créer un ticket » → bascule sur Tableau, le corps porte le commentaire et
     le tag `navigateur`.
  6. `Échap` ferme la carte et désarme le sélecteur — le bouton « Sélectionner »
     revient à son état inactif.
  7. Vérifier que l'aperçu occupe toute la largeur : plus de colonne de droite,
     plus de poignée de redimensionnement.
