/**
 * Repérage du signal de session dans le flux d'un terminal.
 *
 * Les hooks `Stop` et `Notification` de Claude Code écrivent une séquence OSC
 * dans le terminal de leur session — voir `hooks/ovrsee-notify.js`. L'ovrsee
 * possède ce terminal, donc chaque octet passe déjà par `useTerminal.ts` : il
 * ne reste qu'à reconnaître la séquence et à la retirer avant xterm.
 *
 * Fonction pure et fichier à part parce que deux détails valent d'être
 * éprouvés : une séquence peut arriver coupée entre deux lectures du pty, et
 * ce qui n'est pas pour nous doit ressortir intact.
 */

/** Ce que Claude vient de faire. */
export type AttentionKind = 'stop' | 'question'

/** Un signal reconnu, avec le détail que le hook y a joint s'il y en a un. */
export interface AttentionEvent {
  kind: AttentionKind
  /**
   * Le `message` de la charge utile du hook, décodé — « Claude needs your
   * permission to use Bash ». Vaut null sur un `stop`, sur la forme courte
   * héritée, et sur une charge illisible.
   */
  detail: string | null
}

// Construits par code de caractère, et pas écrits en clair : un octet de
// contrôle dans un fichier source est invisible en relecture comme en diff.
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)

/** Doit rester identique à `sequence()` dans `hooks/ovrsee-notify.js`. */
const PREFIX = `${ESC}]777;ovrsee;`

/**
 * Une séquence complète, terminateur compris. Le `+` sur le BEL n'est pas
 * décoratif : Claude Code ajoute le sien derrière celui du hook.
 *
 * Le second groupe est la charge base64, facultative — la forme courte
 * `…;stop<BEL>` reste valide et c'est celle que `Stop` émet.
 */
const COMPLETE = new RegExp(`^${ESC}\\]777;ovrsee;([a-z-]+)(?:;([A-Za-z0-9+/=]*))?${BEL}+`)

/**
 * Au-delà, ce qui commence par un ESC n'est plus un début de séquence à nous :
 * on cesse de le retenir plutôt que d'avaler le terminal en attendant un
 * terminateur qui ne viendra jamais.
 *
 * Dimensionné sur la séquence la plus longue que le hook puisse produire :
 * 120 caractères de détail font au plus 480 octets UTF-8, donc 640 de base64,
 * plus le préfixe. Retenir un peu trop est sans conséquence — la condition
 * ci-dessous exige que le morceau ressemble déjà à notre préfixe.
 */
const MAX_CARRY = 700

const isKind = (value: string): value is AttentionKind => value === 'stop' || value === 'question'

/**
 * Décode la charge base64 d'une séquence.
 *
 * Rend null plutôt que de lever : une charge tronquée ou corrompue ne doit pas
 * emporter le flux du terminal avec elle. Le signal reste utile sans son
 * détail — c'est la forme courte.
 */
function decode(charge: string | undefined): string | null {
  if (!charge) return null
  try {
    const octets = Uint8Array.from(atob(charge), c => c.charCodeAt(0))
    const texte = new TextDecoder().decode(octets)
    return texte === '' ? null : texte
  } catch {
    return null
  }
}

export interface AttentionScan {
  /** Le flux débarrassé de nos séquences, à écrire dans xterm. */
  clean: string
  /** Début de séquence incomplet, à replacer devant la lecture suivante. */
  carry: string
  events: AttentionEvent[]
}

/**
 * Extrait les signaux d'un morceau de flux.
 *
 * @param carry le `carry` rendu par l'appel précédent, `''` au départ
 * @param chunk le morceau qui vient d'arriver du pty
 */
export function extractAttention(carry: string, chunk: string): AttentionScan {
  const text = carry + chunk
  const events: AttentionEvent[] = []
  let clean = ''
  let i = 0

  while (i < text.length) {
    const start = text.indexOf(ESC, i)
    if (start === -1) {
      clean += text.slice(i)
      break
    }

    clean += text.slice(i, start)
    const rest = text.slice(start)

    const complete = COMPLETE.exec(rest)
    if (complete) {
      if (isKind(complete[1])) events.push({ kind: complete[1], detail: decode(complete[2]) })
      // Un genre inconnu est consommé quand même : mieux vaut le retirer que
      // le laisser s'afficher.
      i = start + complete[0].length
      continue
    }

    // Séquence coupée par la fin du morceau : soit le préfixe lui-même est
    // encore incomplet, soit il est entier mais le terminateur n'est pas
    // arrivé. Dans les deux cas on attend la suite.
    const partiel =
      rest.length < MAX_CARRY &&
      (PREFIX.startsWith(rest) || (rest.startsWith(PREFIX) && !rest.includes(BEL)))
    if (partiel) return { clean, carry: rest, events }

    // Un ESC qui ne nous concerne pas : il appartient au terminal.
    clean += ESC
    i = start + 1
  }

  return { clean, carry: '', events }
}
