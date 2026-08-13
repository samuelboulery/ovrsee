---
{
  "id": "T-0129",
  "titre": "Re-taguer et publier la 1.0.0-beta",
  "colonne": "pret",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0123",
  "tags": [
    "release"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Le tag `v1.0.0-beta` pointe sur un dépôt qui n'a encore ni licence ni CI. Sur un
dépôt public où les gens téléchargent depuis ce tag, l'absence de `LICENSE` se
voit.

Le brouillon de release porte des notes écrites à la main : le job `draft` le
retrouve par son tag et n'en crée pas un second, donc elles survivent au re-tag.

## Critères d'acceptation

- [ ] Le tag `v1.0.0-beta` pointe sur un `main` qui contient licence, CI et
      discours aligné.
- [ ] Une seule release, avec ses six assets et les notes écrites intactes.
- [ ] La release n'est plus en brouillon.
