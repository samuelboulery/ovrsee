# T-0190 — Confirmer la commande `dev` avant le premier crawl

**Threat model, design et plan d'implémentation.** Lecture seule : rien n'a été modifié.

---

## 0. Reformulation du problème

Le ticket parle de « confirmer une commande ». C'est une formulation trompeuse, et elle oriente mal l'implémentation.

`pnpm dev` est une ligne inoffensive à l'œil. Ce qu'elle exécute vit dans le `package.json` du dépôt observé, dans son lockfile, dans ses `postinstall`. Montrer la ligne ne permet donc **pas** de juger de sa dangerosité. Une revue de commande est hors d'atteinte, et prétendre le contraire donnerait exactement la fausse assurance que `validateCrawlConfig()` refuse déjà de donner (`server/api.js:164-179`).

Ce qui se décide réellement, c'est : **« est-ce que j'autorise l'ovrsee à exécuter du code de ce dépôt ? »** C'est la question de *workspace trust* de VS Code, et c'est une question de **provenance**, pas de contenu. Tout le design en découle : la boîte de dialogue affiche la commande parce qu'elle est le seul artefact concret disponible, mais son texte doit dire « ceci exécutera du code de ce dépôt », pas « relisez cette commande ».

Corollaire à garder en tête pendant tout ce qui suit : l'empreinte sur `dev` est un **fil-piège**, pas une frontière. Un attaquant qui contrôle le dépôt change `package.json`, pas `ovrsee.config.json`. On garde le fil-piège parce qu'il est gratuit et qu'il couvre la moitié visible du problème — pas parce qu'il ferme la porte.

---

## 1. Threat model

### 1.1 Frontières de confiance réelles

| Zone | Confiance | Écrit par |
|---|---|---|
| `~/.claude/ovrsee/` (`settings.json`, `projects.json`, `integrations.json`) | **Fiable** | L'utilisateur, via l'ovrsee. Hors dépôt, jamais versionné. |
| Code de l'ovrsee (`hooks/`, `crawl/`, `electron/`, `server/`) | **Fiable** | Le dépôt ovrsee lui-même. |
| `<projet>/ovrsee.config.json` | **Hostile** | Le dépôt observé — donc son auteur, qui peut ne pas être l'utilisateur. |
| `<projet>/ovrsee/**` (plans, tickets, `pages/scans.jsonl`, `board.json`) | **Hostile** | Idem : versionné, donc fourni par le clone. |
| `<projet>/package.json`, lockfile, `node_modules` | **Hostile** | Idem. |
| Renderer Electron | **Semi-fiable** | Rend du markdown de plans, des titres de pages crawlées, des tickets — contenu hostile. Une XSS y donne l'accès aux canaux IPC. |
| Surface `/api/*` | **Non authentifiée** | Servie aussi par le dev server Vite en HTTP local. `X-Ovrsee` est un marqueur, pas une auth. |

La frontière que T-0190 franchit est celle de la deuxième ligne : une **donnée hostile devient une exécution**, sans médiation humaine.

### 1.2 Attaquant et vecteur d'entrée

**Attaquant** : l'auteur d'un dépôt que l'utilisateur reçoit. Pas un attaquant réseau, pas un processus local — un auteur de code.

**Vecteurs concrets, par ordre de vraisemblance :**

1. **Le dépôt reçu.** Template GitHub, projet « vibecodé » partagé, dépôt client, fork. Il porte déjà un `ovrsee.config.json`. L'utilisateur l'ajoute au registre, l'équipe, clique « Crawler ». C'est le geste que l'application encourage explicitement.
2. **L'upstream compromis d'un dépôt déjà fiable.** `git pull` modifie `ovrsee.config.json`. Aucun hook ne crawle au `pull` (`ovrsee-post-merge.js` ne fait que `reconcile()`), donc l'exécution est différée au prochain commit ou au prochain clic — mais elle arrive, et sur un projet déjà « connu ».
3. **Le piège d'équipement.** `writeOvrseeConfig()` (`hooks/install.js:367-374`) écrit `ovrsee.config.json` **seulement s'il n'existe pas** ; sinon il consigne `« ovrsee.config.json existait déjà — conservé tel quel »`. Un dépôt reçu qui embarque sa propre configuration fait donc que l'utilisateur **tape une commande dans le formulaire d'équipement, voit l'écran de succès, et c'est la commande du dépôt qui s'exécutera**. Cette ligne du journal d'installation est le seul indice, noyée dans une liste. C'est le scénario le plus vicieux du lot, et il a une conséquence directe sur le design (§2.6).

### 1.3 STRIDE, ciblé

