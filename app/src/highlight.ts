/**
 * Coloration des blocs de code, en jetons.
 *
 * Pourquoi pas Shiki ou highlight.js : le projet a trois dépendances de
 * production et cette sobriété est un choix. Le code qu'affiche l'ovrsee
 * vient de README et de plans — des extraits de quelques lignes, pas des
 * fichiers entiers. Un tokeniseur par expressions régulières les rend lisibles ;
 * plusieurs mégaoctets de grammaires les rendraient exacts, ce dont personne
 * n'a besoin ici.
 *
 * ponytail: un tokeniseur, pas un parseur. Il se trompe sur les cas tordus —
 * une regex littérale JS prise pour une division, un mot-clé cité dans une
 * chaîne de gabarit. Le plafond accepté est celui-ci : les couleurs peuvent
 * mentir, le texte jamais. La concaténation des jetons rend toujours exactement
 * le code d'entrée, et c'est ce que vérifie le test.
 *
 * Un langage inconnu — ou absent — rend un seul jeton brut. C'est le même
 * principe que `markdown.tsx` : ce qui n'est pas reconnu s'affiche tel quel,
 * jamais avalé.
 */

export type Kind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'call' | 'flag'

export interface Token {
  text: string
  kind: Kind
}

interface Lang {
  /** Marqueur de commentaire jusqu'à la fin de ligne. */
  line?: string
  /** Commentaire encadré, ouvrant et fermant. */
  block?: [string, string]
  /** Guillemets ouvrant une chaîne. */
  quotes: string
  keywords: string[]
  /** Un mot suivi de `:` est une clé — vrai pour CSS et YAML, faux ailleurs. */
  propColon?: boolean
}

const JS_KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'import',
  'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally',
  'throw', 'typeof', 'instanceof', 'of', 'in', 'this', 'null', 'undefined',
  'true', 'false', 'void', 'delete', 'yield', 'static', 'interface', 'type',
  'enum', 'implements', 'public', 'private', 'readonly', 'as', 'satisfies',
]

// Des commandes, pas des mots-clés : dans un README, la première chose écrite
// sur une ligne de shell est ce qu'on lance. Les colorer est ce qui rend le
// bloc lisible d'un coup d'œil — `if`/`then` n'y sont presque jamais.
const SH_KEYWORDS = [
  'cd', 'echo', 'export', 'pnpm', 'npm', 'npx', 'yarn', 'node', 'git', 'curl',
  'wget', 'mkdir', 'rm', 'cp', 'mv', 'ls', 'cat', 'sudo', 'brew', 'python',
  'python3', 'pip', 'make', 'docker', 'source', 'set', 'if', 'then', 'fi',
  'for', 'do', 'done', 'else', 'elif', 'while', 'case', 'esac', 'function',
]

const PY_KEYWORDS = [
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import',
  'from', 'as', 'with', 'try', 'except', 'finally', 'raise', 'lambda', 'None',
  'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass', 'yield', 'async',
  'await', 'self', 'global', 'assert', 'del',
]

const LANGS: Record<string, Lang> = {
  js: { line: '//', block: ['/*', '*/'], quotes: `'"\``, keywords: JS_KEYWORDS },
  json: { quotes: '"', keywords: ['true', 'false', 'null'] },
  sh: { line: '#', quotes: `'"`, keywords: SH_KEYWORDS },
  py: { line: '#', quotes: `'"`, keywords: PY_KEYWORDS },
  css: { block: ['/*', '*/'], quotes: `'"`, keywords: [], propColon: true },
  yaml: { line: '#', quotes: `'"`, keywords: ['true', 'false', 'null', 'yes', 'no'], propColon: true },
}

/** Ce qu'écrivent vraiment les gens après les trois accents graves. */
const ALIAS: Record<string, string> = {
  js: 'js', jsx: 'js', javascript: 'js', mjs: 'js', cjs: 'js',
  ts: 'js', tsx: 'js', typescript: 'js',
  json: 'json', jsonc: 'json',
  sh: 'sh', bash: 'sh', zsh: 'sh', shell: 'sh', console: 'sh', terminal: 'sh',
  py: 'py', python: 'py',
  css: 'css', scss: 'css', less: 'css',
  yaml: 'yaml', yml: 'yaml',
}

const esc = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Rule {
  kind: Kind
  re: RegExp
}

