# Ovrsee — Document de cadrage

*Cadrage réalisé le 8 août 2026. Toutes les décisions actées ci-dessous sont révisables, mais elles ont été arbitrées, pas subies.*

---

## 1. Problème

Sam développe des projets en vibecoding avec Claude Code et n'ouvre plus d'IDE ni ne lit le code produit. Quand il revient sur un projet après plusieurs semaines d'arrêt, il ne sait plus comment il fonctionne, ce qu'il restait à faire, ni pourquoi tel choix a été fait — et il doit rouvrir l'application et tout re-parcourir pour reconstituer un contexte qui n'est écrit nulle part.

Le coût actuel est double. Un coût de temps immédiat, à chaque reprise. Et un coût irréversible : le raisonnement derrière chaque décision n'existe que dans le fil d'une conversation qui disparaît. Il ne se récupère jamais.

Objectif : réduire le coût de reprise en main, et garder la maîtrise d'un code qu'il n'a pas écrit.

---

## 2. Ce qui existe déjà

**Le créneau « app Mac + agents » est occupé et instable.** Conductor, Crystal, Opcode, Emdash, Nimbalyst. Bloop, l'éditeur de Vibe Kanban, a fermé en avril 2026. Enseignement retenu : ces outils gèrent *plusieurs agents en parallèle maintenant*. Aucun ne traite *un projet retrouvé dans trois semaines*. Le problème de Sam n'est pas couvert.

**La cartographie de code est un problème résolu.** CodeSee (absorbé par GitKraken), Madge, dependency-cruiser. Mais tous cartographient des *fichiers*. Sam pense en *écrans*. Ce mapping-là n'existe nulle part — c'est le seul actif propre du projet.

**Graphify est réutilisable tel quel, et massivement.** Parsing AST local et déterministe, sans appel LLM sur le code. Reconstruction automatique à chaque commit. Schémas SQL et introspection PostgreSQL. Étiquetage de chaque relation en `EXTRACTED` / `INFERRED` / `AMBIGUOUS`. Et surtout : les commentaires `# WHY:` et les citations d'ADR deviennent des nœuds reliés au code qu'ils expliquent.

*Réserve :* Graphify est un projet jeune (YC S26) avec une offre commerciale en préparation. Le CLI est sous licence libre, ce qui limite le risque, mais la dépendance est réelle.

**Ce qui justifie de construire quand même :** trois trous que rien ne couvre — la vue produit (pages, navigation, captures), le backlog, et la chronologie datée.

**Le piège documenté, qui gouverne toute la conception :** une documentation d'architecture devient fausse en quelques semaines, et une documentation fausse est pire que pas de documentation — dès qu'on y trouve deux erreurs, on cesse de faire confiance à l'ensemble, y compris aux parties justes.

---

## 3. Périmètre v1

### Dedans

- **Vue Produit** — carte des pages, relations de navigation, captures d'écran datées, résumé d'une ligne par page
- **Vue Historique** — chronologie des plans exécutés : quand, quoi, pourquoi, quels fichiers
- **Vue Backlog** — les plans ouverts, non exécutés
- **Vue Données** et **Vue Stack** — lues depuis Graphify, non reconstruites
- **Densité d'activité** — où le travail s'est concentré, ce qui dort
- **Multi-projets** — liste des projets, chacun avec son ovrsee

### Dehors, et pourquoi

| Écarté | Raison |
|---|---|
| Construire la cartographie technique et la vue base de données | Graphify le fait mieux, gratuitement, et à jour à chaque commit |
| Un objet `feature` | Non définissable de façon stable. Se calcule à partir des plans |
| Captures des états d'écran (modale, erreur, liste vide) | Reporté en v2 — coût élevé, bénéfice non démontré |
| Gestion des accès et credentials | Un gestionnaire de mots de passe et un fichier `ACCESS.md` suffisent |
| Application native Swift | Le terminal embarqué est aussi bon en web. Voir §6 |

**Révision du cadrage — Serveur MCP**

L'écart supposait un mono-projet consulté depuis Claude Code dans le dépôt courant.
L'usage depuis Claude Desktop change cette prémisse : il n'y a pas de dépôt courant
dans une fenêtre Claude, et le registre de projets (introduit pour le multi-projet
lui-même) expose exactement ce qui manque. Le serveur MCP devient une traduction
transparente des routes `/api/*` du serveur HTTP vers stdio JSON-RPC 2.0 : même
interface, même validations (registre + symlinks refusés), ni lecture ni écriture
en dehors de `ovrsee/tickets/` et `ovrsee/board.json`. Zéro dépendance, même
standard de tests que `server/api.test.js`.

