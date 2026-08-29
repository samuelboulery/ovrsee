# Note de cadrage — issue #54 : ajouter une image dans un ticket

> **Statut** : proposition d'arbitrage, à trancher avant toute ligne de code.
> **Date** : 2026-08-29
> **Contexte** : [issue #54](https://github.com/samuelboulery/ovrsee/issues/54)

## La demande

Pouvoir joindre une image à un ticket écrit à la main, pour signaler un bug ou
illustrer ce qu'on souhaite. La demande note que ça marche déjà bien quand Claude
écrit le ticket et qu'on lui donne les images — le manque est sur la petite tâche
saisie directement.

L'issue propose elle-même une piste de rétention : « peut-être que pour alléger le
stockage, si le ticket est *fait* l'image se supprime ? Ou au bout de x temps ? »

## La question qui bloque

L'invariant du cadrage :

> **L'ovrsee lit ; il n'exécute que le terminal qu'on lui demande.**

Et son corollaire écrit, qui est la vraie contrainte ici :

> Toute proposition qui fait écrire l'application ailleurs que dans
> `ovrsee/tickets/` et `ovrsee/board.json` […] contredit le cadrage — le dire
> avant de l'implémenter.

Une image n'est pas un `.md`. Elle ne peut pas vivre *dans* `ovrsee/tickets/*.md`.
Elle demande donc soit un nouvel emplacement d'écriture, soit un encodage dans le
markdown. C'est exactement le cas que le corollaire est fait pour arrêter.

**Mais** — et c'est ce qui rend l'arbitrage intéressant — le dépôt contient déjà
deux précédents qui tranchent une bonne partie de la question.

## Les deux précédents

### 1. L'ovrsee écrit déjà des binaires versionnés

`crawl/index.js:447` écrit des PNG dans `ovrsee/pages/shots/`. Le dossier pèse
aujourd'hui **8 Mo**, la plus grosse chose de `ovrsee/`.

La rétention est déjà résolue, et pas à la main : `pruneShots()`
(`crawl/index.js:403`) purge à chaque crawl selon `retainable()` — c'est le
correctif de T-0136 (« alléger les captures du crawl »), motivé par le cas réel de
douze crawls du même jour.

Et surtout : `.gitignore:58` exclut `ovrsee/pages/shots/`, avec sa raison écrite —
*« régénérées à chaque commit, purge auto côté crawl »*.

**Ce que ça établit** : le dépôt sait déjà écrire des binaires sous `ovrsee/`, sait
déjà les purger, et sait déjà décider de ne pas les versionner. Le corollaire du
cadrage n'interdit donc pas *matériellement* d'écrire une image — `shots/` le fait
tous les jours.

### 2. L'interface sait déjà rendre une image du dépôt

`app/src/markdown.tsx` reconnaît `![alt](src)` (ligne 152) et `<img>` (ligne 37,
`HTML_IMG`) — **les deux seules balises HTML reconnues**, avec leur raison écrite :
une image du dépôt est servie, un domaine tiers ne l'est pas (ligne 75).
`renderMarkdown` prend déjà une `root` « pour servir les images et vidéos qu'il
cite » (ligne 348).

**Ce que ça établit** : côté rendu, il n'y a **rien à construire**. Un ticket qui
cite `![capture](../images/T-0054-a1b2c3.png)` s'affiche déjà. La feature n'est pas
une feature de rendu, c'est une feature d'**écriture**.

## Ce qui reste vraiment à trancher

Les précédents règlent le rendu et la légitimité du binaire. Il reste trois
questions, et seulement trois.

### Q1 — Versionné ou non ? → **Non versionné**

`shots/` donne la règle : *ce que l'ovrsee peut régénérer n'est pas versionné*.
Mais une image jointe à un ticket **ne se régénère pas** — c'est une capture d'un
bug, elle est irremplaçable. Le raisonnement de `shots/` ne s'applique donc pas
tel quel.

L'argument qui tranche est ailleurs, et il est dans le cadrage : *« si l'application
disparaît, rien n'est perdu »*. Une image non versionnée casserait cette promesse —
le ticket survivrait, son illustration non.

**Sauf que** l'argument inverse est plus fort : versionner des binaires saisis à la
main, c'est faire grossir l'historique git **irréversiblement**. Un `git rm` ne
récupère rien ; la purge proposée dans l'issue (« si le ticket est fait, l'image se
supprime ») serait un mensonge — l'image resterait dans l'historique pour toujours.
La rétention promise est **inapplicable** sur du versionné.

