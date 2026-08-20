---
{
  "status": "open",
  "title": "Corriger les trois issues ouvertes",
  "opened": "2026-08-20",
  "closed": null,
  "commits": [
    {
      "sha": "b419536",
      "date": "2026-08-20",
      "files": [
        "CLAUDE.md",
        "crawl/config.test.js",
        "crawl/index.js",
        "crawl/redaction.test.js",
        "hooks/i18n.js",
        "hooks/i18n.test.js",
        "hooks/ovrsee-cli.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/reconcile.js",
        "hooks/reconcile.test.js"
      ]
    }
  ]
}
---

# Corriger les trois issues ouvertes

## Contexte

Trois issues déposées par l'équipe d'audit automatique restent ouvertes sur le
dépôt. Vérification faite dans le code : les trois pointent un vrai défaut, mais
la gravité annoncée n'est exacte que pour deux d'entre elles.

| Issue | Constat vérifié | Verdict |
|---|---|---|
| [#26](https://github.com/…/issues/26) | `trace` — 2 ko bruts de stdout/stderr de la commande `dev` — part sans rédaction dans `ovrsee/pages/scans.jsonl`, fichier **tracké par git** (`git ls-files` le confirme) | Réel. Un `dev` qui meurt sur une variable d'env manquante peut imprimer sa valeur, et elle est committée sans relecture. |
| [#23](https://github.com/…/issues/23) | `terminal.rename_aria` écrit `{label}` là où `t()` ne substitue que `${…}` (`hooks/i18n.js:661` et `:1433`) | Réel. Ce sont les **seules** deux clés du dictionnaire dans ce cas — vérifié par grep sur les 1600 lignes. |
| [#29](https://github.com/…/issues/29) | `reconcile()` avance des tickets d'après le texte d'un message de commit venu d'un remote | Surestimé. `avancerTicketsDuPlan` ne touche que les tickets **déjà en `en-cours`** et **liés à un plan ouvert local**. Un message hostile ne fabrique rien et ne solde rien du backlog ; au pire il solde en avance un ticket qu'on a soi-même commencé. Risque d'état faux, pas trou de sécurité. |

Décision prise pour #29 : garder le comportement — c'est la raison d'être de
T-0186 — et rendre la limite **visible** plutôt que muette, la ligne de conduite
que le dépôt applique déjà à `signalInstalle` et aux avertissements de `planFrom`.

## 1. Rédiger les traces avant de les committer (#26, priorité haute)

`crawl/index.js` — un seul point d'écriture, `recordScan()` (l. 99). Y placer la
rédaction plutôt que sur la variable `trace` : tout chemin d'échec présent ou
futur y passe.

- Ajouter une fonction exportée `redige(texte)` dans `crawl/index.js`, à côté de
  `DERNIERS_OCTETS` (l. 152). Motifs remplacés par `***` :
  - `NOM=valeur` / `NOM: valeur` où `NOM` contient `KEY`, `TOKEN`, `SECRET`,
    `PASSWORD`, `PASSWD`, `PWD`, `AUTH`, `CREDENTIAL` (insensible à la casse) ;
  - jetons à préfixe connu : `sk-…`, `gh[pousr]_…`, JWT `eyJ…\.…\.…` ;
  - `scheme://user:motdepasse@hôte` → le seul mot de passe est masqué, l'hôte
    reste lisible (c'est lui qui sert au diagnostic).
- Dans `recordScan()`, appliquer `redige()` à `entry.error` avant l'écriture.
- Test : `crawl/redaction.test.js`, dans le style de `crawl/retention.test.js`
  (`node:test` + `node:assert`, import depuis `./index.js`). Un cas par motif,
  plus un cas négatif — `pnpm: command not found` doit ressortir **intact**,
  puisque c'est l'échec le plus fréquent et la raison d'être de cette trace.

La rédaction est une défense en profondeur, pas une garantie : elle attrape les
formes connues. Le dire dans le commentaire de `redige()`.

## 2. Interpoler l'aria-label de renommage (#23, priorité moyenne)

- `hooks/i18n.js:661` et `:1433` — `{label}` → `${label}`.
- `hooks/i18n.test.js` — ajouter un quatrième test dans la veine des trois
  existants, qui sont déjà des invariants sur le dictionnaire entier :
  *« aucune traduction ne porte de paramètre non interpolable »*. Balayer
  `translations.fr` et `translations.en`, échouer sur toute valeur contenant
  `{mot}` non précédé de `$`. Couvre toutes les clés futures d'un coup — plus
  utile que d'énumérer les clés à paramètres comme le suggère l'issue.

Rien à toucher dans `Terminal.tsx` (l. 486) : l'appel est correct.

## 3. Rendre visible ce que le post-merge solde (#29, priorité moyenne)

- `hooks/ovrsee-post-commit.js` — `avancerTicketsDuPlan()` (l. 156) retourne
  aujourd'hui `undefined`. Lui faire retourner les identifiants des tickets
  déplacés. Ses deux appelants ignorent la valeur : changement non cassant.
- `hooks/reconcile.js` (l. ~145) — utiliser ce retour dans la ligne `dire()` :
  `[ovrsee] a1b2c3d rattaché à plan-x.md, T-0042 soldé`. L'utilisateur voit au
  `git pull` ce qui a bougé, au lieu de le découvrir dans le tableau.
- `hooks/reconcile.test.js` — un test : un commit qui cite un ticket en vol le
  fait apparaître dans la trace rendue à `dire`.
- `CLAUDE.md`, section « Pièges connus » — deux entrées :
  - le post-merge fait confiance au texte des messages venus du remote pour
    solder un ticket **déjà en cours** ; ce qui est soldé est écrit sur stderr
    au `pull` ; le corriger se fait d'un `moveTicket` en arrière ;
  - la trace de la commande `dev` jointe à un scan échoué est rédigée mais pas
    garantie propre : relire un `scans.jsonl` en échec avant de le pousser.

## Ce qui est écarté

- **Vérifier `git show --name-only` contre les fichiers du plan** (#29) :
  `reconcile` inscrit délibérément `files: []` parce qu'un squash porte les
  fichiers de toute une branche. L'heuristique serait faible et le code lourd.
- **Sortir `scans.jsonl` du suivi git** (#26) : il *est* la vérité versionnée
  que décrit le cadrage. Rédiger à l'écriture, pas dé-versionner.

## Vérification

```bash
pnpm test          # node:test, aucun framework — les 3 nouveaux tests inclus
pnpm lint && pnpm typecheck
```

Puis, à la main :

1. **#26** — dans un projet observé, mettre une commande `dev` bidon qui fait
   `echo "OPENAI_API_KEY=sk-abc123secret" && exit 1`, lancer `pnpm ovrsee:crawl`,
   vérifier que `ovrsee/pages/scans.jsonl` porte `OPENAI_API_KEY=***` et que
   l'onglet Produit affiche la ligne rédigée.
2. **#23** — `pnpm electron`, onglet Terminal, double-clic sur un onglet de
   session : l'aria-label du champ doit citer le nom réel de la session
   (inspecteur ou VoiceOver), pas `{label}`.
3. **#29** — sur une branche de test, un commit citant un ticket en cours,
   `git merge` : stderr doit nommer le plan **et** le ticket soldé.

Fermer les trois issues avec `gh issue close 23 26 29` une fois la PR fusionnée.
