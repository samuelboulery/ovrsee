import { useState, type ReactNode } from 'react'

import { mediaUrl } from './data'
import { KIND_STYLES, tokens } from './highlight'
import { t } from './i18n'
import { s } from './style'

/**
 * Rendu markdown, en éléments React.
 *
 * Pourquoi pas une bibliothèque : le seul markdown que l'ovrsee affiche est
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
const TASK = /^\[([ xX])\]\s+(.*)$/
const DETAILS = /^<details\b/i
const DETAILS_END = /<\/details>/i
const SUMMARY = /<summary[^>]*>([\s\S]*?)<\/summary>/i
const HTML_IMG = /^<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>$/i
const VIDEO = /\.(mp4|webm|mov)$/i
// La même liste que `MEDIA_TYPES` côté serveur (hooks/snapshot.js). La tenir
// des deux côtés évite l'icône d'image cassée : ce que le serveur refuserait
// n'est pas demandé, il est affiché en texte.
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i

/**
 * Un lien externe s'ouvre dans le navigateur ; tout le reste reste du texte.
 *
 * Ce n'est pas une limitation, c'est la seule forme correcte ici. Un lien
 * relatif — `./cadrage-ovrsee.md` — serait nuisible deux fois : Electron le
 * refuse (`will-navigate`, electron/main.js), et surtout le crawl découvre les
 * écrans en lisant `a[href]`. Un README bavard inscrirait alors ses liens comme
 * des routes de l'ovrsee, et la carte de navigation montrerait des pages qui
 * n'existent pas.
 */
const isExternal = (href: string) => /^https?:\/\//i.test(href)

/**
 * Neuve à chaque appel, et c'est nécessaire : `inline()` se rappelle lui-même
 * pour l'intitulé d'un lien. Une expression `/g` partagée porte son
 * `lastIndex`, que l'appel imbriqué remettrait à zéro — la boucle extérieure
 * repartirait alors du début et ne s'arrêterait jamais.
 */
const inlinePattern = () =>
  /(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]*\]\([^)\s]+\))/g

// `--color-surface-control`, pas `--color-neutral-900` : ce dernier vaut
// exactement `--color-bg` en thème clair (T-0045, rampe inversée) — un code
// « surligné » qui se fond dans le fond de la page.
const CODE_STYLE =
  'font-family: var(--font-mono); font-size: .92em; background: var(--color-surface-control); border: 1px solid var(--color-border-card); border-radius: 4px; padding: 1px 5px;'

/**
 * Une image ou une vidéo du dépôt, ou rien.
 *
 * Rien de distant ne se charge — ni badge, ni GIF hébergé. L'ovrsee lit des
 * README qu'il n'a pas écrits : une balise `<img>` vers un domaine tiers ferait
 * partir une requête à chaque ouverture du projet, et dirait à qui l'a écrite
 * quand on regarde. Une source distante reste donc affichée en clair, avec son
 * URL, comme un lien relatif.
 *
 * `root` absent — un appelant qui ne travaille pas sur un projet — retombe sur
 * le même rendu texte : mieux vaut un chemin lisible qu'une image cassée.
 */
