/**
 * Lecture d'un coffre Obsidian comme source de graphe.
 *
 * Le pendant en lecture de `obsidian.js`, et le seul : cet export-là traduit
 * `ovrsee/` en coffre, celui-ci lit un coffre que quelqu'un a écrit à la main.
 * Les deux ne se parlent pas et ne partagent rien — un coffre exporté ne porte
 * aucune note de table, le relire ne rendrait rien.
 *
 * La raison d'être : `graphify-out/graph.json` était la seule entrée de graphe
 * de l'ovrsee. Qui documente son projet dans Obsidian plutôt qu'avec Graphify
 * n'avait rien à afficher dans l'onglet Données.
 *
 * **La convention, et elle est étroite** : une note dont le frontmatter porte
 * `type: table` est une table. Rien d'autre n'en est une. Les notes qui la
 * wikilinkent en sont les usages. C'est la même discipline que `whys.js` —
 * une marque explicite, pas une devinette sur le contenu.
 *
 * Le graphe rendu emprunte le vocabulaire de Graphify (`nodes` / `links`,
 * `file_type`, `confidence`) parce que l'interface le lit déjà. `file_type:
 * 'table'` n'est pas décoratif : c'est ce qui fait passer le nœud par le filtre
 * `isSchemaNode` de `app/src/data.ts`, et donc ce qui évite de dédoubler la
 * lecture du graphe côté interface.
 *
 * ponytail: parseur YAML maison plutôt qu'une dépendance. `plans.js` explique
 * pourquoi le frontmatter de l'ovrsee est du JSON — un mini-parseur YAML échoue
 * en silence. Ici on n'a pas le choix : le coffre est écrit par quelqu'un
 * d'autre, dans les conventions d'Obsidian. On borne donc le sous-ensemble
 * reconnu et on le documente, plutôt que de prétendre lire du YAML.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, sep } from 'node:path'

/** Dossiers d'un coffre qu'on ne parcourt jamais. */
const IGNORES = new Set(['.obsidian', '.trash', '.git', 'node_modules'])

/** Au-delà, ce n'est plus une note : c'est un export collé dans le coffre. */
const MAX_BYTES = 512 * 1024

/** Garde-fou : un coffre de dix mille notes ne doit pas bloquer l'ouverture. */
export const MAX_FILES = 4000

const FENCE = '---'

/** Ce qui marque une note comme table. */
const TYPE_TABLE = 'table'

/**
 * Un scalaire YAML du sous-ensemble reconnu.
 *
 * Les guillemets sont retirés s'ils entourent toute la valeur — c'est le seul
 * cas où l'on sait qu'ils délimitent plutôt qu'ils n'appartiennent au texte.
 * L'échappement interne n'est pas déroulé : une note qui a besoin de `\"` a
 * dépassé ce que ce parseur prétend lire.
 */
function scalar(raw) {
  const value = raw.trim()
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }
  return value
}

/** `[a, b]` → `['a', 'b']`. Une liste inline ne contient que des scalaires. */
const inlineList = value =>
  value
    .slice(1, -1)
    .split(',')
    .map(scalar)
    .filter(item => item.length > 0)

/**
 * Frontmatter YAML, sous-ensemble strict.
 *
 * Reconnu : `clé: valeur` (scalaire nu ou cité), `clé: [a, b]` (liste inline),
 * et la liste en bloc :
 *
 * ```yaml
 * columns:
 *   - id
 *   - total
 * ```
 *
 * Hors périmètre, et volontairement : imbrication, chaînes multilignes (`|`,
 * `>`), ancres et alias, dates typées, `? :` explicite. Une clé dont la valeur
 * n'entre pas dans ce sous-ensemble est ignorée — elle n'apparaît pas dans
 * l'objet rendu. Mieux vaut une clé absente qu'une clé mal lue.
 *
 * @param {string} text contenu entre les deux `---`
 * @returns {Record<string, string | string[]> | null} null si rien n'est lisible
 */
