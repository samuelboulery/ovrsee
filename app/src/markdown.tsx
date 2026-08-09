import type { ReactNode } from 'react'

import { s } from './style'

/**
 * Rendu markdown, en éléments React.
 *
 * Pourquoi pas une bibliothèque : le seul markdown que le cockpit affiche est
 * celui de fichiers du dépôt qu'on lit — README, corps de plan, corps de
 * ticket. Ce sous-ensemble tient en un fichier, et une dépendance de plus
 * demanderait sa propre justification dans l'onglet Stack.
 *
 * Pourquoi pas `dangerouslySetInnerHTML` : rendre des éléments React ferme la
 * question de l'injection sans avoir à assainir quoi que ce soit. Un README
 * contenant du HTML le montre alors en clair — c'est visible, donc corrigible,
 * là où une balise interprétée passerait inaperçue.
 *
 * Ce qui n'est pas reconnu est rendu tel quel. Le pire comportement serait
 * d'avaler une ligne : le fichier existe, on doit pouvoir le lire en entier.
 */

const HEADING = /^(#{1,4})\s+(.*)$/
const FENCE = /^```/
const BULLET = /^[-*+]\s+(.*)$/
const NUMBER = /^\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^(-{3,}|\*{3,}|_{3,})$/
const ROW = /^\|.*\|\s*$/
const SEPARATOR = /^\|[\s:|-]+\|\s*$/

/**
 * Un lien externe s'ouvre dans le navigateur ; tout le reste reste du texte.
 *
 * Ce n'est pas une limitation, c'est la seule forme correcte ici. Un lien
 * relatif — `./cadrage-cockpit.md` — serait nuisible deux fois : Electron le
 * refuse (`will-navigate`, electron/main.js), et surtout le crawl découvre les
 * écrans en lisant `a[href]`. Un README bavard inscrirait alors ses liens comme
 * des routes du cockpit, et la carte de navigation montrerait des pages qui
 * n'existent pas.
 */
const isExternal = (href: string) => /^https?:\/\//i.test(href)

/**
 * Neuve à chaque appel, et c'est nécessaire : `inline()` se rappelle lui-même
 * pour l'intitulé d'un lien. Une expression `/g` partagée porte son
 * `lastIndex`, que l'appel imbriqué remettrait à zéro — la boucle extérieure
 * repartirait alors du début et ne s'arrêterait jamais.
 */
const inlinePattern = () => /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]*\]\([^)\s]+\))/g

const CODE_STYLE =
  'font-family: ui-monospace, monospace; font-size: .92em; background: var(--color-neutral-900); border: 1px solid var(--color-neutral-800); border-radius: 4px; padding: 1px 5px;'

/** `**gras**`, `*italique*`, `` `code` ``, `[texte](url)`. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let index = 0

  const pattern = inlinePattern()
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index++}`

    if (token.startsWith('`')) {
      out.push(
        <code key={key} style={s(CODE_STYLE)}>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={key} style={s('font-weight: 600; color: var(--color-text);')}>
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      out.push(
        <em key={key} style={s('font-style: italic;')}>
          {token.slice(1, -1)}
        </em>,
      )
    } else {
      const cut = token.indexOf('](')
      const label = token.slice(1, cut)
      const href = token.slice(cut + 2, -1)
      // Un intitulé de lien porte souvent lui-même du markdown — c'est le cas
      // dès qu'un README cite un fichier : `[`cadrage.md`](./cadrage.md)`. Le
      // rendre brut ferait apparaître les accents graves à l'écran.
      const texte = label ? inline(label, `${key}-l`) : href
      out.push(
        isExternal(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={s('color: var(--color-accent-300); text-underline-offset: 2px;')}
          >
            {texte}
          </a>
        ) : (
          // Le chemin est dit, pas masqué : savoir qu'un fichier voisin existe
          // vaut mieux qu'un mot souligné qui ne mènerait nulle part.
          <span key={key} style={s('color: var(--color-neutral-500);')}>
            {texte}
            <span style={s('font-family: ui-monospace, monospace; font-size: .88em;')}>
              {` (${href})`}
            </span>
          </span>
        ),
      )
    }
    last = match.index + token.length
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}

const HEADING_STYLES = [
  'font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 26px 0 8px;',
  'font-family: var(--font-heading); font-weight: 500; font-size: 15.5px; margin: 24px 0 7px;',
  'font-family: var(--font-heading); font-weight: 500; font-size: 13.5px; margin: 20px 0 6px;',
  'font-weight: 600; font-size: 12.5px; margin: 16px 0 5px; color: var(--color-neutral-300);',
]

const CELL =
  'padding: 7px 11px; border-bottom: 1px solid var(--color-neutral-800); text-align: left; vertical-align: top;'

const cells = (line: string) =>
  line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(cell => cell.trim())

export function Markdown({ text }: { text: string }): ReactNode {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0

  const key = () => `b${blocks.length}-${i}`

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    // Bloc de code. Une clôture manquante ne doit pas manger le reste du
    // fichier : la fin du texte ferme le bloc.
    if (FENCE.test(line)) {
      const language = line.slice(3).trim()
      const body: string[] = []
      i += 1
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++])
      i += 1 // la ligne de clôture

      blocks.push(
        <pre
          key={key()}
          style={s(
            'margin: 12px 0; padding: 12px 14px; overflow-x: auto; background: var(--color-neutral-900); border: 1px solid var(--color-neutral-800); border-radius: 8px; font-family: ui-monospace, monospace; font-size: 11.5px; line-height: 1.6; color: var(--color-neutral-300);',
          )}
        >
          {language && (
            <div style={s('font-size: 10px; color: var(--color-neutral-600); margin-bottom: 6px;')}>
              {language}
            </div>
          )}
          <code>{body.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level - 1]
      blocks.push(
        <Tag key={key()} style={s(HEADING_STYLES[level - 1])}>
          {inline(heading[2], key())}
        </Tag>,
      )
      i += 1
      continue
    }

    if (RULE.test(line.trim())) {
      blocks.push(
        <hr
          key={key()}
          style={s('border: 0; border-top: 1px solid var(--color-divider); margin: 22px 0;')}
        />,
      )
      i += 1
      continue
    }

    // Tableau GFM : une ligne d'en-tête suivie d'un séparateur. Sans le
    // séparateur, ce n'est qu'un paragraphe qui contient des barres verticales.
    if (ROW.test(line) && i + 1 < lines.length && SEPARATOR.test(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && ROW.test(lines[i])) body.push(cells(lines[i++]))

      blocks.push(
        <div key={key()} style={s('margin: 12px 0; overflow-x: auto;')}>
          <table
            style={s(
              'border-collapse: collapse; width: 100%; font-size: 12.5px; border: 1px solid var(--color-neutral-800); border-radius: 8px;',
            )}
          >
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th
                    key={c}
                    style={s(
                      `${CELL} font-weight: 500; color: var(--color-neutral-400); background: var(--color-surface);`,
                    )}
                  >
                    {inline(cell, `${key()}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={s(`${CELL} color: var(--color-neutral-300);`)}>
                      {inline(cell, `${key()}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push((QUOTE.exec(lines[i]) as RegExpExecArray)[1])
        i += 1
      }
      blocks.push(
        <blockquote
          key={key()}
          style={s(
            'margin: 12px 0; padding: 2px 0 2px 14px; border-left: 2px solid var(--color-accent-700); color: var(--color-neutral-400); font-size: 12.5px; line-height: 1.6;',
          )}
        >
          {inline(body.join(' '), key())}
        </blockquote>,
      )
      continue
    }

    const bulleted = BULLET.test(line)
    if (bulleted || NUMBER.test(line)) {
      const pattern = bulleted ? BULLET : NUMBER
      const items: string[] = []
      while (i < lines.length && pattern.test(lines[i])) {
        items.push((pattern.exec(lines[i]) as RegExpExecArray)[1])
        i += 1
      }
      const List = bulleted ? 'ul' : 'ol'
      blocks.push(
        <List
          key={key()}
          style={s(
            'margin: 10px 0; padding-left: 20px; font-size: 12.5px; line-height: 1.65; color: var(--color-neutral-300);',
          )}
        >
          {items.map((item, index) => (
            <li key={index} style={s('margin: 3px 0; text-wrap: pretty;')}>
              {inline(item, `${key()}-${index}`)}
            </li>
          ))}
        </List>,
      )
      continue
    }

    // Paragraphe : tout jusqu'à la ligne vide ou au prochain bloc reconnu.
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i++])
    }
    // Un paragraphe vide signifierait que `isBlockStart` a menti sur la
    // première ligne — on avance quand même, sans quoi la boucle tournerait
    // sans fin.
    if (paragraph.length === 0) paragraph.push(lines[i++])

    blocks.push(
      <p
        key={key()}
        style={s(
          'margin: 10px 0; font-size: 12.5px; line-height: 1.7; color: var(--color-neutral-300); text-wrap: pretty;',
        )}
      >
        {inline(paragraph.join(' '), key())}
      </p>,
    )
  }

  return <>{blocks}</>
}

/** Une ligne qui ouvre autre chose qu'un paragraphe. */
const isBlockStart = (line: string): boolean =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  BULLET.test(line) ||
  NUMBER.test(line) ||
  QUOTE.test(line) ||
  RULE.test(line.trim()) ||
  ROW.test(line)