---

## 4. Modèle de données

**Trois objets. Rien d'autre.**

**Page** — une vue de l'application. Dérivée du code : sa route, et les liens qui partent vers d'autres pages. Toujours vraie, jamais saisie à la main.

**Plan** — un plan approuvé par Sam dans Claude Code. Ouvert au moment de l'approbation, clos par le commit qui l'exécute. Contient : la date, l'intention, les alternatives écartées, les fichiers touchés.

**Capture** — une photographie d'une page à une date donnée. Rattachée à un commit.

**Relations :** une page a plusieurs captures dans le temps. Un plan touche des fichiers, et ces fichiers appartiennent à des pages — c'est ce qui relie l'historique à la carte.

**Ce qui se calcule au lieu de se stocker :**

- Le **backlog** = les plans ouverts
- Le **changelog** = les plans clos, triés par date
- Le **nombre de features d'une page** = les plans clos ayant touché ses fichiers
- L'**historique d'un écran** = ses captures successives

*Limite assumée :* une page jamais retravaillée affichera zéro plan. Ce n'est pas une erreur — c'est l'information qu'elle n'a pas bougé depuis sa création.

---

## 5. Boucle de mise à jour

**Principe directeur : l'ovrsee lit, il n'exécute jamais.** La vérité vit dans des fichiers markdown et des images, dans le repo, versionnés par git. L'application est une vue. Si elle disparaît, rien n'est perdu.

### Qui écrit quoi

| Quand | Quoi | Qui |
|---|---|---|
| Plan approuvé | Ouverture d'un fichier de plan | Hook Claude Code |
| Commit | Clôture du plan, fichiers touchés | Hook post-commit |
| Commit | Crawl de l'app, captures datées, graphe de navigation | Script post-commit |
| Commit | Reconstruction du graphe de code | Graphify |
| Décision locale | Commentaire `# WHY:` à côté du code concerné | Claude Code, pendant la session |
| Démarrage de session | Réinjection du contexte dans Claude Code | Hook `SessionStart` |

### Comment l'information reste vraie

**Capture large, filtrage à la lecture.** Ce qui n'est pas capturé est perdu pour toujours ; un filtre trop généreux se corrige n'importe quand. On ne met jamais l'irréversible derrière le réversible. Aucun juge automatique ne décide de ce qui mérite d'être gardé.

**Le crawl tourne au commit, jamais à la reprise.** Au moment où Sam revient sur un projet, c'est précisément le moment où il est le moins capable de le démarrer — build cassé, variables d'environnement oubliées. Photographier une application exige qu'elle tourne. Donc on photographie pendant que l'environnement est chaud. À la reprise, on lit un historique.

**Une capture est datée, toujours.** C'est le seul endroit du système où la dérive est tolérable : une phrase fausse ment sans prévenir, une image marquée « il y a trois semaines » est honnête.

**Un scan échoué s'écrit.** Si le crawl ne démarre pas, l'ovrsee inscrit « scan échoué le X » plutôt que de conserver silencieusement la capture précédente.

**Rien ne s'écrit à la main.** Un fichier que Sam devrait maintenir lui-même serait faux en trois semaines.

---

## 6. Interface

Une fenêtre par projet, en onglets. Ce qu'on doit comprendre en cinq secondes sur chacun :

| Onglet | En cinq secondes |
|---|---|
| **Produit** | À quoi ressemble l'app, combien de pages, comment on circule entre elles |
| **Historique** | Ce qui a été fait récemment, et pourquoi |
| **Backlog** | Ce qui restait à faire |
| **Données** | Quelles tables existent, qui les utilise |
| **Stack** | Ce qui est utilisé, et pourquoi |

**Vue d'accueil multi-projets :** la liste des projets, avec pour chacun la date de dernière activité et le nombre de plans ouverts.

**Technique :** coquille web embarquée (Tauri ou Electron), terminal Claude Code intégré via xterm.js et un pseudo-terminal. C'est le mécanisme du terminal intégré de VS Code — pas une version dégradée. Injecter du contexte depuis l'ovrsee revient à écrire dans ce terminal.