export function parseYaml(text) {
  if (typeof text !== 'string') return null

  const lignes = text.split('\n')
  /** @type {Record<string, string | string[]>} */
  const out = {}

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i]
    if (ligne.trim() === '' || ligne.trimStart().startsWith('#')) continue
    // Une ligne indentée appartient à la clé précédente : soit elle a déjà été
    // consommée par la liste en bloc ci-dessous, soit c'est de l'imbrication,
    // qu'on ne lit pas.
    if (/^\s/.test(ligne)) continue

    const coupe = ligne.indexOf(':')
    if (coupe === -1) continue

    const key = ligne.slice(0, coupe).trim()
    if (key.length === 0) continue

    const rest = ligne.slice(coupe + 1).trim()

    if (rest.startsWith('[') && rest.endsWith(']')) {
      out[key] = inlineList(rest)
      continue
    }

    if (rest.length > 0) {
      out[key] = scalar(rest)
      continue
    }

    // Valeur vide : une liste en bloc peut suivre. On regarde les lignes
    // indentées qui commencent par un tiret, et on s'arrête à la première qui
    // ne l'est pas — c'est la clé suivante.
    const items = []
    let j = i + 1
    for (; j < lignes.length; j += 1) {
      const suite = lignes[j]
      if (suite.trim() === '') continue
      const puce = suite.match(/^\s+-\s+(.*)$/)
      if (!puce) break
      const item = scalar(puce[1])
      if (item.length > 0) items.push(item)
    }

    if (items.length > 0) {
      out[key] = items
      i = j - 1
      continue
    }

    out[key] = ''
  }

  return Object.keys(out).length > 0 ? out : null
}

/**
 * Le frontmatter d'une note, ou null.
 *
 * Même découpage que `parsePlan` dans `plans.js` : `---` en première ligne,
 * `---` de clôture. Seul le parse du bloc diffère.
 *
 * @param {string} src contenu brut du fichier
 * @returns {Record<string, string | string[]> | null}
 */
export function frontmatterOf(src) {
  if (typeof src !== 'string' || !src.startsWith(FENCE + '\n')) return null

  const end = src.indexOf('\n' + FENCE, FENCE.length)
  if (end === -1) return null

  return parseYaml(src.slice(FENCE.length + 1, end))
}

/** `[[...]]`, avec ou sans libellé, avec ou sans ancre. */
const WIKILINK = /\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g

/** Les blocs de code, qui citent des crochets sans les vouloir comme liens. */
const CODE = /```[\s\S]*?```|`[^`\n]*`/g

/**
 * Les notes citées par un markdown, sans doublon, dans l'ordre d'apparition.
 *
 * `[[note]]`, `[[note|libellé]]`, `[[note#section]]` rendent tous `note` :
 * l'ancre désigne un endroit dans la note, pas une autre note. Les blocs de
 * code sont retirés d'abord — un exemple de syntaxe n'est pas un lien.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function wikilinks(markdown) {
  if (typeof markdown !== 'string') return []

  const texte = markdown.replace(CODE, '')
  const out = new Set()

  for (const match of texte.matchAll(WIKILINK)) {
    const cible = match[1].trim()
    if (cible.length > 0) out.add(cible)
  }

  return [...out]
}

/**
 * La date de mise à jour déclarée par une note, ou null.
 *
 * Trois clés acceptées parce que trois conventions coexistent dans les coffres
 * réels. Aucune n'est imposée : une table non datée s'affiche « non daté »,
 * ce qui est une information — pas un défaut de lecture.
 */
const dateOf = front => {
  const brut = front.maj ?? front.updated ?? front.date
  return typeof brut === 'string' && brut.trim().length > 0 ? brut.trim() : null
}

/** `tables/commandes.md` → `tables/commandes`, en séparateurs Obsidian. */
const noteId = (root, file) =>
  relative(root, file).split(sep).join('/').replace(/\.md$/, '')

/**
 * Les notes d'un coffre : chemin relatif → { frontmatter, liens, fichier }.
 *
 * Parcours borné, sur le gabarit de `readWhys` : dossiers triés pour que deux
 * lectures rendent le même graphe, `withFileTypes` pour qu'un lien symbolique
 * ne soit ni parcouru ni lu — il n'est ni dossier ni fichier ordinaire.
 */
function notes(root) {
  /** @type {Map<string, {front: Record<string, string|string[]>|null, liens: string[], file: string}>} */
  const out = new Map()
  let restant = MAX_FILES

  const parcourir = dir => {
    if (restant <= 0) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    } catch {
      return
    }

    for (const entry of entries) {
      if (restant <= 0) return
      if (entry.name.startsWith('.') || IGNORES.has(entry.name)) continue

      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        parcourir(full)
        continue
      }
      if (!entry.isFile() || extname(entry.name) !== '.md') continue

      try {
        if (statSync(full).size > MAX_BYTES) continue
        restant -= 1
        const src = readFileSync(full, 'utf8')
        out.set(noteId(root, full), {
          front: frontmatterOf(src),
          liens: wikilinks(src),
          file: full,
        })
      } catch {
        // Une note illisible n'est pas une raison de perdre le reste du coffre.
      }
    }
  }

  parcourir(root)
  return out
}