function media(src: string, alt: string, key: string, root?: string): ReactNode {
  const servable = IMAGE.test(src) || VIDEO.test(src)

  // `//` et `data:` sont des sources distantes ou embarquées déguisées : elles
  // ne passent pas par le serveur, donc pas par sa liste blanche.
  const distant = isExternal(src) || src.startsWith('//') || src.startsWith('data:')

  if (!root || !src || !servable || distant) {
    return (
      <span key={key} style={s('color: var(--color-neutral-500);')}>
        {alt || t('markdown.image')}
        <span style={s('font-family: var(--font-mono); font-size: .88em;')}>
          {` (${src})`}
        </span>
      </span>
    )
  }

  const url = mediaUrl(root, src.replace(/^\.\//, ''))

  // ponytail: pas de requêtes Range côté serveur. Une vidéo se lit du début ;
  // se déplacer dans une longue timeline peut hoqueter. À traiter le jour où
  // quelqu'un met un screencast de 200 Mo dans son README.
  if (VIDEO.test(src)) {
    return (
      <video
        key={key}
        src={url}
        controls
        preload="metadata"
        style={s('display: block; max-width: 100%; margin: 12px 0; border-radius: 8px;')}
      />
    )
  }

  return (
    <img
      key={key}
      src={url}
      alt={alt}
      // Un README illustré en aligne facilement une dizaine, presque toutes
      // sous la ligne de flottaison.
      loading="lazy"
      decoding="async"
      style={s(
        'display: inline-block; max-width: 100%; height: auto; margin: 4px 0; border-radius: 8px;',
      )}
    />
  )
}

/** `**gras**`, `*italique*`, `` `code` ``, `[texte](url)`, `![alt](src)`. */
function inline(text: string, keyPrefix: string, root?: string): ReactNode[] {
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
    } else if (token.startsWith('![')) {
      const cut = token.indexOf('](')
      out.push(media(token.slice(cut + 2, -1), token.slice(2, cut), key, root))
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
      const texte = label ? inline(label, `${key}-l`, root) : href
      out.push(
        isExternal(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={s('color: var(--color-accent); text-underline-offset: 2px;')}
          >
            {texte}
          </a>
        ) : (
          // Le chemin est dit, pas masqué : savoir qu'un fichier voisin existe
          // vaut mieux qu'un mot souligné qui ne mènerait nulle part.
          <span key={key} style={s('color: var(--color-neutral-500);')}>
            {texte}
            <span style={s('font-family: var(--font-mono); font-size: .88em;')}>
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

// `--md-anchor` est posée par l'onglet qui rend le document — l'Aperçu y met la
// hauteur de son en-tête collant. Sans ce décalage, cliquer un lien du sommaire
// amène le titre visé pile *sous* l'en-tête, donc hors de vue. La valeur par
// défaut est nulle : un appelant qui ne pose rien ne subit rien.
const ANCHOR = 'scroll-margin-top: var(--md-anchor, 0px);'

const HEADING_STYLES = [
  `font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 26px 0 8px; ${ANCHOR}`,
  `font-family: var(--font-heading); font-weight: 500; font-size: 15.5px; margin: 24px 0 7px; ${ANCHOR}`,
  `font-family: var(--font-heading); font-weight: 500; font-size: 13.5px; margin: 20px 0 6px; ${ANCHOR}`,
  `font-weight: 600; font-size: 12.5px; margin: 16px 0 5px; color: var(--color-neutral-300); ${ANCHOR}`,
]

const CELL =
  'padding: 7px 11px; border-bottom: 1px solid var(--color-border-card); text-align: left; vertical-align: top;'

/**
 * Un bloc de code : sa barre, sa coloration, son bouton copier.
 *
 * L'étiquette de langage était jusqu'ici *dans* le `<pre>` — donc sélectionnée
 * avec le code, et copiée avec lui. Elle sort dans une barre : ce qu'on copie
 * est exactement ce qui se lance.
 */
function Bloc({ code, language }: { code: string; language: string }) {
  const [copie, setCopie] = useState(false)

  return (
    <div
      style={s(
        'margin: 12px 0; border: 1px solid var(--color-border-card); border-radius: 8px; background: var(--color-surface-control); overflow: hidden;',
      )}
    >
      <div
        style={s(
          'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 10px; border-bottom: 1px solid var(--color-border-card);',
        )}
      >
        <span style={s('font-size: 10px; color: var(--color-neutral-600);')}>{language}</span>
        <button
          type="button"
          onClick={() => {
            // Un presse-papier refusé n'est pas une panne : le code reste
            // sélectionnable à la main, et le bouton ne prétend pas avoir
            // réussi.
            navigator.clipboard
              ?.writeText(code)
              .then(() => {
                setCopie(true)
                setTimeout(() => setCopie(false), 1500)
              })
              .catch(() => setCopie(false))
          }}
          style={s(
            'background: none; border: 0; padding: 2px 4px; cursor: pointer; font-size: 10px; letter-spacing: .04em; color: ' +
              (copie ? 'var(--color-accent);' : 'var(--color-neutral-600);'),
          )}
        >
          {copie ? t('markdown.copied') : t('markdown.copy')}
        </button>
      </div>
      <pre
        style={s(
          'margin: 0; padding: 12px 14px; overflow-x: auto; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.6; color: var(--color-neutral-300);',
        )}
      >
        <code>
          {tokens(code, language).map((token, index) =>
            token.kind === 'plain' ? (
              token.text
            ) : (
              <span key={index} style={s(KIND_STYLES[token.kind])}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  )
}

/**
 * L'ancre d'un titre.
 *
 * Le préfixe `md-` n'est pas décoratif. Un élément qui porte un `id` devient une
 * propriété de `window` : un README qui commence par « # Ovrsee » posait un
 * `id="ovrsee"`, et `window.ovrsee` cessait alors de désigner le pont Electron
 * pour désigner ce titre. La détection du mode Electron basculait avec, et le
 * navigateur affichait des boutons qui ne pouvaient rien faire. Aucune ancre ne
 * doit pouvoir se nommer comme un global — le préfixe le garantit pour tous les
 * README à venir, pas seulement celui-ci.
 *
 * ponytail: deux titres identiques dans un même document partagent leur ancre,
 * et le sommaire mène alors au premier. Dédoublonner demanderait au sommaire et
 * au rendu de compter à l'identique — deux comptages qui finiraient par
 * diverger, pour un cas qui ne se produit presque jamais.
 */
export const slug = (text: string): string =>
  'md-' +
  text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Les titres d'un document, pour un sommaire.
 *
 * Le suivi des clôtures de blocs de code n'est pas du zèle : `# installation`
 * dans un bloc `bash` est un commentaire, et le faire figurer au sommaire
 * mènerait à une ancre qui n'existe pas.
 */
export function headings(text: string): Array<{ level: number; texte: string; id: string }> {
  const out: Array<{ level: number; texte: string; id: string }> = []
  let fenced = false

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const found = HEADING.exec(line)
    if (found) {
      const texte = found[2].replace(/[`*]/g, '').trim()
      out.push({ level: found[1].length, texte, id: slug(found[2]) })
    }
  }

  return out
}

const cells = (line: string) =>
  line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(cell => cell.trim())

/**
 * @param root racine du projet, pour servir les images et vidéos qu'il cite.
 *   Sans elle, les médias s'affichent en texte — voir `media()`.
 */
export function Markdown({ text, root }: { text: string; root?: string }): ReactNode {
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

      blocks.push(<Bloc key={key()} code={body.join('\n')} language={language} />)
      continue
    }

    // `<details>` et `<img>` : les deux seules balises HTML reconnues, parce
    // que ce sont les deux qu'un README écrit vraiment — un pliage pour une
    // section longue, une capture centrée. Tout autre HTML reste affiché en
    // clair, comme avant : visible, donc corrigible.
    if (DETAILS.test(line.trim())) {
      const body: string[] = []
      while (i < lines.length && !DETAILS_END.test(lines[i])) body.push(lines[i++])
      i += 1 // la ligne de clôture

      const brut = body.join('\n')
      const resume = SUMMARY.exec(brut)
      blocks.push(
        <details
          key={key()}
          style={s(
            'margin: 12px 0; padding: 8px 12px; border: 1px solid var(--color-border-card); border-radius: 8px;',
          )}
        >
          <summary style={s('cursor: pointer; font-size: 12.5px; color: var(--color-neutral-300);')}>
            {resume ? inline(resume[1].trim(), key(), root) : t('markdown.details')}
          </summary>
          <Markdown text={brut.replace(SUMMARY, '').replace(/^<details[^>]*>/i, '')} root={root} />
        </details>,
      )
      continue
    }

    const balise = HTML_IMG.exec(line.trim())
    if (balise) {
      blocks.push(<div key={key()}>{media(balise[1], '', key(), root)}</div>)
      i += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      // Décalé d'un cran : un README rendu dans un onglet est un document
      // imbriqué, pas la page. Son `#` de titre est un `h2` sous le `h1` de la
      // fenêtre — sans quoi la page compte deux titres de premier niveau et le
      // plan du document devient faux pour un lecteur d'écran.
      const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[level - 1]
      blocks.push(
        // L'ancre est ce qui rend le sommaire cliquable — voir `headings()`.
        <Tag key={key()} id={slug(heading[2])} style={s(HEADING_STYLES[level - 1])}>
          {inline(heading[2], key(), root)}
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
              'border-collapse: collapse; width: 100%; font-size: 12.5px; border: 1px solid var(--color-border-card); border-radius: 8px;',
            )}
          >
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th
                    key={c}
                    style={s(
                      `${CELL} font-weight: 500; color: var(--color-neutral-400); background: var(--color-surface-control);`,
                    )}
                  >
                    {inline(cell, `${key()}-h${c}`, root)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={s(`${CELL} color: var(--color-neutral-300);`)}>
                      {inline(cell, `${key()}-${r}-${c}`, root)}
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
          {inline(body.join(' '), key(), root)}
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
      // Une liste de tâches perd ses puces : la case en fait déjà office, et
      // les deux ensemble décalent le texte pour rien.
      const taches = items.some(item => TASK.test(item))
      blocks.push(
        <List
          key={key()}
          style={s(
            'margin: 10px 0; font-size: 12.5px; line-height: 1.65; color: var(--color-neutral-300); ' +
              (taches ? 'padding-left: 2px; list-style: none;' : 'padding-left: 20px;'),
          )}
        >
          {items.map((item, index) => {
            const tache = TASK.exec(item)
            return (
              <li key={index} style={s('margin: 3px 0; text-wrap: pretty;')}>
                {tache && (
                  // En lecture seule : l'ovrsee lit, il ne coche pas. Cocher
                  // ici écrirait dans le README d'un dépôt qu'il observe.
                  <input
                    type="checkbox"
                    checked={tache[1] !== ' '}
                    readOnly
                    disabled
                    style={s('margin-right: 7px; vertical-align: middle; accent-color: var(--color-accent);')}
                  />
                )}
                {inline(tache ? tache[2] : item, `${key()}-${index}`, root)}
              </li>
            )
          })}
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
        {inline(paragraph.join(' '), key(), root)}
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
  ROW.test(line) ||
  DETAILS.test(line.trim()) ||
  HTML_IMG.test(line.trim())
