---
{
  "status": "closed",
  "title": "Cinq correctifs sur le panneau terminal et le panneau de ticket",
  "opened": "2026-08-19",
  "closed": "2026-08-19",
  "commits": [
    {
      "sha": "ff157d6",
      "date": "2026-08-19",
      "files": [
        "CHANGELOG.fr.md",
        "CHANGELOG.md",
        "CLAUDE.md",
        "_ds/ovrsee/styles.css",
        "app/src/App.tsx",
        "app/src/MenuBarPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/attention.test.ts",
        "app/src/attention.ts",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/i18n.test.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Tableau.tsx",
        "app/src/tabs/TableauCarte.tsx",
        "app/src/tabs/TableauDetail.tsx",
        "app/src/tabs/TableauDnd.ts",
        "app/src/tabs/TableauEpics.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/menu.js",
        "electron/preload.cjs",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/install.js",
        "hooks/install.test.js",
        "hooks/notify.test.js",
        "hooks/ovrsee-notify.js",
        "ovrsee/plans/2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
        "ovrsee/plans/2026-08-19-cinq-correctifs-sur-le-panneau-terminal-et-le-panneau-de-tic.md",
        "ovrsee/plans/2026-08-19-en-tete-du-panneau-tags-d-etat-raccourcis-du-terminal.md",
        "ovrsee/plans/2026-08-19-lire-un-ticket-en-grand-et-rendre-les-terminaux-bavards.md",
        "ovrsee/plans/2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
        "ovrsee/plans/2026-08-19-trois-retouches-sur-le-panneau-de-ticket-et-la-vue-epics.md",
        "ovrsee/tickets/T-0164-sortir-les-epics-du-kanban-et-solder-les-issues-ouvertes.md",
        "ovrsee/tickets/T-0165-l-etat-d-un-epic-se-derive-de-ses-enfants.md",
        "ovrsee/tickets/T-0166-le-kanban-ne-montre-plus-que-des-tickets.md",
        "ovrsee/tickets/T-0167-vue-epics-dans-l-onglet-tableau.md",
        "ovrsee/tickets/T-0168-pastille-d-etat-de-session-sur-les-onglets-terminal.md",
        "ovrsee/tickets/T-0169-renommer-un-terminal.md",
        "ovrsee/tickets/T-0170-documenter-la-nouvelle-vie-des-epics.md",
        "ovrsee/tickets/T-0171-lire-un-ticket-en-grand.md",
        "ovrsee/tickets/T-0172-un-signal-busy-qui-porte-la-demande.md",
        "ovrsee/tickets/T-0173-les-onglets-terminal-se-nomment-seuls.md",
        "ovrsee/tickets/T-0174-un-etat-anime-sur-les-onglets-terminal.md",
        "ovrsee/tickets/T-0175-trois-correctifs-sur-le-panneau-terminal.md",
        "ovrsee/tickets/T-0176-detacher-et-icones-dans-le-panneau-de-ticket.md",
        "ovrsee/tickets/T-0177-en-tete-du-panneau-et-tags-d-etat.md",
        "ovrsee/tickets/T-0178-raccourcis-clavier-des-terminaux.md",
        "ovrsee/tickets/T-0179-retouches-visuelles-du-panneau-et-de-la-vue-epics.md"
      ]
    }
  ]
}
---

# Cinq correctifs sur le panneau terminal et le panneau de ticket

## Contexte

Le lot précédent tourne dans l'application, et l'usage remonte cinq défauts —
trois sur le panneau terminal, deux sur le panneau de ticket. Aucun ne demande
d'architecture : ce sont des corrections de comportement et d'affichage sur du
code posé cette semaine.

---

## 1. Le point parasite à gauche des onglets

`Terminal.tsx:404-412` porte une pastille de 6 px **avant** la rangée d'onglets :
elle dit « un terminal est disponible dans l'application » (`a11y.session_active`
/ `a11y.terminal_available`). Depuis que chaque onglet porte son propre état, elle
ne dit plus rien que la rangée ne dise mieux, et sur la capture elle se lit comme
un quatrième onglet sans nom.

**La retirer.** L'indisponibilité reste annoncée : le bloc `hidden={available}`
(`Terminal.tsx:571`) affiche déjà le repli quand il n'y a pas de pont terminal.

Les deux clés deviennent mortes → les retirer de `hooks/i18n.js` (fr **et** en),
de `hooks/i18n.d.ts`, et de la liste d'`app/src/i18n.test.ts:79`.

---

## 2. `/clear` réinitialise le nom de l'onglet

Aujourd'hui un onglet renommé par une demande garde ce nom pour toujours : après
un `/clear`, l'onglet annonce encore la conversation d'avant.