| Catégorie | Applicable ? | Analyse |
|---|---|---|
| **Spoofing** | Marginal | Le dépôt ne se fait pas passer pour un autre. Sauf : une boîte de dialogue rendue par le renderer serait usurpable par du contenu hostile (markdown de plan) — d'où le choix d'une modale native, §2.7. |
| **Tampering** | **Oui** | Altération d'une donnée de configuration versionnée qui pilote un `spawn`. C'est le cœur du sujet. |
| **Repudiation** | Faible | `scans.jsonl` trace les scans. Il ne trace pas *quelle commande* a tourné. Un correctif gratuit : consigner la commande approuvée dans le magasin de confiance, avec sa date. |
| **Information disclosure** | Indirect | Une commande `dev` hostile a accès à tout ce que l'utilisateur a — dont `~/.claude/ovrsee/integrations.json` (jetons Vercel/Supabase, `safeStorage` déchiffrable par le même compte). Le crawl est donc un chemin d'exfiltration des secrets que le cadrage a pris soin de sortir du dépôt. **C'est ce qui donne à T-0190 sa priorité haute.** |
| **Denial of service** | Hors sujet | Un dépôt hostile qui casse son propre crawl ne gagne rien. |
| **Elevation of privilege** | **Oui, le vrai impact** | « Lire un dépôt » devient « exécuter du code arbitraire sous le compte de l'utilisateur, sans invite, éventuellement sans clic ». Le chemin `post-commit` est même **entièrement automatique**. |

### 1.4 Tous les chemins d'exécution de `config.dev`

Deux sites d'exécution seulement, quatre points d'entrée. C'est la bonne nouvelle du dossier : la surface est petite et se ferme en un seul endroit.

**Sites d'exécution (`shellRun(config.dev)` → `spawn`) :**

| # | Site | Ligne |
|---|---|---|
| **A** | `crawl/index.js` → `startApp()` | `crawl/index.js:179` (dans `startApp`, appelé par `run()` ligne 414) |
| **B** | `crawl/auth.js` → `main()` | `crawl/auth.js:59` |

**Points d'entrée vers A :**

| # | Entrée | Interactif ? | Détail |
|---|---|---|---|
| A1 | Hook git `post-commit` → `spawnCrawl()` | **Non** | `hooks/ovrsee-post-commit.js:215-224`. `stdio: 'ignore'`, `detached`. Déclenché dès que `crawlUtile(sources)` — c'est-à-dire **dès qu'un commit touche au moins un fichier source**. Aucun humain dans la boucle. |
| A2 | IPC Electron `crawl:start` | Oui (clic) | `electron/main.js:350` → `startCrawl()` (`electron/crawl.js:98`). Garde : appartenance au registre. Le renderer n'envoie qu'un chemin. |
| A3 | CLI `pnpm ovrsee:crawl` | Oui (TTY) | `package.json` → `node crawl/index.js`. C'est aussi ce que l'onglet Produit copie dans le presse-papier en mode navigateur (`app/src/tabs/Produit.tsx:314`), le crawl n'étant pas lançable sans IPC. |
| A4 | `node crawl/index.js <chemin>` à la main | Oui (TTY) | Même binaire, argument explicite. |

**Point d'entrée vers B :**

| # | Entrée | Interactif ? | Détail |
|---|---|---|---|
| B1 | CLI `pnpm ovrsee:auth` | Oui (TTY, readline déjà présent) | `crawl/auth.js`. **Pas de garde de registre, pas de garde du tout.** Aucune interface ne le lance ; c'est une commande tapée. |

**Ce qui n'est *pas* un chemin, vérifié :**

- **MCP** — `mcp/dispatch.js` n'expose que des appels à `resolve()`. Aucun outil ne lance de crawl. ✔
- **`/api/*`** — aucune route ne spawn le crawler. `/api/project` action `init` **écrit** `ovrsee.config.json` (via `install()`), mais n'exécute rien. ✔
- **Onglet Navigateur** — `startUrl()` (`app/src/tabs/navigateur-webview.ts:96`) ne lit que `baseUrl`, pour pointer une webview. Ne démarre aucun serveur. ✔
- **`electron/pty.js`** — exécute le shell de connexion, jamais `config.dev`. C'est le terminal demandé, explicitement autorisé par l'invariant. ✔

**Conséquence de design** : les quatre points d'entrée convergent vers **deux appels à `shellRun`**. Le contrôle se place là, et nulle part ailleurs. Le placer dans `electron/main.js` ne couvrirait qu'A2 — un quart du problème, et pas celui qui est automatique.

**Trou adjacent, hors T-0190, à ficher séparément :** `mergeSettings()` (`hooks/settings.js:228-232`) laisse `ovrsee.config.json` du projet observé **surcharger le tableau `bootstrap`**, que `EquipmentPanel.tsx:336` propose d'envoyer au terminal Claude via `envoyerAuTerminal()` → `decideInjection()` (`app/src/brief.ts:136-138`), qui **ajoute `\n` et exécute immédiatement** pour toute entrée commençant par `!` ou `/`. Aujourd'hui la chaîne n'est pas complète : `EquipmentPanel` appelle `fetchSettings()` **sans chemin de projet** (ligne 157), donc reçoit le profil global seul, non surchargé. C'est une non-exploitabilité par accident, à un argument près. À corriger dans son propre ticket : retirer `bootstrap` de la liste des champs surchargeables par le projet.

### 1.5 TOCTOU

**Ce que le ticket appelle TOCTOU se décompose en deux races, dont une seule compte.**

**Race 1 — entre l'accord (processus principal Electron) et l'exécution (processus crawler).** Réelle. `crawl:start` lit `ovrsee.config.json`, montre la commande, l'utilisateur accepte, `startCrawl()` spawn `crawl/index.js`, qui **relit le fichier sur le disque**. Entre les deux, quelques centaines de millisecondes pendant lesquelles un `git pull` ou un `git checkout` concurrent peut changer la ligne. Fenêtre étroite, mais pas nulle : le crawl part souvent juste après une opération git.

