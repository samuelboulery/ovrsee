<p align="center">
  <a href="./SECURITY.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./SECURITY.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Sécurité

## Signaler une vulnérabilité

**Ne l'ouvrez pas en issue publique.** Utilisez
[Security Advisories](https://github.com/samuelboulery/ovrsee/security/advisories/new) :
le signalement reste privé jusqu'à ce qu'un correctif existe.

Comptez quelques jours pour une première réponse. Ce projet est maintenu par une
seule personne, sur son temps — c'est un délai réaliste, pas un engagement
contractuel.

## Versions suivies

Seule la dernière version publiée reçoit des correctifs. Il n'y a pas de branche
de maintenance.

## Ce que l'application fait, et ne fait pas

L'invariant du projet borne la surface d'attaque, et il vaut d'être connu avant
de chercher une faille :

> **L'ovrsee lit ; il n'exécute que le terminal qu'on lui demande.**

Concrètement :

- **Le serveur MCP n'exécute aucun code** du projet observé. Il lit tout
  `<repo>/ovrsee/` et n'écrit que `ovrsee/tickets/*.md` et `ovrsee/board.json`.
- **Seuls les projets du registre sont lisibles.** Un chemin absent du registre
  est refusé, même s'il existe sur le disque. Cette liste blanche est la
  frontière : un contournement en est une vulnérabilité.
- **Le terminal passe par IPC Electron, jamais par une socket locale.** Une
  socket l'ouvrirait à tout processus tournant sous le même compte — c'est un
  arbitrage explicite du cadrage, pas un oubli.
- **Le crawl ne démarre pas si `baseUrl` répond déjà.** Rien dans une réponse
  HTTP ne distingue son propre serveur de celui d'un autre projet.
- **Le crawl est la seule exception à ce qui précède, et elle est voulue.**
  `pnpm ovrsee:crawl` lance la commande `dev` écrite dans le `ovrsee.config.json`
  du projet observé — il faut bien démarrer l'application pour la photographier.
  C'est du code venant du dépôt observé, exécuté sur votre machine, au même titre
  qu'un `pnpm dev` ou qu'un script d'installation npm. **N'inscrivez au registre
  que des dépôts auxquels vous confieriez déjà un `pnpm dev`.** Le reste de
  l'application n'exécute jamais rien du projet observé.

## Secrets

Aucun secret ne vit dans le dépôt observé. Les jetons d'intégration
(Vercel, Netlify, Supabase) sont stockés dans
`~/.claude/ovrsee/integrations.json`, **hors du dépôt**, chiffrés par
`safeStorage`. Leur écriture, leur déchiffrement et l'appel réseau au
fournisseur passent par IPC Electron et jamais par `/api/*` — cette route est
aussi servie par le dev server Vite, en HTTP local non authentifié.

Les cookies de session du crawl (`.ovrsee-auth.json`) sont ignorés par git.

Un secret collé dans un plan approuvé, en revanche, part dans git en clair : la
parade est en amont, ne pas en coller.

## Binaires non signés

Les DMG et installeurs publiés ne sont **ni signés ni notariés**. macOS et
Windows vous en avertiront au premier lancement. Si cela vous gêne, construisez
depuis les sources : `pnpm install && pnpm package:mac` (ou `package:win`).

Vérifiez que le fichier téléchargé correspond bien à l'empreinte publiée sur la
page de la release.

## Dépendances

Le projet compte quatre dépendances de production — `@phosphor-icons/react`,
`@xterm/xterm`, `@xterm/addon-fit` et `node-pty` — et cette sobriété est un
choix de sécurité autant que de maintenance.

Deux défenses sont en place contre les publications empoisonnées : pnpm bloque
par défaut les scripts d'installation des dépendances (`onlyBuiltDependencies`
n'autorise que `node-pty`, qui doit compiler), et `.npmrc` impose une
quarantaine de 24 h sur les versions fraîchement publiées.