/**
 * Les règles d'un langage, dans l'ordre où elles s'appliquent.
 *
 * L'ordre est la seule chose qui compte ici : un `#` dans une chaîne n'ouvre
 * pas un commentaire, mais un `"` dans un commentaire n'ouvre pas une chaîne.
 * Le commentaire passe donc en premier, et le premier qui accroche gagne.
 *
 * Une chaîne non refermée s'arrête à la fin de ligne plutôt que d'avaler le
 * reste du bloc — un guillemet apostrophe dans un commentaire français est plus
 * fréquent qu'une chaîne multi-lignes.
 */
const rulesFor = (lang: Lang): Rule[] => {
  const rules: Rule[] = []

  if (lang.block) {
    const [open, close] = lang.block
    rules.push({ kind: 'comment', re: new RegExp(`${esc(open)}[\\s\\S]*?(?:${esc(close)}|$)`, 'y') })
  }
  if (lang.line) {
    rules.push({ kind: 'comment', re: new RegExp(`${esc(lang.line)}[^\\n]*`, 'y') })
  }
  for (const quote of lang.quotes) {
    const q = esc(quote)
    const body = quote === '`' ? `(?:\\\\.|[^${q}\\\\])*` : `(?:\\\\.|[^${q}\\\\\\n])*`
    rules.push({ kind: 'string', re: new RegExp(`${q}${body}${q}?`, 'y') })
  }
  rules.push({ kind: 'number', re: /\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?/y })
  // Le tiret initial est intentionnel : il attrape `--color-neutral-800` en CSS
  // et `--frozen-lockfile` en shell, qui sont exactement ce qu'on veut
  // distinguer dans ces deux langages.
  rules.push({ kind: 'plain', re: /-{0,2}[A-Za-z_$@][\w$-]*/y })

  return rules
}

const cache = new Map<string, Rule[]>()

const rules = (name: string, lang: Lang): Rule[] => {
  const known = cache.get(name)
  if (known) return known
  const built = rulesFor(lang)
  cache.set(name, built)
  return built
}

/** Le prochain caractère qui n'est ni espace ni tabulation. */
const nextChar = (code: string, from: number): string => {
  let i = from
  while (i < code.length && (code[i] === ' ' || code[i] === '\t')) i += 1
  return code[i] ?? ''
}

/** Ce qu'est vraiment un mot, une fois qu'on regarde autour. */
const word = (text: string, lang: Lang, after: string): Kind => {
  if (lang.keywords.includes(text)) return 'keyword'
  if (text.startsWith('-')) return 'flag'
  if (lang.propColon && after === ':') return 'keyword'
  if (after === '(') return 'call'
  return 'plain'
}

/**
 * Le code découpé. La concaténation des `text` rend l'entrée à l'identique —
 * c'est l'invariant du module, et ce qui autorise à s'en servir pour afficher
 * du code qu'on n'a pas écrit.
 */
export function tokens(code: string, language?: string): Token[] {
  const name = ALIAS[(language ?? '').trim().toLowerCase()]
  const lang = name ? LANGS[name] : undefined
  if (!lang || !name) return code ? [{ text: code, kind: 'plain' }] : []

  const list = rules(name, lang)
  const out: Token[] = []
  let plain = ''
  let i = 0

  const flush = () => {
    if (plain) out.push({ text: plain, kind: 'plain' })
    plain = ''
  }

  while (i < code.length) {
    let hit: Rule | null = null
    let text = ''

    for (const rule of list) {
      rule.re.lastIndex = i
      const match = rule.re.exec(code)
      if (match && match[0]) {
        hit = rule
        text = match[0]
        break
      }
    }

    // Rien ne reconnaît ce caractère : il rejoint le texte brut. Avancer d'un
    // cran est ce qui garantit la terminaison, quoi que rendent les règles.
    if (!hit) {
      plain += code[i]
      i += 1
      continue
    }

    const kind =
      hit.kind === 'plain' ? word(text, lang, nextChar(code, i + text.length)) : hit.kind
    if (kind === 'plain') {
      plain += text
    } else {
      flush()
      out.push({ text, kind })
    }
    i += text.length
  }

  flush()
  return out
}

/** La couleur d'un jeton. `plain` n'en a pas : il hérite du bloc. */
export const KIND_STYLES: Record<Exclude<Kind, 'plain'>, string> = {
  comment: 'color: var(--color-neutral-600); font-style: italic;',
  string: 'color: var(--color-accent-2-300);',
  number: 'color: var(--color-accent-2-200);',
  keyword: 'color: var(--color-accent-300);',
  call: 'color: var(--color-neutral-100);',
  flag: 'color: var(--color-accent-2-400);',
}