**Race 2 — entre le `loadConfig()` du crawler et son `spawn`.** Inexistante, et il faut la garder inexistante : `loadConfig()` rend un objet en mémoire, `startApp(config)` passe `config.dev` — la même variable — à `shellRun`. Le fichier peut changer entre les deux, personne ne le relit.

**Ce qu'il faut empreindre, exactement** : **la chaîne en mémoire qui sera passée à `shellRun()`**, sans normalisation, au moment où on la tient. Pas le chemin du fichier, pas son `mtime`, pas son inode, pas un rehash après coup.

**Et la parade à la race 1 tombe alors toute seule** — c'est l'argument central du design : parce que le magasin de confiance retient **la chaîne approuvée** et non un booléen « projet fiable », le crawler compare ce qu'il vient de lire à ce qui a été approuvé. Si le fichier a changé entre l'accord et le lancement, **la comparaison échoue et le crawl refuse**. La course échoue fermée, sans verrou, sans passage de la commande par argv.

Il faut d'ailleurs *refuser* la solution évidente — que `main.js` passe la commande approuvée au crawler par `argv` ou par l'environnement. Elle supprimerait la relecture, donc la course. Mais elle ferait exécuter au crawler une commande **reçue d'un appelant externe**, ce qui contredit frontalement le cadrage : « la surface exposée ne reçoit qu'un chemin de projet […] ni nom de programme, ni commande, ni même la ligne `dev` de la configuration, que le crawler lit lui-même sur le disque » (`CLAUDE.md`). On garde la relecture, et on s'en sert.

### 1.6 Hors périmètre, et pourquoi

- **Le dépôt qu'on écrit soi-même.** Arbitré par le cadrage. Exécuter le `dev` de son propre projet est le fonctionnement nominal ; le design doit le laisser sans friction (§2.6).
- **Le contenu de ce que `dev` déclenche** (scripts npm, `postinstall`, lockfile). Irrévisable par construction — voir §0. On accorde une confiance à un dépôt, pas un quitus à une ligne.
- **Le terminal intégré.** L'utilisateur y tape ce qu'il veut ; l'invariant l'autorise nommément.
- **Le JavaScript de l'application observée, exécuté par Playwright.** Le crawl est un navigateur : faire tourner le JS de la page est le but. Le bac à sable de Chrome tient cette frontière.
- **Le durcissement de `/api/*`.** Cette surface est déjà, via l'action `init`, capable d'écrire des fichiers et **d'installer un hook git `post-commit`** dans un dépôt. C'est une exposition préexistante, strictement plus forte que le sujet du ticket. On ne l'élargit pas (§2.7), on ne la traite pas ici.
- **Un bac à sable pour le serveur de dev** (conteneur, `seatbelt`, utilisateur dédié). Ce serait la vraie réponse à §0 — et un projet à part entière, contradictoire avec « cinq dépendances en production ». Non.
- **Signature ou vérification d'auteur du dépôt.** Aucune infrastructure pour ça, et l'utilisateur est seul.

---

## 2. Design

### 2.1 Où vit l'accord

**Dans `~/.claude/ovrsee/trust.json`. Hors du dépôt observé. Ce point n'est pas négociable.**

Un accord rangé dans `<projet>/ovrsee/` ou dans `ovrsee.config.json` serait **fourni par l'attaquant** : un dépôt reçu embarquerait sa propre approbation, versionnée, et le contrôle deviendrait purement décoratif. C'est le même raisonnement, mot pour mot, que celui qui a sorti `integrations.json` du dépôt.

L'emplacement suit la convention déjà en place — `settings.json`, `projects.json`, `integrations.json` — avec la variable d'échappement pour les tests, sans quoi `pnpm test` écrirait dans le profil réel de la machine :

```js
export const trustPath = () =>
  process.env.OVRSEE_TRUST ?? join(homedir(), '.claude', 'ovrsee', 'trust.json')
```

Écriture par `writeFileNoFollow()` (`hooks/plans.js`), comme le registre : c'est un fichier d'intégrité, un symlink planté à sa place le détournerait. `chmod 600` derrière, comme `crawl/auth.js` le fait pour l'état de session — il n'y a pas de secret dedans, mais il n'y a aucune raison qu'un autre compte de la machine puisse le réécrire.

**Alternative écartée : ajouter un champ aux entrées de `projects.json`.** Séduisant — un fichier de moins, et le registre est déjà la liste blanche. Écartée pour deux raisons. D'abord `registerProject`/`touchProject`/`unregisterProject` réécrivent le tableau entier à chaque ouverture de projet : faire porter une décision d'intégrité par un fichier réécrit à chaque clic mélange deux régimes d'écriture. Ensuite le crawler tourne en processus séparé, parfois depuis un hook git, et n'a rien à faire du registre — A1 ne le consulte pas et ne doit pas commencer à en dépendre.

Forme du fichier, plate et relisible à l'œil :

```json
{
  "version": 1,
  "amorce": "2026-08-29T10:00:00.000Z",
  "projets": {
    "/Users/sam/code/ovrsee": { "dev": "pnpm dev", "le": "2026-08-29T10:02:11.000Z" }
  }
}
```

