---
{
  "status": "open",
  "title": "Audit produit et UX d'Ovrsee — 10 oct. 2026",
  "opened": "2026-10-10",
  "closed": null,
  "commits": []
}
---

# Audit produit et UX d'Ovrsee — 10 oct. 2026

## Contexte

Sam a demandé un audit produit et UX complet : quoi améliorer, ajouter ou repenser, et quelles frictions corriger. Les sources sont trois agents d'exploration (produit, interface, flux), les 7 captures du README, et les données réelles de `ovrsee/pages/scans.jsonl`. L'application n'a pas été lancée.

Critère de succès fixé par le cadrage (`cadrage-ovrsee.md:193`) : en revenant sur un projet, Sam ouvre-t-il l'app spontanément, ou retourne-t-il au terminal par réflexe ? Chaque constat ci-dessous est jugé à cette aune.

---

## 1. Le constat principal : le cœur de la promesse rate une fois sur trois

`scans.jsonl` du dépôt ovrsee contient 200 scans, dont **69 en échec (35 %)** :
- **38 fois** : « `localhost:5180` répond déjà ». Le serveur de dev tournait déjà, ce qui est le cas normal quand on travaille.
- **29 fois** : « commande dev non approuvée ». Le crawl lancé au commit n'a pas d'humain pour approuver.
- 1 fois un délai dépassé, 1 fois une configuration absente.

L'onglet Produit, présenté comme « le seul actif propre du projet », est donc le moins fiable. Les deux causes sont des frictions de flux, pas des bugs.

## 2. Frictions à corriger (impact décroissant)

| # | Friction | Où | Correctif |
|---|---|---|---|
| F1 | Le crawl refuse si le port répond déjà (38 échecs) | `crawl/index.js:168` | Mode « réutiliser le serveur lancé » quand il est démarré par Ovrsee (pty `dev` connu) ou approuvé. Sinon, proposer « Réutiliser / Arrêter » au lieu d'échouer. |
| F2 | Crawl au commit refusé faute d'accord (29 échecs), échec visible seulement dans l'onglet Produit | `crawl/confiance.js:168`, `Produit.tsx:140` | Demander l'accord à l'équipement (déjà tenté par `approuverCrawl`, mais l'annulation est muette : `useCrawl.ts:46`). Remonter l'échec dans la barre d'état et dans le tray. |
| F3 | Une erreur secondaire efface toute l'interface, sans « Réessayer » | `App.tsx:67,672` (setError partagé : préférences, taille du terminal, accent) | Plein écran seulement pour l'échec du snapshot. Le reste va dans un bandeau fermable. |
| F4 | « Équipé » affiché alors que les hooks Claude ne sont pas posés (`~/.claude/settings.json` absent), ou que l'app a été déplacée (chemins absolus dans les hooks) | `install.js:72,225`, `snapshot.js:424` (`equipped = existsSync`) | Voir A1 (santé du câblage). |
| F5 | Fermer le plan reste manuel (`ovrsee:close`), et le bouton UI avale ses logs | `server/api.js:588` | Remonter les logs dans la réponse. Proposer « clore » quand tous les tickets du plan sont soldés (voir R2). |
| F6 | Chrome absent : erreur Playwright brute, aucun prérequis affiché | `crawl/index.js:546` | Détecter Chrome avant le lancement, avec un message dédié dans `ConfigCrawl`. |
| F7 | `crawl.start` qui échoue est ignoré | `useCrawl.ts:63` | Lire `{error}` et l'afficher. |
| F8 | Dialogues sans piège de focus ; Échap ferme plusieurs couches | `CommandPalette`, `TableauDetail:499`, `Lightbox:60`, `Preferences:600`, `Onboarding:403` | `<dialog>` + `showModal()` (T-0254 existe déjà). |
| F9 | Suppression de ticket définitive, enfouie en mode édition | `Tableau.tsx:188`, `TableauDetail.tsx:433` | Toast « Annuler » 5 s, ou colonne Archive. |
| F10 | Lignes de projet non activables au clavier | `Shell.tsx:593` | `<button>`. |
| F11 | Chaînes françaises en dur, fausses en anglais | `App.tsx:823`, `Shell.tsx:643`, `Illisibles.tsx`, `EquipmentPanel.tsx:37`, `Terminal.tsx:490`, `StatusBar.tsx`, `PreferencesProfils.tsx` | Passer par `t()`. Test qui échoue sur un accent hors du catalogue. |
| F12 | Fiche page de Produit : l'extrait est un vidage brut du texte du DOM (« Rechercher, aller à… ⌘K VUES 7 Aperçu 1… ») | `crawl/index.js:581` (`excerpt: entry.text`) | Prendre `<meta description>`, sinon le premier `h1` et le premier paragraphe. |
| F13 | Aucun indicateur « captures plus anciennes que le code » dans l'UI (le hook SessionStart le dit, l'app non) | `Shell.tsx:64` ScanBadge | Comparer `scan.commit` à HEAD et passer la pastille en avertissement. |
| F14 | Le badge de la palette affiche le total des tickets, le rail affiche les restants | `CommandPalette.tsx:94` | `restant(tickets, board)`. |

## 3. À repenser