/**
 * Résout la cible d'un wikilink en identifiant de note.
 *
 * Obsidian accepte le chemin complet (`tables/commandes`) comme le nom court
 * (`commandes`) tant qu'il est unique dans le coffre. On accepte les deux, le
 * chemin complet d'abord. Un nom court ambigu n'est résolu vers rien : deviner
 * laquelle des deux notes était visée produirait un lien faux.
 */
function resoudre(cible, ids, parNom) {
  if (ids.has(cible)) return cible
  const candidats = parNom.get(basename(cible)) ?? []
  return candidats.length === 1 ? candidats[0] : null
}

/**
 * Le coffre en graphe, au vocabulaire de Graphify.
 *
 * Toutes les notes deviennent des nœuds — pas seulement les tables. L'onglet
 * Données affiche « utilisée par » en retrouvant le `label` du nœud source de
 * chaque lien entrant : sans les notes citantes, la colonne serait vide.
 *
 * Les liens ne portent **pas** de `confidence`. EXTRACTED / INFERRED / AMBIGUOUS
 * est le vocabulaire de Graphify pour dire ce que son parseur a tiré du code ;
 * un wikilink écrit à la main n'est aucun des trois, et lui emprunter son
 * étiquette la plus sûre reviendrait à créditer une déclaration d'une autorité
 * qu'elle n'a pas. Ce que porte une table du coffre, c'est `declared` : la date
 * que son auteur y a mise, ou null. Le cadrage tolère la donnée manuscrite à
 * cette condition — « une image marquée il y a trois semaines est honnête » (§5).
 *
 * @param {string} vaultRoot chemin absolu du coffre
 * @returns {{nodes: object[], links: object[]} | null} null si le coffre est
 *   illisible ou ne contient aucune note.
 */
export function readVault(vaultRoot) {
  if (typeof vaultRoot !== 'string' || vaultRoot.length === 0) return null

  try {
    if (!statSync(vaultRoot).isDirectory()) return null
  } catch {
    return null
  }

  const trouvees = notes(vaultRoot)
  if (trouvees.size === 0) return null

  /** Nom court → identifiants, pour résoudre les wikilinks abrégés. */
  const parNom = new Map()
  for (const id of trouvees.keys()) {
    const nom = basename(id)
    parNom.set(nom, [...(parNom.get(nom) ?? []), id])
  }

  const nodes = []
  const tables = new Set()

  for (const [id, note] of trouvees) {
    const front = note.front ?? {}
    const estTable = String(front.type ?? '').toLowerCase() === TYPE_TABLE
    if (estTable) tables.add(id)

    const titre = front.titre ?? front.title
    const colonnes = Array.isArray(front.columns) ? front.columns.join(', ') : front.columns

    nodes.push({
      id,
      label: typeof titre === 'string' && titre.length > 0 ? titre : basename(id),
      // Ce qui fait passer le nœud par `isSchemaNode` côté interface. Une note
      // ordinaire n'en est pas une : elle n'existe que pour porter un `label`.
      file_type: estTable ? TYPE_TABLE : 'note',
      source_file: note.file,
      source_location: 'L1',
      // Toujours posé sur une table du coffre, même à null, et jamais par
      // Graphify : c'est à cette présence que l'interface reconnaît une ligne
      // déclarée d'une ligne dérivée du code, sans avoir à la deviner.
      ...(estTable ? { declared: dateOf(front) } : {}),
      ...(estTable && colonnes ? { columns: colonnes } : {}),
    })
  }

  const links = []
  for (const [id, note] of trouvees) {
    for (const cible of note.liens) {
      const target = resoudre(cible, trouvees, parNom)
      // Seuls les liens vers une table sont retenus : c'est tout ce que le
      // consommateur lit, et garder les autres alourdirait le snapshot d'un
      // graphe de notes que personne n'affiche.
      if (!target || target === id || !tables.has(target)) continue
      links.push({ source: id, target, relation: 'mentions' })
    }
  }

  return { nodes, links }
}