### 2.2 Sur quoi porte l'empreinte

**La seule chaîne `dev`, et rien d'autre. Le `cwd` sert de clé, pas de contenu.**

- **Pas tout `ovrsee.config.json`.** `baseUrl`, `entryRoutes`, `maxPages`, `ignore`, `viewport` n'atteignent aucun shell. Redemander l'accord parce qu'on a ajouté une route d'entrée, c'est fabriquer une invite qui se déclenche pour rien — et une invite qui se déclenche pour rien s'acquitte sans lecture au bout de trois fois. On ne dépense la question de l'utilisateur que là où quelque chose s'exécute.
- **Le `cwd` compte, mais comme clé.** La commande tourne avec `cwd = root` : `pnpm dev` n'est pas la même chose dans deux dépôts. L'accord est donc indexé par chemin de projet, et le chemin est réinscrit *dans* l'enregistrement — un magasin recopié ou un projet déplacé se voit alors, au lieu de transporter silencieusement une approbation.
- **`auth.storageState` reste dehors.** C'est un chemin de fichier lu, pas exécuté, et il est déjà gardé par l'exigence `git check-ignore` (`crawl/index.js:75-84`, `crawl/auth.js:39-52`).
- **Aucune normalisation avant comparaison.** Ni `trim()`, ni collapse d'espaces, ni casse. On empreint l'octet exact qui part au shell. Normaliser ouvrirait l'écart classique : approuver une forme canonique et exécuter une forme brute qui s'y réduit. Un espace en trop redemandera l'accord — c'est rare, et c'est le bon côté sur lequel se tromper.

### 2.3 Quelle forme de hash

**Aucune. On stocke la chaîne en clair.**

Ce n'est pas un secret : elle est déjà dans un fichier versionné du dépôt. Un hash coûterait un import `node:crypto`, rendrait le fichier illisible pour un humain qui veut auditer ce qu'il a accordé, et empêcherait la seule chose qui rend l'invite utile — afficher **« vous aviez approuvé `pnpm dev`, la configuration dit maintenant `pnpm dev && curl … | sh` »**. La comparaison devient une égalité de chaînes, correcte par construction, sans question de collision ni d'encodage.

Si l'implémenteur tient malgré tout à hacher : **SHA-256, hexadécimal complet, sur les octets UTF-8, via `node:crypto`.** Et surtout **jamais tronqué** — une empreinte tronquée à 64 bits se fait collisionner en ~2³² essais, et l'attaquant choisit sa commande librement, ce qui est exactement le scénario favorable à une collision. Pas de `hashCode` maison, pas de MD5, pas de somme des octets.

### 2.4 Où se place la vérification

**Dans le crawler et dans `auth.js`, immédiatement avant `shellRun()`. C'est-à-dire aux deux sites d'exécution, jamais aux points d'entrée.**

Un module partagé, `crawl/confiance.js`, appelé par les deux :

```js
// crawl/index.js, dans run(), juste après loadConfig()
const config = loadConfig()
await assurerConfiance(root, config.dev)   // lève si refusé
```

Le `throw` remonte au `catch` existant (`crawl/index.js:499-512`), qui écrit le scan échoué et sort en code 0. Zéro nouveau chemin d'échec à câbler, et l'invariant « un scan échoué s'écrit » est respecté gratuitement. La garde tombe **avant** `assertPortFree()` et `startApp()` : aucun navigateur, aucun port, aucune trace.

**Pourquoi là et pas ailleurs :**

- Le contrôle est **derrière** les quatre points d'entrée. On ne peut pas l'oublier en ajoutant un cinquième appelant demain.
- Il est **dans le processus qui relit le disque**, donc c'est lui qui voit la valeur réellement exécutée — c'est ce qui referme la race 1 (§1.5).
- Il ne dépend d'aucun hôte : le hook git ne connaît ni Electron, ni le registre, ni le dev server.

### 2.5 Dans le processus principal ou dans le renderer ?

**Ni l'un ni l'autre pour la *vérification*, qui vit dans le crawler. Le processus principal pour la *question*. Jamais le renderer, pour rien.**

Le renderer est disqualifié sur trois motifs distincts, et un seul suffirait :

1. Il ne couvre qu'A2. A1 — le chemin automatique, celui qui n'a pas d'humain — ne passe par aucun renderer.
2. Il rend du contenu hostile : markdown de plans, titres de pages crawlées, tickets. Une injection y donne accès aux canaux IPC, et un contrôle situé dans le code qu'on vient de compromettre ne contrôle rien.
3. Une modale HTML dessinée par le renderer est usurpable par ce même contenu — position, superposition, faux bouton. Un accord doit être demandé par du chrome que la page ne peut pas peindre.

Côté processus principal, la règle **« le renderer n'envoie qu'un chemin de projet »** est maintenue mot pour mot. `crawl:start` reçoit un chemin, vérifie l'appartenance au registre comme aujourd'hui, **relit lui-même `ovrsee.config.json` sur le disque**, et affiche la commande qu'il vient de lire. Si le renderer pouvait proposer la chaîne à approuver, un renderer compromis approuverait ce qu'il veut ; le sujet serait entièrement contourné.