- **R1. Aperçu : il raconte l'état du dépôt, pas le projet.** Les branches occupent la moitié de l'écran. « Dernière activité : aujourd'hui » répète la barre de titre. Sam revient pour savoir « où j'en étais » : le plan en cours ou le dernier clos, son intention, ses tickets ouverts et ce qui a changé visuellement depuis la dernière visite. Le brief `SessionStart` le produit déjà en texte (`hooks/brief`) : l'afficher en tête de l'Aperçu, et replier les branches.
- **R2. Le cycle de vie du plan.** Fermer un plan est la seule étape manuelle de la boucle quotidienne, et la plus oubliée (5 plans orphelins sur la PR #22, `ovrsee:close` dans le README). Proposer : un plan dont tous les tickets sont soldés se clôt au commit qui solde le dernier. Le signal existe déjà (`avancerTicketsDuPlan` renvoie `soldes`). C'est une décision de produit, puisque le CLAUDE.md voulait la clôture manuelle.
- **R3. Sept onglets, dont deux minces.**
  - **Données** sur ovrsee : 3 lignes « Data Model » sans colonnes.
  - **Stack** : 10 cartes sur 15 répètent « Aucune raison écrite. Un commentaire WHY… ».
  - **Proposition** : fusionner les deux en « Technique » (dépendances et tables). Remplacer les dix cartes vides par une ligne « 10 sans raison » repliée. Le cadrage excluait de toute façon la cartographie technique.
- **R4. Tableau : sept colonnes, dont trois toujours vides** (À spécifier, Prêt, Revue). Il faut un défilement horizontal. Le texte d'en-tête « Un fichier par ticket dans ovrsee/tickets/… » parle au développeur, pas à l'utilisateur. Proposer un défaut à 4 colonnes et masquer les colonnes vides.
- **R5. Le terminal occupe un tiers de chaque onglet par défaut**, y compris en lecture (Historique, Produit). Pour une app « qui lit », le replier par défaut et l'ouvrir à la demande (⌘J), en mémorisant le choix.
- **R6. Le récit du README est devenu faux.** « Ovrsee reads; it only runs a terminal if you ask » : il lance pourtant le serveur dev au commit. Le site annonce « six tabs » et `pnpm ovrsee:install`, alors que le DMG n'a pas pnpm. Réécrire la promesse en une phrase vraie.

## 4. À ajouter

- **A1. Panneau « Câblage ».** Une ligne verte ou rouge par élément, chacune avec un bouton de réparation :
  - `ovrsee/` ;
  - hooks git (présents, exécutables, binaire existant) ;
  - 12 hooks Claude ;
  - accord `dev` ;
  - Chrome ;
  - `claude` dans le PATH ;
  - MCP enregistré ;
  - jeton d'intégration déchiffrable.

  `install()` est idempotent : « Réinstaller » ne coûte qu'un bouton. C'est l'ajout qui corrige le plus de pannes silencieuses à la fois.
- **A2. Bouton « Brancher le MCP »** : copier la commande exacte avec les chemins du bundle, ou l'exécuter dans le terminal intégré. Aujourd'hui, l'UI ne mentionne jamais le MCP.
- **A3. « Enregistrer une session »** pour le crawl authentifié, proposé quand `pages.json` contient des `redirects` vers une page de login. Aujourd'hui, seul `pnpm ovrsee:auth` existe.
- **A4. « Depuis ta dernière visite »** : les pages dont la capture a changé, les plans clos et les tickets soldés depuis la dernière ouverture du projet. C'est la réponse la plus directe au critère de succès.
- **A5. Un composant `Notice` partagé** (`role=status` ou `alert`) à la place des trois notices locales de 2 s.

## 5. Hygiène produit et backlog

- **E-0218** (thème clair) et **E-0243** (audit 1.2.0) sont ouverts en priorité haute alors que leur travail est livré. À clore.
- **Le backlog ouvert est 100 % interne** (lint, tests, taille de fichiers). Aucun ticket ne porte sur la valeur de lecture. Les lots ci-dessous le rééquilibrent.
- **T-0192** (signature et notarisation macOS) : le premier lancement passe par un clic droit puis « Ouvrir ». C'est la première friction de tout nouvel utilisateur.
- **Échelle typographique** : 7 à 12,5 px en demi-pas, avec des tailles sous 10 px. Les jetons `--radius-*` et `--space-*` sont quasi inutilisés : 69 `border-radius: 6px` codés en dur, par exemple. C'est une passe de fond, pas prioritaire.

---

## Suite proposée, après validation

Créer les tickets via le skill `ovrsee-tickets`, en trois lots :

1. **Lot « fiabilité du crawl »** : F1, F2, F6, F7, F13. Cible : faire passer les échecs de 35 % à moins de 5 %.
2. **Lot « pannes silencieuses »** : A1, F3, F4, F5, A2.
3. **Lot « lecture d'abord »** : R1, A4, R5, F12. Décisions à prendre : R2, R3, R4.

Les points d'accessibilité et de langue (F8 à F11, F14) vont en tickets isolés, et rejoignent T-0254 et T-0255.

### Vérification, pour chaque ticket livré

- `pnpm test`, `pnpm typecheck` et `pnpm lint` au vert.
- `pnpm electron` pour toute interaction : `pnpm dev` n'a pas de terminal, et une route testée dans le navigateur ne vaut pas une route testée dans Electron.
- Pour le lot crawl : relancer un commit avec le serveur dev déjà lancé, et vérifier qu'une ligne `ok:true` s'ajoute à `scans.jsonl`.