**Le signal** — enregistrer `ovrsee-notify.js` sur `SessionStart` (quatrième
événement, `hooks/install.js`, même boucle `SIGNAL_EVENTS`) et lui faire émettre
un genre `reset` quand `payload.source` vaut `clear` ou `startup` — jamais sur
`resume` ni `compact`, qui reprennent une conversation dont le nom vaut toujours.

`ovrsee-session-start.js` est déjà enregistré sur cet événement et écrit du texte
brut ; `ovrsee-notify.js` écrit du JSON. Deux hooks aux sorties différentes sur un
même événement, c'est exactement ce que `UserPromptSubmit` fait déjà depuis le lot
précédent — le motif est éprouvé.

`signalInstalle` exige alors les **quatre** événements, pour la même raison que
les trois précédents : une panne muette ne se cherche pas.

**Le nom d'origine** — `Session` (`app/src/useTerminal.ts:124`) gagne un champ
`defaut: string`, posé à la création (`'claude'`, `'shell 3'`) et jamais modifié.
`useTerminals` expose `reinitialiser(key)` : `label ← defaut`, **sauf** si la clé
est dans `nommesMain` — un nom saisi au double-clic survit à `/clear`, c'est la
règle déjà arbitrée.

**Le raccordement** — dans `onAttention` (`Terminal.tsx`), un `reset` réinitialise
le nom, efface l'entrée de `attentions.current`, et ne notifie rien.

---

## 3. Le `?` n'apparaît que sur une vraie question

`TYPES_EN_ATTENTE` (`hooks/ovrsee-notify.js:47`) contient `idle_prompt`. Claude
Code l'émet quand une session reste sans réponse une minute — donc juste après
un `Stop`, quand on est parti sur un autre onglet. La coche verte se transformait
alors en `?` toute seule : c'est le symptôme décrit.

**Retirer `idle_prompt`** de l'ensemble. Restent `permission_prompt` et
`agent_needs_input` : les deux seuls cas où Claude attend vraiment une réponse —
et les deux seuls où le popover de la barre de menu peut proposer
Autoriser / Refuser sans mentir.

Le test `notify : seules les notifications qui attendent une réponse signalent`
(`hooks/notify.test.js`) déplace `idle_prompt` de la liste attendue vers la liste
ignorée, avec la raison en commentaire.

---

## 4. « Détacher » quitte la carte pour le bas du panneau

Le bouton (`app/src/tabs/TableauCarte.tsx:103-115`) occupe toute la largeur d'une
carte pour une action rare, et son libellé ne dit pas de quoi on détache.

- **Le retirer de la carte**, avec le `<div>` de boutons qui ne contenait que lui.
  La puce « Enfant de T-XXXX » reste : c'est elle qui informe.
- **Le poser dans `TableauDetail.tsx`**, en bas, à côté de la suppression — donc
  visible dans le panneau *et* dans la modale, qui partagent ce corps. Visible en
  lecture comme en édition, contrairement à la suppression : détacher n'est pas
  destructeur.
- **Nouvelle clé** `tableau.detach_from_epic` (« Détacher de l'epic » / « Detach
  from epic ») ; `tableau.detach` devient morte → la retirer des deux tables et
  de `i18n.d.ts`.

---

## 5. Édition et fermeture en icônes seules

Dans l'en-tête de `TableauDetail.tsx`, « Modifier » et « Fermer » sont deux
boutons texte à côté du `⤢` déjà en icône. Les passer en icônes, sur le modèle
exact du bouton d'agrandissement écrit juste à côté :

| Bouton | Icône Phosphor | `aria-label` + `title` |
|---|---|---|
| Éditer / Terminer | `PencilSimple` / `Check` | `a11y.edit` / `tableau.finish_editing` |
| Fermer | `X` | `tableau.close` |

`a11y.edit` existe déjà (`hooks/i18n.js:288`). Chaque bouton garde son
`aria-label` **et** son `title`, l'icône reste `aria-hidden`, et l'état actif de
l'édition continue de se lire à `btn-primary` — jamais à la seule couleur : la
forme de l'icône change aussi.

---

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:ui
pnpm ovrsee:install    # le quatrième événement, sans quoi /clear ne réinitialise rien
pnpm electron          # session Claude neuve : les hooks se lisent au démarrage
```

1. Plus aucune pastille à gauche de la rangée d'onglets.
2. Envoyer une demande (l'onglet se nomme), puis `/clear` : l'onglet redevient
   « claude ». Le renommer à la main, `/clear` : le nom tient.
3. Laisser une session finie plus d'une minute en étant sur un autre onglet : la
   coche verte reste verte, aucun `?`. Provoquer une vraie demande de permission :
   le `?` paraît.
4. Un ticket enfant n'a plus de bouton sur sa carte ; « Détacher de l'epic » est
   en bas de son panneau, et dans la modale.
5. En-tête du panneau : trois icônes, chacune avec son infobulle. Naviguer au
   clavier jusqu'à chacune et vérifier l'annonce du lecteur d'écran.