```js
ipcMain.handle('crawl:start', async (event, projectPath) => {
  if (!projetConnu(projectPath)) return { error: "ce dossier n'est pas dans la liste des projets de l'ovrsee" }
  const dev = devSurDisque(projectPath)          // relu ici, jamais reçu
  if (dev && !estApprouve(projectPath, dev)) {
    if (!(await demanderAccord(projectPath, dev))) return crawlState()
    approuver(projectPath, dev)
  }
  watchCrawl(event.sender)
  return startCrawl(projectPath)
})
```

L'accord donné, le crawler démarre et **revérifie de son côté**. La double vérification n'est pas une redondance étourdie : le processus principal la fait pour *poser la question au bon moment*, le crawler la fait parce que c'est lui qui exécute.

### 2.6 Comment se pose la question — et le cas non interactif

**La règle en une ligne : on demande là où un humain a écrit la commande, on refuse là où personne ne peut répondre.**

Le déplacement est là. Le réflexe est de demander au moment d'exécuter ; c'est ce qui produit un design où le chemin automatique se casse ou s'auto-approuve, les deux échecs que le ticket veut éviter. On accorde plutôt **à l'instant où un humain a tapé la commande lui-même**.

| Chemin | Comportement | Raison |
|---|---|---|
| **Formulaire d'équipement** (l'utilisateur tape `dev` et valide) | Accord enregistré immédiatement — **si et seulement si la configuration a réellement été écrite** | L'utilisateur vient de composer la commande. Une invite qui redemanderait à la seconde suivante ce qu'on vient de saisir est du bruit, et le bruit s'acquitte sans lire. |
| **A2 — clic « Crawler »** dans Electron | Modale native, une fois, puis mémorisée | Un humain est là. |
| **A3/A4/B1 — CLI en TTY** | Question `y/N` sur le terminal, défaut non | Un humain est là, `crawl/auth.js` a déjà `readline`. |
| **A1 — hook `post-commit`** | **Refus. Aucune invite. `recordScan({ok: false})`, sortie 0.** | Personne pour répondre. |

**Pourquoi ce refus ne casse pas le flux normal — le point sur lequel l'implémenteur doit être convaincu.** Sur un projet équipé par l'application, l'accord a été donné au formulaire d'équipement, avant qu'aucun commit n'existe. `post-commit` ne rencontre donc **jamais** de refus dans le cas nominal. Il n'en rencontre que dans trois situations, toutes légitimes :

1. un dépôt reçu avec sa propre configuration — le cas que le ticket vise, littéralement ;
2. un `dev` modifié depuis (édité à la main, arrivé par `pull`) — l'alerte qu'on veut ;
3. un dépôt équipé à la main, sans passer par le formulaire — friction connue, une invite, une fois.

Et le refus n'est pas silencieux : `scans.jsonl` reçoit un scan échoué, l'onglet Produit l'affiche déjà (`Illisibles.tsx`, `scanFailed`), et le prochain clic sur « Crawler » ouvre la modale qui débloque tout. **Un accord en attente est visible et se règle en un clic** — ce n'est pas un chemin mort.

Détection du non-interactif : **`process.stdin.isTTY`**. Sous `spawn`, la propriété vaut `undefined`, pas `false` — tester la valeur de vérité, jamais `=== false`. Ne pas se fier à `stdout.isTTY` : Electron le redirige en `pipe` (`electron/crawl.js:110`) alors même qu'un humain regarde l'écran, et le hook git l'ignore complètement.

Le message consigné dans `scans.jsonl` ne **répète pas la commande** : ce fichier est versionné et déjà relu avant push, la commande est de toute façon dans `ovrsee.config.json` deux dossiers plus haut, et une deuxième copie serait une deuxième vérité à tenir d'accord. Quelque chose comme : `commande dev non approuvée pour ce dépôt — ouvrez Ovrsee et lancez le crawl pour la relire`.

**Texte de la modale**, qui doit dire la vérité de §0 :

> **Exécuter la commande `dev` de ce dépôt ?**
> Ovrsee va lancer `pnpm dev` dans `/Users/sam/code/projet-recu`.
> **Cela exécute du code de ce dépôt** — la commande, les scripts qu'elle appelle et leurs dépendances. Ne l'autorisez que si vous faites confiance à la provenance de ce dépôt.
> `[ Annuler ]` `[ Exécuter ]` — défaut : Annuler.

Sur changement de commande, la modale montre les deux valeurs : approuvée / actuelle. C'est ce que le stockage en clair rend possible, et c'est la seule information réellement actionnable de tout l'écran.

### 2.7 La surface `/api/*`

**L'accord ne s'écrit jamais par `/api/*`.** Même exception, et même raison, que le terminal, le crawl et les jetons d'intégration : le dev server Vite sert ces routes en HTTP local non authentifié, où `X-Ovrsee` est un marqueur et pas une authentification. Une décision de confiance qui s'obtiendrait par un `POST` local n'est pas une décision de confiance.

Conséquence concrète sur le flux d'équipement : l'accord **n'est pas** enregistré dans `install()` (`hooks/install.js`), qui est atteignable depuis `/api/project` action `init`. Il est enregistré par un canal IPC dédié, appelé par le renderer *après* le retour de `init` :