*Point à vérifier au moment de l'implémentation :* un terminal embarqué lance le binaire en mode interactif, donc dans le régime de facturation habituel. Piloter Claude Code par l'Agent SDK en sortirait, avec un régime de facturation dont le statut actuel est incertain — les sources publiques se contredisent.

---

## 7. Incréments

### v0.1 — La capture (aucune interface)

Un skill et des hooks qui écrivent dans `/ovrsee/plans/`. Un fichier par plan approuvé, clos au commit.

*Pourquoi en premier :* c'est le seul contenu périssable. Chaque semaine sans lui est définitivement perdue. La carte, elle, se génère aussi bien dans six mois.

**Critère de succès :** ouvrir une session Claude Code, lui interdire de lire le code, ne lui donner que `/ovrsee/`, demander un brief du projet. Si le brief est utilisable, c'est validé.

*Reste ouvert :* la granularité du plan.

### v0.2 — Le crawl (aucune interface)

Script post-commit : démarrage de l'app, extraction des routes, parcours, captures datées et graphe de navigation dans `/ovrsee/pages/`. Sortie : un HTML statique brut.

**Critère de succès :** ça passe sur le projet le plus tordu — authentification et routes dynamiques comprises.

*Reste ouvert :* la rétention des images (une piste : une capture par semaine au-delà d'un mois).

### v0.3 — La lecture (l'interface arrive)

Les cinq onglets, en lecture seule.

**Critère de succès, le seul qui compte :** est-ce que Sam l'ouvre spontanément en revenant sur un projet, ou retourne-t-il au terminal par réflexe ?

### v1 — Multi-projets et boucle inverse

Liste des projets. Hook `SessionStart` qui réinjecte le contexte dans Claude Code au démarrage.

**Critère de succès :** Claude Code démarre une session en connaissant déjà l'état du projet, sans qu'on le lui explique.

### v1.1 — La coquille

Empaquetage en application de bureau, terminal Claude Code intégré, injection de contexte par clic.

**Critère de succès :** Sam ne quitte plus l'application pendant une session de travail.

*Pourquoi en dernier :* c'est la seule brique qui ne produit aucune donnée. Elle n'a de valeur que quand les onglets sont pleins. Et l'ordre est asymétrique : envelopper une vue web existante coûte un après-midi, alors que commencer par la coquille couple tout le reste au framework.

---

## 8. Risques ouverts

### Graves

**Le crawl ne démarre pas.** L'application ne se lance plus — dépendances obsolètes, service externe disparu. C'est le scénario le plus probable sur un projet dormant, et c'est exactement celui où l'ovrsee est le plus utile. *Mitigation :* les captures sont un historique versionné, pas un scan à la demande. L'ovrsee reste consultable sur un projet qui ne compile plus.

**Les plans creux.** Si les plans capturés sont verbeux et sans substance, l'historique devient illisible et personne ne le relit. C'est le piège classique des changelogs générés par agent. *Mitigation :* le critère n'est pas l'importance mais le fait qu'une porte ait été fermée — une décision écarte explicitement une alternative, une trace ne fait qu'énoncer.

**La dérive sémantique des résumés de page.** Une page existe toujours, son résumé décrit un comportement qui a changé. Indétectable automatiquement. C'est ce qui détruit la confiance dans l'ensemble. *Mitigation partielle :* régénération au commit, et `graphify reflect` signale les nœuds dont la source a bougé.

### Moyens

**Le poids des captures.** Vingt pages, un commit par jour, images versionnées dans git. Se règle par une politique de rétention, mais elle doit être décidée avant l'accumulation.

**La dépendance à Graphify.** Deux onglets en dépendent. Licence libre, mais projet jeune avec une offre commerciale en préparation.

**Le régime de facturation programmatique.** Statut incertain à ce jour. À vérifier avant toute automatisation qui sortirait du mode interactif.

### Faibles

**L'élargissement du périmètre.** Le désir de « tout gérer » a déjà refait surface plusieurs fois pendant ce cadrage. Chaque ajout est une surface supplémentaire qui peut devenir fausse.

**L'attrait de la coquille.** L'application native avec terminal intégré est la partie la plus séduisante et la moins productive de données. Le risque est de la construire en premier.
