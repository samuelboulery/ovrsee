---
name: ovrsee-tickets
description: Use when a project has a ovrsee/ directory and work needs to be tracked - creating a ticket from a request, moving one as work starts or lands, or answering "what is left to do". Writes ovrsee/tickets/*.md directly; no CLI is installed in equipped projects.
---

# Ovrsee — tickets

Le tableau d'un projet équipé vit dans `ovrsee/tickets/`, un fichier par
ticket, et dans `ovrsee/board.json`, qui décrit ses colonnes. C'est **la seule
donnée de l'ovrsee qui se saisit** : les plans, les pages et les scans sont
capturés par des hooks et ne s'éditent pas à la main.

Ces fichiers s'écrivent directement. Le CLI `ovrsee-cli.js` n'existe que dans
le dépôt ovrsee lui-même, pas dans les projets équipés : ici, écrire le fichier
*est* le geste normal. L'interface de l'ovrsee relit le dossier, elle ne détient
rien.

## Avant d'écrire quoi que ce soit

**Lire `ovrsee/board.json`.** Les colonnes sont configurables par projet ; les
supposer est l'erreur qui produit un ticket invisible, rangé dans une colonne
qui n'existe pas.

```json
{
  "colonnes": [
    { "id": "backlog", "titre": "Backlog" },
    { "id": "a-specifier", "titre": "À spécifier" },
    { "id": "pret", "titre": "Prêt" },
    { "id": "en-cours", "titre": "En cours", "wip": 3 },
    { "id": "revue", "titre": "Revue" },
    { "id": "fait", "titre": "Fait" }
  ]
}
```

Ce sont les colonnes par défaut, pas une garantie. Un `id` de colonne ne change
jamais — il est dérivé du titre à la création, et c'est lui que les tickets
citent. Renommer une colonne ne touche que son `titre`.

`wip` est une limite indicative : au-delà, la colonne se signale dans
l'interface. Le dépasser n'est pas interdit, mais le signaler à l'utilisateur
vaut mieux que de le faire en silence.

## Le format d'un ticket

Un fichier `ovrsee/tickets/T-0012-un-slug.md`. Frontmatter **JSON** entre deux
`---`, puis le corps en markdown :

```markdown
---
{
  "id": "T-0012",
  "titre": "Glisser-déposer entre colonnes",
  "colonne": "pret",
  "priorite": "haute",
  "tags": ["ui"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

Pourquoi ce ticket existe. Ce qui ne va pas aujourd'hui.

## Critères d'acceptation

- [ ] Ce qu'on doit pouvoir constater pour dire que c'est fini.
```

| Champ | Règle |
|---|---|
| `id` | `T-` puis quatre chiffres. **Le maximum existant plus un**, jamais un numéro repris à un ticket supprimé. |
| `titre` | Non vide. Ce qui apparaît sur la carte. |
| `colonne` | Un `id` lu dans `board.json`. |
| `priorite` | `haute`, `moyenne` ou `basse`. Rien d'autre. |
| `tags` | Liste de chaînes, éventuellement vide. |
| `cree` / `maj` | `YYYY-MM-DD`. `maj` change à chaque modification, `cree` jamais. |
| `plan` | Nom de fichier d'un plan de `ovrsee/plans/`, ou `null`. |

Le nom du fichier est `T-0012-<slug du titre>.md` : le titre en minuscules sans
accents, tout ce qui n'est pas `[a-z0-9]` devenant un tiret, coupé à 60
caractères. Renommer le titre ne renomme pas le fichier — le fichier est
l'identité, le titre est un champ.

Il n'y a **pas de rang manuel** : le tri est priorité puis date de création. Ne
pas inventer de champ d'ordre.

## Les gestes

**Créer.** Lire les tickets existants pour trouver le prochain `id`, écrire le
fichier. Colonne d'arrivée par défaut : la première du board, sauf demande
contraire.

**Déplacer.** Réécrire `colonne` et `maj`. Rien d'autre ne bouge. C'est un diff
d'une ligne, et c'est voulu : un fichier par ticket évite qu'un déplacement
depuis l'interface et un déplacement écrit ici se marchent dessus.

**Suivre le travail.** Quand le travail sur un ticket démarre, le passer en
colonne « en cours » ; quand il est commité, en colonne finale (la dernière du
board). Le dire à l'utilisateur plutôt que de le faire sans prévenir.

**Lier à un plan.** Un plan approuvé qui correspond à un ticket se cite dans
`plan`. Les deux stocks restent indépendants : un ticket n'est pas un plan, un
plan n'est pas une tâche. Un plan décrit une intention et ses alternatives
écartées ; un ticket décrit un résultat constatable.

**Répondre à « que reste-t-il à faire ? ».** Les tickets dont la `colonne`
n'est pas la dernière du board. Ce n'est stocké nulle part, ça se compte.

## La retenue

Proposer des tickets est utile ; en créer trente d'un coup ne l'est pas.

**Un ticket vaut par son critère d'acceptation, pas par son existence.** Si on
ne sait pas écrire ce qu'on devra constater pour le dire terminé, le ticket
n'est pas mûr : le poser en « à spécifier » avec la question ouverte, ou ne pas
le poser du tout.

Un ticket dont le corps ne dit ni pourquoi il existe ni comment on saura qu'il
est fini est un titre déguisé en tâche. Il encombre le tableau et ne se solde
jamais.

## Pièges

- **Un ticket n'est pas un journal.** Ce qui a été fait vit dans les plans et
  les commits. Le corps d'un ticket décrit ce qui doit devenir vrai.
- **Ne jamais réutiliser un `id`.** Un ticket supprimé laisse son numéro mort.
  Le reprendre ferait pointer d'anciennes références sur autre chose.
- **Ne pas supprimer une colonne sans reloger ses tickets.** Retirer l'entrée du
  board laisse des tickets citant une colonne absente. Réécrire leur `colonne`
  d'abord.
- Le reste du dossier `ovrsee/` se lit et ne s'écrit pas — voir le skill
  `ovrsee`.

## Epics

Un epic est un ticket qui regroupe plusieurs autres tickets autour d'un même sujet.
Il signale à Claude qu'il faut penser en grappes, pas en tickets à plat.

**Créer un epic.** Lorsque plusieurs tickets relèvent d'un même domaine — ou quand
tu proposes 3+ tâches liées et qu'on demande de les regrouper — écris un ticket
avec `"type": "epic"` dans le frontmatter. Exemple concret : l'epic « Robustesse
du rendu » regroupe « malformé vide tout », « aucun garde-fou », « ticket
corrompu ». Un epic a un titre et des critères d'acceptation comme les autres.

**Rattacher un enfant.** Dans un ticket enfant, ajoute `"epic": "T-0015"` (l'`id`
de l'epic). Le ticket s'affiche alors au tableau sous son epic, sans indentation,
juste marqué du numéro parent. Les enfants héritent du tri global (priorité, date).

**Détacher.** Supprime le champ `epic` du ticket enfant. Il revient indépendant,
ne disparaît pas.

**Supprimer un epic.** Supprime son fichier. Ses enfants restent intacts, orphelins.
Chaque enfant redevient un ticket autonome dans le flux normal.

| Champ | Règle |
|---|---|
| `type` | `"epic"` pour un regroupement, absent sinon. |
| `epic` | L'`id` d'un epic auquel ce ticket appartient, ou absent. |

L'interface affiche les épics en premier, puis leurs enfants, puis les orphelins.