```js
// preload.cjs — comme le reste de crawl:*, ne transporte qu'un chemin
approve: projectPath => ipcRenderer.invoke('crawl:approve', projectPath)
```

`crawl:approve` vérifie l'appartenance au registre, **relit `ovrsee.config.json` sur le disque** et approuve cette valeur-là. Ce que le formulaire a tapé n'est pas ce qu'on approuve — on approuve ce qui a atterri sur le disque. C'est précisément ce qui neutralise le piège d'équipement du §1.2 : si le dépôt avait déjà sa configuration, `install()` l'a conservée, et c'est la commande hostile que la relecture ramène. On approuve alors sciemment cette commande-là.

*(Variante défendable, si l'on veut que ce cas déclenche une modale plutôt qu'un accord tacite : faire comparer à `crawl:approve` la valeur sur disque à celle du formulaire, et n'accorder en silence que si elles sont identiques ; sinon, ouvrir la modale du §2.6. C'est cinq lignes de plus et ça ferme le piège complètement. Je le recommande.)*

En mode navigateur (`pnpm dev`), il n'y a pas d'IPC — donc aucun accord ne peut être donné. Ce n'est pas une régression : le crawl n'y est déjà pas lançable (`crawlDisponible()` est faux, l'onglet Produit propose de copier `pnpm ovrsee:crawl`), et cette commande, lancée dans un terminal, posera la question en TTY. Le mode navigateur reste ce qu'il doit être : un lecteur.

### 2.8 La rétro-compatibilité — et pourquoi le critère 4 est mal posé

**Le critère 4 du ticket est le plus faible des quatre, et je recommande de l'abandonner.**

« Un projet déjà crawlé n'a pas à réaccorder » suppose qu'on sache reconnaître « déjà crawlé » de façon fiable. Or la seule preuve disponible est `ovrsee/pages/scans.jsonl` — **un fichier versionné, donc fourni par le dépôt**. Un dépôt hostile qui embarque un `scans.jsonl` portant un `{"ok": true}` s'auto-classe « déjà crawlé » et traverse le contrôle. Bâtir une porte dérobée sur une entrée contrôlée par l'attaquant pour économiser un clic est un mauvais échange.

Ce que le critère achète : **un clic, une fois, par projet déjà enregistré.** L'utilisateur en a une poignée. Ce qu'il coûte : un chemin d'amorçage, sa logique de migration, ses tests, et un raisonnement de sécurité à tenir pour toujours.

**Recommandation : le remplacer par — « le premier crawl suivant la mise à jour demande l'accord, une fois par projet ».** Zéro ligne de migration, zéro entrée attaquante, et le message est juste : *on vient d'ajouter un contrôle de confiance, confirmez vos projets*. C'est exactement ce que VS Code a fait en introduisant Workspace Trust.

**Si le critère est maintenu**, voici l'amorçage à écrire, et ses bornes :

- Il tourne **une fois**, à la première lecture d'un `trust.json` absent, depuis `crawl/confiance.js` — donc quel que soit l'hôte, hook git compris. Pas d'étape d'installation à ne pas oublier.
- Il n'amorce qu'un projet réunissant **les deux** conditions : présent dans `~/.claude/ovrsee/projects.json` (fichier local, hors d'atteinte de l'attaquant) **et** portant un `scans.jsonl` avec au moins une entrée `ok: true`.
- Il enregistre le `dev` **courant** du projet.
- Il écrit toujours le fichier, même vide, avec son horodatage `amorce`. L'existence du fichier est le drapeau.

**Fenêtre de risque, énoncée franchement.** Un dépôt hostile est amorcé si, et seulement si, il était **déjà inscrit au registre local avant la mise à jour** et embarque un `scans.jsonl` truqué. Mais un dépôt inscrit avant la mise à jour est un dépôt qui pouvait déjà être crawlé sans aucun contrôle, sous le code actuel — l'amorçage n'élargit donc pas l'exposition, il renonce à la refermer rétroactivement. Un dépôt reçu **après** la mise à jour n'est jamais amorcé, `trust.json` existant désormais. **La fenêtre se ferme à la première exécution du nouveau code.**

Deux résidus à assumer :

- L'amorçage inscrit le `dev` courant, qui n'est pas forcément celui qui a réellement tourné lors du dernier scan réussi — `scans.jsonl` ne consigne pas la commande. Non réparable côté passé.
- Supprimer `trust.json` à la main relance l'amorçage sur le registre du moment. C'est une action locale de l'utilisateur sur son propre profil, même classe que l'éditer ; on ne s'en défend pas.

---

## 3. Plan d'implémentation

Six étapes, ordonnées pour qu'à la fin de l'étape 2 le système soit déjà fermé, les suivantes ne faisant que rendre le flux nominal agréable. Tests en `node:test` + `node:assert`, sans framework ; commentaires et documentation en français.

### Étape 1 — Le magasin de confiance

**Fichier neuf :** `crawl/confiance.js`.

```js
export const trustPath = ()                     // ~/.claude/ovrsee/trust.json, OVRSEE_TRUST pour les tests
export function cleProjet(root)                 // realpathSync.native(root) avec repli sur resolve(root)
export function lireConfiance()                 // {version, amorce, projets}, jamais d'exception
export function estApprouve(root, dev)          // égalité stricte de chaînes
export function approuver(root, dev)            // writeFileNoFollow + chmod 600
function amorcer()                              // migration une fois, si le critère 4 est conservé
```

Fichier absent, JSON cassé, forme inattendue → `estApprouve` rend **faux**. Un magasin abîmé redemande l'accord ; il ne l'accorde jamais.

**Test :** `crawl/confiance.test.js`, avec `OVRSEE_TRUST` et `OVRSEE_REGISTRY` sur des dossiers temporaires.
- projet inconnu → faux ;
- après `approuver`, la même chaîne → vrai ;
- la même chaîne à un espace près → **faux** (pas de normalisation) ;
- approbation du projet A → sans effet sur B ;
- fichier corrompu → faux ;
- amorçage : registre + `scans.jsonl` contenant `ok:true` → amorcé ; sans `scans.jsonl` → non amorcé ; `trust.json` déjà présent → aucun amorçage.

### Étape 2 — La garde aux deux sites d'exécution

**Fichiers touchés :** `crawl/index.js` (garde dans `run()`, après `loadConfig()`, avant `startApp()`), `crawl/auth.js` (avant `shellRun`, ligne 59), `crawl/confiance.js` (ajout d'`assurerConfiance(root, dev)` : approuvé → rend ; TTY → question `y/N`, défaut non, écrit l'accord si oui ; sinon → lève).

Le message d'erreur passe par le `catch` existant du `run()`. `auth.js` a déjà son `main().catch`.

**Tests :**
- `crawl/confiance.test.js` — fonction pure `decision({approuve, tty})` → `'lancer' | 'demander' | 'refuser'`. Table à quatre cas.
- **Le test qui prouve la porte** — dans `crawl/*.test.js`, monter un dépôt temporaire avec un `ovrsee.config.json` dont `dev` vaut `node -e "require('fs').writeFileSync('TEMOIN','1')"`, lancer `node crawl/index.js <tmp>` en enfant avec `stdio: 'ignore'` et un `OVRSEE_TRUST` vide, puis vérifier : **`TEMOIN` n'existe pas**, `ovrsee/pages/scans.jsonl` contient une entrée `ok:false`, code de sortie 0. Aucun navigateur n'est atteint, le refus tombe bien avant. C'est le seul test qui vérifie ce que le ticket demande vraiment.

### Étape 3 — La question dans Electron

**Fichiers touchés :** `electron/crawl.js` (`devSurDisque(projectPath)` et `accordRequis(projectPath)`, exportées et testables), `electron/main.js` (`crawl:start` devient `async` et ouvre `dialog.showMessageBox` sur la fenêtre appelante, `defaultId`/`cancelId` sur Annuler), `electron/preload.cjs` (rien à changer pour `start` — la signature reste « un chemin »).

**Test :** `electron/crawl.test.js` — `accordRequis()` sur des dossiers temporaires : configuration absente → pas d'accord requis (le crawl échouera pour une autre raison, déjà couverte) ; `dev` approuvé → faux ; `dev` différent de l'approuvé → vrai. `dialog` n'est pas testé — c'est de l'UI Electron, et la garde de l'étape 2 tient de toute façon.

### Étape 4 — L'accord au formulaire d'équipement

**Fichiers touchés :** `electron/main.js` (canal `crawl:approve` : registre → relecture disque → accord, avec la comparaison au formulaire recommandée en §2.7), `electron/preload.cjs` (`crawl.approve`), `app/src/EquipmentPanel.tsx` (après le `.then(result => setDone(...))` de `initialiser()`, appeler `ovrsee?.crawl?.approve?.(root)` — chaîné en optionnel, le mode navigateur n'a pas d'IPC).

**Test :** `hooks/install.test.js` — vérifier qu'`install()` **n'écrit pas** dans `OVRSEE_TRUST`. C'est la garantie que `/api/*` n'accorde rien.

### Étape 5 — Rien dans l'interface

Délibérément aucun écran neuf. Le refus s'affiche déjà : `scans.jsonl` porte l'échec, l'onglet Produit le rend. Le bouton « Lancer le crawl » existe et ouvre désormais la modale. Un panneau « approbations » serait une surface de plus à tenir pour une donnée que trois lignes de JSON exposent mieux.

Seul changement : le libellé du message d'échec, pour qu'il dise où cliquer.

### Étape 6 — La documentation

**Fichiers touchés :** `CLAUDE.md` (une entrée dans « Pièges connus » : où vit `trust.json`, pourquoi hors dépôt, ce que redéclenche un changement de `dev`, et le fait que le hook `post-commit` refuse au lieu de demander), `README.md` / `README.fr.md` si le crawl y est décrit, et `ovrsee/tickets/T-0190-*.md` à passer en colonne finale.

---

## 4. Les pièges

Par ordre décroissant de probabilité de s'y faire prendre.

1. **Approuver la chaîne envoyée par le renderer.** Le raccourci naturel est `crawl:approve(projectPath, dev)`. Il annule tout le ticket : un renderer compromis approuve ce qu'il veut. Le processus principal **relit toujours le disque**. La règle du cadrage — « la surface exposée ne reçoit qu'un chemin de projet » — s'applique ici mot pour mot.

2. **La clé de projet ne concorde pas entre les hôtes.** Electron approuve sous le chemin du registre ; `crawl/index.js` calcule `resolve(process.argv[2] ?? process.cwd())`, et depuis `post-commit` il n'y a **pas d'argv** — la clé vient du `cwd`. Sur macOS, `/tmp/x` et `/private/tmp/x` désignent le même dossier, un projet sous chemin symbolique aussi. Résultat : l'accord donné dans l'interface ne s'applique pas au hook, et le projet redemande éternellement. **Normaliser par la même fonction `cleProjet()` à l'écriture et à la lecture** (`realpathSync.native`, repli `resolve`), et le vérifier explicitement dans un test.

3. **Oublier `crawl/auth.js`.** Deuxième `shellRun`, dans un fichier qu'aucune interface n'appelle et qu'on ne relit donc jamais. Le ticket le nomme ; ce n'est pas une raison suffisante pour ne pas l'oublier. Une garde posée dans le seul `crawl/index.js` laisse `pnpm ovrsee:auth` exécuter la commande sans rien demander.

4. **Le piège d'équipement.** `writeOvrseeConfig()` **conserve** un `ovrsee.config.json` existant. Approuver la valeur du formulaire donne un accord sur une commande qui n'est pas celle qui s'exécutera — un contrôle qui approuve la mauvaise chaîne est pire que pas de contrôle, il rassure. Approuver ce qui est sur disque, ou demander.

5. **Se fier à `scans.jsonl` pour l'amorçage sans borner la fenêtre.** Ce fichier est versionné, donc fourni par l'attaquant. Il n'est acceptable qu'en conjonction avec l'appartenance au registre local **et** en une passe unique, marquée dans `trust.json`. Une règle qui réévaluerait « déjà crawlé » à chaque crawl serait un contournement offert à tout dépôt reçu. Le mieux reste de ne pas écrire ce code (§2.8).

6. **Oublier `OVRSEE_TRUST` dans les tests.** Toutes les suites tournent sur la vraie machine. Sans la variable, `pnpm test` **amorce le profil réel du développeur** et approuve silencieusement ses projets — un test qui casse l'outil qu'il vérifie. Même convention que `OVRSEE_REGISTRY`, `OVRSEE_SETTINGS` et `OVRSEE_INTEGRATIONS` : la reprendre, et vérifier après coup que `~/.claude/ovrsee/trust.json` n'a pas bougé.

7. **`process.stdin.isTTY` vaut `undefined`, pas `false`.** Tester la valeur de vérité. Et ne pas prendre `stdout.isTTY` à la place : Electron le redirige en `pipe` (`electron/crawl.js:110`), ce qui ferait croire à un contexte non interactif là où un humain regarde — et inversement.

8. **Normaliser avant de comparer.** `trim()`, écrasement des espaces, casse : chacun crée un écart entre ce qui est approuvé et ce qui s'exécute. La chaîne comparée doit être **celle qui part à `shellRun()`**.

9. **Faire échouer le crawl autrement qu'en scan écrit.** `electron/crawl.js` compte sur un code de sortie 0 et sur `scans.jsonl` pour l'affichage de l'échec — il ne rend jamais d'erreur par IPC, délibérément. Un `process.exit(1)` ou un refus muet crée une deuxième vérité et un état où l'interface ne montre rien.

10. **Placer la garde trop tard.** Après `assertPortFree()` ou dans `startApp()` : on parle au réseau, on démarre parfois des choses, on brouille le message d'échec. Après `loadConfig()`, avant tout le reste.

11. **Windows.** La CI exécute les tests sur macOS *et* Windows. Séparateurs de chemin dans les clés : comparer les chaînes telles quelles, sans passer en minuscules, sans réécrire les `\`. `realpathSync.native` s'y comporte différemment — le test de concordance de clé doit passer sur les trois plateformes ou être explicitement borné.

12. **Ajouter une dépendance.** Rien ici n'en demande une : `node:fs`, `node:os`, `node:path`, `node:readline` suffisent, `node:crypto` si l'on hache. Cinq dépendances en production, et ce ticket n'en justifie aucune sixième.

---

## 5. Ce que ce correctif ne fait pas

Dit franchement, pour que personne ne le lise comme une frontière alors que c'est un poste de garde :

- Il n'empêche pas une commande **approuvée** de faire n'importe quoi. Approuver `pnpm dev`, c'est approuver le script `dev` du `package.json`, ses dépendances et leurs scripts de cycle de vie. Le contrôle porte sur la **provenance du dépôt**, pas sur le contenu de la commande.
- Il ne détecte pas un changement de comportement à `dev` constant — le vecteur qu'un attaquant averti choisira, `package.json` étant tout aussi versionné et non empreint.
- Il ne protège pas contre un processus local qui écrirait directement dans `~/.claude/ovrsee/trust.json`. Ce processus tourne sous le même compte ; il a déjà gagné.

Ce qu'il ferme, en revanche, et c'est ce que le ticket demande : **« recevoir un dépôt et l'ouvrir dans Ovrsee » n'exécute plus rien.** L'invariant du cadrage redevient vrai — l'ovrsee lit, et il n'exécute que ce qu'on lui a demandé, une fois, explicitement.
