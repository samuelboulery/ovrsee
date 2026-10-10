---
{
  "status": "open",
  "title": "Correctifs de l'audit : lot crawl et correctifs rapides",
  "opened": "2026-10-10",
  "closed": null,
  "commits": [
    {
      "sha": "7d10451",
      "date": "2026-10-10",
      "files": []
    },
    {
      "sha": "6270a0e",
      "date": "2026-10-10",
      "files": [
        "hooks/brief.js",
        "hooks/brief.test.js"
      ]
    },
    {
      "sha": "0096235",
      "date": "2026-10-10",
      "files": [
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx"
      ]
    },
    {
      "sha": "6e27235",
      "date": "2026-10-10",
      "files": [
        "app/src/Shell.tsx"
      ]
    },
    {
      "sha": "f78dd60",
      "date": "2026-10-10",
      "files": [
        "app/src/App.tsx",
        "app/src/Shell.tsx",
        "app/src/render.test.tsx",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "5287191",
      "date": "2026-10-10",
      "files": [
        "app/src/api.ts",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/tabs/Sante.tsx",
        "hooks/i18n.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "0f69380",
      "date": "2026-10-10",
      "files": [
        "crawl/index.js",
        "crawl/index.test.js"
      ]
    },
    {
      "sha": "387cc11",
      "date": "2026-10-10",
      "files": [
        "app/src/tabs/Produit.tsx",
        "app/src/useCrawl.ts",
        "crawl/auth.js",
        "crawl/chrome.js",
        "crawl/chrome.test.js",
        "crawl/index.js",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "db5bbde",
      "date": "2026-10-10",
      "files": [
        "app/src/EquipmentPanel.tsx",
        "app/src/Shell.tsx",
        "app/src/useCrawl.ts",
        "electron/main.js",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "d1ef472",
      "date": "2026-10-10",
      "files": [
        "crawl/index.js",
        "crawl/serveur.js",
        "crawl/serveur.test.js"
      ]
    },
    {
      "sha": "ebd2ef1",
      "date": "2026-10-10",
      "files": [
        "CLAUDE.md"
      ]
    },
    {
      "sha": "d90110f",
      "date": "2026-10-10",
      "files": [
        "app/src/App.tsx",
        "app/src/Shell.tsx",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "hooks/i18n.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js"
      ]
    },
    {
      "sha": "4874bbf",
      "date": "2026-10-10",
      "files": [
        "CLAUDE.md",
        "crawl/confiance.js",
        "crawl/confiance.test.js",
        "crawl/index.js",
        "crawl/serveur.js",
        "crawl/serveur.test.js"
      ]
    },
    {
      "sha": "c339b12",
      "date": "2026-10-10",
      "files": []
    }
  ]
}
---

# Correctifs de l'audit : lot crawl et correctifs rapides

## Contexte

L'audit du 10 oct. (plan `2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md`) a produit 24 tickets. Sam a retenu ce périmètre :
- le lot crawl (E-0280) ;
- les petits correctifs : T-0287, T-0288, T-0294, T-0298, T-0300, T-0302 ;
- T-0295, tranché « proposer dans l'UI ».

Les deux choix déjà faits :
- **Port occupé au crawl** : réutiliser le serveur si c'est le même projet, sinon refuser comme aujourd'hui.
- **Clôture d'un plan dont tous les tickets sont soldés** : un bouton, jamais automatique.

L'objectif est de faire passer les échecs de `scans.jsonl` de 35 % à presque zéro, et de supprimer les pannes muettes repérées.

## Préalable

- **Branche** : `feat/audit-crawl-correctifs` depuis `main`.
- **Rattachement des tickets** : une fois ce plan capturé, les tickets le citent encore comme plan l'audit. Le gate bloquerait donc toute édition. Il faut passer le champ `plan` des 11 tickets au plan capturé, avec `updateTicket` (`hooks/tickets.js:367`).
- **Commits** : un commit par ticket, en Conventional Commits français, qui cite `T-XXXX`.
- **TDD** : test d'abord pour chaque fonction pure.

## Correctifs rapides

1. **T-0298 : le brief compte les epics comme des tickets.**
   - Constat : `hooks/brief.js:189` filtre sur `colonne` sans tenir compte des epics.
   - Correctif : reproduire la règle de `restant`/`compterTickets` (`app/src/data.ts:473`). Un epic qui a des enfants ne compte pas ; un epic vide compte s'il n'est pas en colonne finale.
   - Avant de coder : vérifier la forme des tickets passés au brief (à plat, avec `type` et `epic` ?).
   - Test dans `hooks/brief.test.js` : un epic dont les enfants sont faits n'est pas listé.

2. **T-0302 : la palette affiche le total des tickets.**
   - Constat : `CommandPalette.tsx:93` utilise `tickets.length`.
   - Correctif : passer à `restant(tickets, board)`. Ajouter la prop `board`, passée depuis `App.tsx`.

3. **T-0300 : les lignes de projet ne s'activent pas au clavier.**
   - Constat : la ligne est une `div onClick` (`Shell.tsx:~593`).
   - Correctif : garder la `div` racine sans `onClick`. Le nom et l'âge vont dans un `<button type="button">` sans style, en `flex: 1`, qui appelle `onPick`. Le bouton `×` devient son frère et non son enfant, pour éviter un bouton imbriqué.
   - À conserver : `onBlur` avec `contains(relatedTarget)` et `visibility`.

4. **T-0287 : une erreur secondaire efface toute l'interface.**
   - Constat : `App.tsx:67` utilise un seul état d'erreur pour tout.
   - Correctif : scinder en deux états.
     - `error`, fatal : `fetchProjects` (192) et `fetchSnapshot` (248, 369). Le `Message` plein écran gagne un bouton « Réessayer », qui appelle `reload`.
     - `avis`, secondaire : lignes 205, 231, 414, 619, 677, 684, 846, 849, 877. Il s'affiche dans un bandeau `role="alert"` fermable, au-dessus de `<main>`, qui ne masque rien. Le style vient de `MenuBarPanel.tsx:206`.
   - Le composant `Bandeau` est petit et vit dans `Shell.tsx`, à côté de `Message`.
   - Clés i18n dans `hooks/i18n.js`, en FR et EN.
   - Test de rendu dans `render.test.tsx`.

5. **T-0288 et T-0295 : la clôture est muette, et rien ne propose de clore.**
   - **Route** (`server/api.js:~588`) :
     - collecter les lignes de journal de `closeOpenPlans` et renvoyer `{ closed, log }` ;
     - accepter un corps facultatif `{ plan }`, validé par `isSafePlanFileName` (`hooks/plans.js`), qui devient `{ only: plan }` ;
     - au passage, documenter que la route sans `plan` clôt tous les plans ouverts.
   - **Client** : `api.ts:62` `closeActivePlans(path, plan?)`.
   - **Interface** (`tabs/Sante.tsx`) :
     - si `closed` est vide, afficher `log` à la place de l'erreur, en ligne 113 ;
     - dans la liste des plans ouverts (117-151), afficher un bouton « Clore » pour tout plan dont les tickets, au moins un, sont tous en `colonneFinale(snapshot.board)`. Ce bouton appelle `closeActivePlans(root, plan.file)`.
   - **Tests** dans `server/api.test.js` :
     - un plan sans commit renvoie un `log` lisible ;
     - `{ plan }` ne clôt que ce plan ;
     - un nom invalide est refusé.

6. **T-0294 : l'extrait de page est le texte brut de toute la page.**
   - Constat : `crawl/index.js:405` capture `document.body.innerText`.
   - Correctif : `page.evaluate` renvoie aussi `meta[name=description]`, le premier `h1` et le premier `p` du contenu principal. Une fonction pure exportée `extraitDePage({ description, h1, p, texte })` choisit, avec repli sur `texte`. `sanitizePageCapture` reste le seul filtre (redige et 400 caractères).
   - Test dans `crawl/index.test.js`.

## Lot crawl (E-0280)

7. **T-0283 : Chrome absent, et un lancement refusé qui ne dit rien.**
   - **Chrome** (`crawl/index.js`) :
     - déplacer `chromium.launch` avant `startApp`, pour ne pas lancer le serveur de dev pour rien ;
     - envelopper l'appel : l'erreur Playwright de canal introuvable devient « Google Chrome introuvable — le crawl pilote le Chrome installé sur ce poste. Installez-le puis relancez. ». C'est une fonction pure exportée `messageLancement(err)`, testée.
     - même enveloppe dans `crawl/auth.js:66`.
   - **Configuration** : note sur Chrome dans `ConfigCrawl.tsx`, avec une clé i18n.
   - **Lancement refusé** :
     - `useCrawl.demarrer` (`useCrawl.ts:73`) lit la promesse de `start`. Si elle renvoie `{ error }`, il pose un état `erreur`, exposé par le hook.
     - `Produit.tsx:383` affiche cet état à côté du bouton Crawler, en `role="alert"`.

8. **T-0282 : l'annulation de l'accord est muette, et l'échec se voit mal.**
   - `crawl:start` (`electron/main.js:431-453`), en cas d'annulation de la modale : renvoyer `{ error: <message « non approuvée, le crawl restera bloqué » > }` au lieu de `crawlState()`. Le point 7 l'affiche.
   - `approuverCrawl` (`useCrawl.ts:46`) renvoie la `Promise<boolean>`. `EquipmentPanel` affiche une note quand l'utilisateur refuse.
   - `ScanBadge` (`Shell.tsx:64`) : un scan en échec porte `title={scan.error}`, pour que la raison se lise au survol depuis n'importe quel onglet. La pastille rouge existe déjà.

9. **T-0281 : réutiliser le serveur déjà lancé quand c'est le même projet.**
   - `crawl/index.js` : nouvelle fonction exportée `serveurDuProjet(baseUrl, titreAttendu)`.
     - Elle fait un GET sur `baseUrl` (délai de 2 s) et extrait le `<title>` du HTML par regex.
     - Elle renvoie vrai seulement si ce titre, une fois rogné, n'est pas vide et vaut le `title` de la route `/` du `pages.json` du dernier crawl réussi.
     - Commentaire `ponytail:` : deux applications avec le même titre par défaut (« Vite + React ») se confondraient. Les captures seraient fausses, sans exécution. L'amélioration possible est une empreinte du contenu.
   - `run()` : si le port répond **et** que `serveurDuProjet` est vrai, on n'appelle ni `assurerConfiance` ni `startApp`. Rien n'est exécuté, donc aucun accord n'est requis ; cela fait aussi tomber une partie des refus « non approuvée ». Le `finally` tolère `app = null`.
   - Sinon : le comportement actuel, accord puis `assertPortFree`, qui refuse comme aujourd'hui.
   - Une ligne de progression `[crawl] serveur déjà lancé, réutilisé` pour l'interface.
   - Tests avec `node:http` `createServer().listen(0)` : même titre donne vrai ; titre différent, titre vide ou absence de crawl précédent donnent faux.
   - CLAUDE.md : mettre à jour le piège « Le crawl refuse de démarrer si `baseUrl` répond déjà ».

10. **T-0284 : les captures plus anciennes que le code ne se voient pas.**
    - `hooks/snapshot.js` ajoute un booléen `capturesPerimees`. Il vaut vrai si le dernier scan réussi a un `commit`, que `git diff --name-only <commit> HEAD` passé par `hooks/git.js` (la garde, obligatoire) rend au moins un fichier hors de `DERIVED`, et que des pages existent.
    - `DERIVED` est exporté depuis `hooks/ovrsee-post-commit.js`, pour une seule source.
    - Un sha introuvable (historique réécrit) donne faux, sans exception.
    - Type `Snapshot` dans `app/src/data.ts`.
    - `ScanBadge` : pastille en avertissement et infobulle « captures plus anciennes que le code », clé i18n.
    - Test dans `hooks/snapshot.test.js`, sur un dépôt git temporaire : un commit qui ne touche que `ovrsee/` donne faux, un commit de code donne vrai.

## Fichiers touchés

- `hooks/brief.js`, `hooks/snapshot.js`, `hooks/ovrsee-post-commit.js`, `hooks/i18n.js`
- `crawl/index.js`, `crawl/auth.js`
- `server/api.js`, `electron/main.js`
- `app/src/` : `App.tsx`, `Shell.tsx`, `CommandPalette.tsx`, `useCrawl.ts`, `ConfigCrawl.tsx`, `EquipmentPanel.tsx`, `api.ts`, `data.ts`, `tabs/Sante.tsx`, `tabs/Produit.tsx`
- Les tests de chacun, et CLAUDE.md pour le piège du port.

Attention au plafond de 800 lignes (`hooks/documentation.test.js`) sur `App.tsx` (exempté), `Shell.tsx` (695) et `Terminal.tsx`. Si `Shell.tsx` approche la limite, sortir `Bandeau` et `ScanBadge` dans `app/src/Bandeau.tsx`.

## Vérification

- `pnpm test`, `pnpm typecheck`, `pnpm lint` et `pnpm build:ui` au vert, sortie constatée.
- `pnpm electron` :
  - **Crawl** : serveur de dev lancé, puis clic sur Crawler. Une ligne `ok: true` doit s'ajouter à `scans.jsonl`, sans modale d'accord.
  - **Accord** : annuler la modale doit afficher le message près du bouton.
  - **Erreur secondaire** : la simuler, par exemple en rendant `~/.claude/ovrsee/settings.json` non inscriptible puis en redimensionnant le terminal. On doit voir le bandeau, et l'onglet doit rester utilisable.
  - **Clavier** : Tab sur le sélecteur de projet.
  - **Clôture** : bouton « Clore » sur un plan dont les tickets sont soldés.
  - **Péremption** : pastille de scan en avertissement après un commit de code non crawlé.
- Au commit, avec le serveur de dev lancé, le post-commit écrit `ok: true`.
- Revue : agent `typescript-reviewer`, puis `security-reviewer` sur T-0281 (une décision de ne pas exécuter qui saute la garde de confiance) et T-0288 (corps de route).
- PR unique décrivant toute la branche.