> **Arbitrage : non versionné.** `ovrsee/images/` dans `.gitignore`, comme
> `shots/`. La promesse « rien n'est perdu » est maintenue pour le **texte**, qui
> est la vérité du ticket ; l'image est un confort local, et le ticket doit rester
> lisible sans elle.
>
> **Conséquence à assumer et à écrire** : une image ne suit pas le dépôt. Sur une
> autre machine, le ticket s'affiche sans elle. Le rendu doit dégrader proprement —
> `markdown.tsx` le fait déjà (ligne 81 : *« mieux vaut un chemin lisible qu'une
> image cassée »*), ce qui confirme que ce chemin a déjà été pensé.

### Q2 — Qui écrit le fichier ? → **IPC Electron, pas `/api/*`**

Le cadrage est explicite et répété : `/api/*` est aussi servi par le dev server
Vite en **HTTP local non authentifié**. Le crawl et les secrets d'intégration
passent tous deux par IPC Electron pour cette raison.

Une route `/api/` qui accepte un upload d'image serait, sur une machine où
`pnpm dev` tourne, **une primitive d'écriture de fichier arbitraire ouverte à tout
processus local**. C'est strictement pire que ce que T-0190 corrige.

> **Arbitrage : canal IPC dédié**, sur le modèle de `crawl:*`. Le processus
> principal :
> - valide le type réel (magic bytes, pas l'extension),
> - impose un plafond de taille,
> - **génère lui-même le nom de fichier** (ticket + hash), sans jamais reprendre
>   un nom fourni par le renderer — sinon `../../` sort du dossier,
> - écrit avec `writeFileNoFollow` (déjà utilisé par le crawl, `crawl/index.js:481`)
>   pour ne pas suivre un lien symbolique.

### Q3 — La rétention → **à la suppression du ticket, pas à « fait »**

L'issue propose la purge quand le ticket passe à « fait ». Je propose de refuser
cette règle-là : un ticket « fait » se relit — c'est même toute la raison d'être
d'Ovrsee, garder l'historique daté. Perdre la capture du bug au moment précis où
le ticket devient une archive consultable, c'est perdre la pièce au moment où elle
sert.

> **Arbitrage : purge des images orphelines**, sur le modèle exact de
> `orphanShots()` (`crawl/index.js`, déjà écrit, déjà testé) — une image qu'aucun
> ticket ne cite plus est supprimée. Le mécanisme existe, il se recopie.
>
> Le volume ne justifie pas plus : les tickets se saisissent à la main, c'est de
> l'ordre de la dizaine d'images, contre 8 Mo de captures automatiques.
> Une purge temporelle (« au bout de x temps ») serait de la complexité sans cas
> d'usage constaté — **YAGNI**.

## Verdict

**La feature est compatible avec le cadrage**, à trois conditions non négociables :

| # | Condition | Raison |
|---|---|---|
| 1 | `ovrsee/images/` **gitignoré** | Une rétention promise sur du versionné est un mensonge ; l'historique git ne se purge pas |
| 2 | Écriture par **IPC Electron uniquement** | `/api/*` est du HTTP local non authentifié ; une route d'upload y serait une écriture de fichier arbitraire |
| 3 | Le ticket reste **lisible sans son image** | C'est ce qui maintient « si l'app disparaît, rien n'est perdu » |

Le corollaire du cadrage (« ne rien écrire hors `tickets/` et `board.json` ») doit
être **amendé explicitement** dans `CLAUDE.md` si on accepte, comme il l'a
implicitement été pour `shots/`. Ne pas le faire laisserait une règle écrite que le
code contredit — et la prochaine proposition s'appuierait sur la contradiction
plutôt que sur la règle.

## Charge estimée

**S**, plus faible qu'il n'y paraît :
- rendu : **rien** (`markdown.tsx` sait déjà)
- purge : recopie d'`orphanShots()`
- reste : un canal IPC validant + le geste de saisie dans `TableauDetail.tsx`

## Ce que je recommande

Ne pas la faire maintenant. Elle est **saine mais pas urgente**, et les deux
tickets sécurité « Prêt » (T-0190, T-0191) valent mieux le temps. Cette note
existe pour que la décision soit déjà prise le jour où on l'ouvre — c'est le
travail de cadrage, pas le code, qui était le vrai coût ici.
