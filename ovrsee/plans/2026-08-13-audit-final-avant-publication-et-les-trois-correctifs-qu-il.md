---
{
  "status": "open",
  "title": "Audit final avant publication — et les trois correctifs qu'il justifie",
  "opened": "2026-08-13",
  "closed": null,
  "commits": [
    {
      "sha": "54911c7",
      "date": "2026-08-13",
      "files": [
        "SECURITY.md",
        "app/src/markdown.tsx",
        "app/src/tabs/Produit.tsx",
        "hooks/integrationProviders.js",
        "hooks/integrationProviders.test.js"
      ]
    },
    {
      "sha": "1df162f",
      "date": "2026-08-13",
      "files": []
    }
  ]
}
---

# Audit final avant publication — et les trois correctifs qu'il justifie

## Contexte

Le dépôt est prêt à devenir public : licence, CI sur mac et Windows, oxlint,
discours aligné, site vitrine porté. Restait à s'assurer que **le code lui-même**
tient — sécurité, qualité, ressources — avant que la release parte et que le
dépôt s'ouvre.

Trois audits ont tourné en parallèle : sécurité (surface Electron, IPC, chemins,
secrets, injection), sur-ingénierie (code mort, abstractions spéculatives,
duplication), et performance (poids, chargement, fuites, rendu).

**Le résultat est bon, et le plan est donc court.** Ce document existe surtout
pour consigner ce qui a été vérifié, et pour ne corriger que ce qui le mérite.

## Ce que l'audit a établi

### Sécurité — aucune faille critique ni élevée

Vérifié dans le code, pas seulement rapporté :

| Point | Constat |
|---|---|
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | `electron/main.js:167-169` |
| Webview durcie — preload supprimé, privilèges forcés | `electron/main.js:181-184` |
| CSP `default-src 'self'`, `script-src 'self'` | `electron/main.js:104-106` |
| Navigation hors `ovrsee://app` refusée | `electron/main.js:231` |
| Traversée de chemin — `inside()` avec séparateur final, liste blanche du registre à chaque route | `hooks/snapshot.js`, `server/api.js` |
| Terminal — `spawn(shell, ['-l'])`, jamais une commande construite | `electron/pty.js:116` |
| Secrets — `safeStorage`, déchiffrés dans le processus principal seul, jamais par `/api/*` | `electron/main.js:334-339` |
| Rendu markdown — aucun `dangerouslySetInnerHTML`, aucun `eval` | `app/src/markdown.tsx` |

### Qualité — rien à supprimer

L'audit de sur-ingénierie conclut lui-même que le gain maximal atteint **une
dizaine de lignes** et que le ratio n'en vaut pas la peine. Aucun code mort,
aucune réinvention de la bibliothèque standard, aucune abstraction spéculative,
aucune option de configuration morte. Les trois hôtes de `server/api.js` qui
partagent une seule `resolve()` sont un choix documenté, pas une duplication.

### Ressources — aucune fuite

Écouteurs, `ResizeObserver` et `MutationObserver` tous déconnectés ; sessions pty
fermées à l'arrêt ; aucun `setInterval` orphelin. Le pan/zoom du graphe passe par
une transformation CSS accélérée, sans recalcul par événement.

### Deux corrections au rapport de performance

L'agent annonçait « +5 à 10 s de démarrage sur réseau lent » à cause du bundle de
939 ko. **C'est faux ici** : l'application charge son bundle depuis le disque via
le protocole `ovrsee://` (`electron/main.js:237`), pas depuis le réseau. Le poids
coûte du temps d'analyse, pas du téléchargement — quelques dizaines de
millisecondes, pas des secondes.

Il citait aussi `tiny-async-pool` comme « déjà une dépendance ». Elle ne l'est
pas ; le projet en a quatre, et aucune ne s'appelle ainsi.

---

## Les trois correctifs retenus

### 1. Resserrer le contrôle d'hôte des intégrations

`hooks/integrationProviders.js:42` valide par `parsed.hostname.endsWith(host)`.
Or `'evilvercel.com'.endsWith('vercel.com')` est **vrai** : un domaine
sosie passe le contrôle.

**Ce n'est pas une SSRF** — l'URL sortante est en dur (`https://api.vercel.com/…`,
lignes 159, 192, 224), donc seul un identifiant de projet erroné partirait vers la
vraie API. L'impact est une recherche qui échoue, pas une fuite de jeton. Mais le
contrôle est faux, et le corriger tient en une ligne :

```js
if (parsed.hostname !== host && !parsed.hostname.endsWith('.' + host)) return null
```

Ajouter un test dans `hooks/integrations.test.js` (ou le fichier de test qui
couvre déjà `parseVercelProject`) : `https://evilvercel.com/x/y` doit rendre
`null`, `https://vercel.com/x/y` et `https://www.vercel.com/x/y` doivent passer.

### 2. Documenter la seule exécution de code du projet observé

`crawl/index.js:148` lance `spawn(config.dev, { shell: true })` — une commande
lue dans le `ovrsee.config.json` du **dépôt observé**. Le code porte déjà sa
justification en commentaire, et le geste est demandé par l'utilisateur
(`pnpm ovrsee:crawl`), donc l'invariant tient.

Mais `SECURITY.md`, que j'ai écrit plus tôt, ne le dit nulle part — il ne parle
du crawl que pour le contrôle de port et les cookies. Sur un dépôt public, où
quelqu'un peut inscrire un projet tiers à son registre et le crawler, c'est
l'omission qui compte le plus.

Ajouter une entrée à la liste « Ce que l'application fait, et ne fait pas » :
crawler un projet exécute la commande `dev` de son fichier de configuration, au
même titre qu'un script npm — n'inscrivez au registre que des dépôts auxquels
vous feriez confiance pour un `pnpm dev`.

### 3. Chargement paresseux des captures

`app/src` compte **14 balises `<img>` et aucun `loading="lazy"`**. Les captures
font environ 100 ko pièce, en 1280×800, affichées en vignettes d'à peu près
300×200 dans l'onglet Produit.

Ajouter `loading="lazy"` sur les `<img>` qui affichent une capture — pas sur
celles qui sont visibles d'emblée, où l'attribut retarderait l'affichage sans
rien gagner. Zéro risque, aucun changement d'architecture.

---

## Ce qui devient un ticket, et pas un correctif

À créer via le skill `ovrsee-tickets`, liés à ce plan :

| Sujet | Pourquoi différé |
|---|---|
| Terminal en `lazy()` + `Suspense` | xterm pèse 488 ko bruts, environ un tiers du bundle, pour une fonction souvent jamais ouverte. Gain réel mais modeste, et ça touche `App.tsx` la veille d'une release. |
| `graph.json` (687 ko) chargé à la demande | Aujourd'hui lu par `snapshot()` à chaque changement de projet, même si l'onglet Données n'est jamais ouvert. Correctif localisé mais réparti sur plusieurs fichiers. |
| Trois onglets au-dessus de 800 lignes | `Tableau.tsx` 1213, `Navigateur.tsx` 1006, `Produit.tsx` 899. Leur taille vient d'une cohésion réelle ; rien ne couvre leur interaction en test, donc un découpage se vérifierait à la main. |
| Captures en WebP, ou vignettes redimensionnées | 62 Mo de PNG sur le disque. Touche la chaîne de crawl et la lisibilité des captures, qui **sont** le produit. |

## Vérification

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` — les trois au vert.
2. Le nouveau test du contrôle d'hôte échoue avant le correctif, passe après.
   Le poser dans cet ordre, sinon il ne prouve rien.
3. Lancer l'application (`pnpm electron`), ouvrir l'onglet Produit et **vérifier
   que les vignettes s'affichent toujours** — `loading="lazy"` sur une image
   déjà dans le viewport ne doit rien retarder de visible.
4. Vérifier sur un export propre : `git archive HEAD` dans un dossier vierge,
   puis `pnpm install && pnpm test`.
5. CI verte sur les trois jobs.

## Écarté délibérément

| Écarté | Pourquoi |
|---|---|
| Découper le bundle par onglet | Le gain est du temps d'analyse, pas du téléchargement — l'app charge depuis le disque. Refonte du routage pour quelques dizaines de millisecondes. |
| Virtualiser le kanban et le graphe | 122 tickets et une cinquantaine de pages : trop peu pour que la virtualisation rapporte, et elle coûte en complexité. |
| Mettre `snapshot()` en cache | Aucune lenteur observée à l'usage ; un cache introduit une question d'invalidation là où il n'y a pas de problème. |
| Factoriser les cinq `if (!known())` de `server/api.js` | Cinq lignes gagnées contre une clause de garde qui se lit d'un coup d'œil. |
| Paralléliser le crawl | Le goulot est la latence réseau des pages observées, pas le crawler. |
| Ajouter un analyseur de bundle en dépendance | Le projet en a quatre et cette sobriété est un choix. |
