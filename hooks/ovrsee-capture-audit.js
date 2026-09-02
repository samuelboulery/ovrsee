#!/usr/bin/env node
/**
 * Trois hooks en un fichier, branchés sur `hook_event_name` :
 *
 * - UserPromptSubmit : un skill d'audit invoqué en commande slash (ex.
 *   `/ponytail-audit`, forme courte) ne passe jamais par l'outil `Skill` — le
 *   harness le charge avant même le tour du modèle, donc PostToolUse ne voit
 *   rien. On détecte la commande dans le prompt brut et on pose un marqueur.
 * - PostToolUse (matcher `Skill`) : cas où l'audit est réellement invoqué via
 *   l'outil `Skill` (agent, appel programmatique). Trace direct.
 * - Stop : si un marqueur attend (posé par UserPromptSubmit), l'audit vient
 *   de tourner dans le tour qui se termine — c'est là, et seulement là, que
 *   les constats existent. Trace + nudge, puis marqueur supprimé.
 *
 * Contrat (identique à ovrsee-capture-plan.js) : JSON sur stdin, exit 0
 * TOUJOURS. Un hook qui bloquerait l'outil casserait la revue elle-même.
 *
 *   stdin  UserPromptSubmit {"hook_event_name":"UserPromptSubmit","prompt":"/ponytail-audit","cwd":"/chemin"}
 *          PostToolUse      {"hook_event_name":"PostToolUse","tool_name":"Skill","tool_input":{"skill":"code-review:code-review"},"cwd":"/chemin"}
 *          Stop             {"hook_event_name":"Stop","cwd":"/chemin"}
 *   effets <repo>/ovrsee/.pending-audit (créé par UserPromptSubmit, consommé par Stop)
 *          <repo>/ovrsee/audits.jsonl   (trace, si le projet est équipé)
 *   stdout {"hookSpecificOutput":{"hookEventName":"...","additionalContext":"..."}}
 *          Silencieux (aucune sortie) si rien à faire pour cet event.
 */

import { appendFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { readJson } from './json.js'

import { readStdin, repoRoot } from './entree.js'
import { estPrincipal } from './principal.js'

/**
 * Noms exacts tels qu'invoqués par l'outil Skill : `plugin:skill` pour les
 * skills de plugin, nom nu pour les skills sans plugin. Une entrée mal
 * orthographiée rend le hook silencieusement inutile — pas d'erreur, juste
 * un nudge qui ne part jamais.
 */
const AUDIT_SKILLS = new Set(['code-review:code-review', 'security-review', 'ponytail:ponytail-audit', 'ponytail:ponytail-review'])

/**
 * Un skill invoqué en commande slash s'écrit sous sa forme courte
 * (`/code-review`, `/ponytail-audit`) — c'est la forme documentée par les
 * skills eux-mêmes et utilisée ailleurs dans ce dépôt (ex. CLAUDE.md :
 * `commit-commands:commit-push-pr` → `/commit-push-pr`). L'outil `Skill`
 * appelé par un agent transmet lui la forme qualifiée `plugin:skill`
 * (`tool_input.skill`). Cette table accepte les deux et retourne toujours
 * l'id canonique qui sert à écrire dans `audits.jsonl`.
 */
const AUDIT_SKILL_ALIASES = new Map([
  ['code-review', 'code-review:code-review'],
  ['code-review:code-review', 'code-review:code-review'],
  ['security-review', 'security-review'],
  ['ponytail-audit', 'ponytail:ponytail-audit'],
  ['ponytail:ponytail-audit', 'ponytail:ponytail-audit'],
  ['ponytail-review', 'ponytail:ponytail-review'],
  ['ponytail:ponytail-review', 'ponytail:ponytail-review'],
])

export function skillFromSlashCommand(prompt) {
  const trimmed = prompt.trim()
  if (!trimmed.startsWith('/')) return null
  const name = trimmed.slice(1).split(/\s+/, 1)[0]
  return AUDIT_SKILL_ALIASES.get(name) ?? null
}


/**
 * Trace un audit dans `ovrsee/audits.jsonl`, seulement si le projet est déjà
 * équipé. Un échec d'écriture ne doit jamais faire échouer le hook — c'est
 * le nudge qui compte, pas la trace.
 */
export function logAudit(root, skill) {
  const ovrseeDir = join(root, 'ovrsee')
  if (!existsSync(ovrseeDir)) return false
  try {
    appendFileSync(
      join(ovrseeDir, 'audits.jsonl'),
      `${JSON.stringify({ date: new Date().toISOString(), skill })}\n`,
    )
    return true
  } catch {
    // Tant pis pour la trace, le nudge part quand même.
    return true
  }
}

const pendingAuditPath = (root) => join(root, 'ovrsee', '.pending-audit')

const NUDGE_TEXT = (skill) =>
  `[ovrsee] Revue « ${skill} » terminée. Décompose les constats en tickets via le skill ovrsee-tickets — un ticket par constat réel, pas par ligne de rapport ; priorité dérivée de la gravité, charge estimée (xs–xl) quand c'est raisonnable.`

/**
 * PostToolUse peut injecter du contexte sans rouvrir le tour (hookSpecificOutput
 * .additionalContext). Stop n'a pas cette option : pour pousser Claude à
 * continuer après un Stop, seul `decision: "block"` + `reason` rouvre le tour.
 */
function nudge(hookEventName, skill) {
  if (hookEventName === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: NUDGE_TEXT(skill) }))
    return
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName,
        additionalContext: NUDGE_TEXT(skill),
      },
    }),
  )
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const eventName = payload?.hook_event_name
  const root = repoRoot(payload?.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à faire.
  if (!existsSync(join(root, 'ovrsee'))) return // Projet non équipé.

  // Skill invoqué en commande slash : le tour ne fait que commencer, aucun
  // constat n'existe encore. On pose juste un marqueur pour le Stop hook.
  if (eventName === 'UserPromptSubmit' || (typeof payload?.prompt === 'string' && !payload.tool_input)) {
    const skill = skillFromSlashCommand(payload.prompt || '')
    if (!skill) return
    try {
      writeFileSync(pendingAuditPath(root), JSON.stringify({ skill, date: new Date().toISOString() }))
    } catch {
      // Pas de marqueur, pas de nudge au Stop — tant pis, silencieux.
    }
    return
  }

  // Fin de tour : si un audit slash-command attendait, les constats existent
  // maintenant dans la réponse qui vient de se terminer.
  // ponytail: suppose l'audit fini au premier Stop qui suit la commande. Si
  // Claude fan-out des agents async pour l'audit, ce Stop arrive avant les
  // résultats — marqueur consommé trop tôt, pas de second nudge au vrai Stop
  // final. Upgrade : ne consommer que si aucune tâche background n'est active.
  if (eventName === 'Stop') {
    const markerPath = pendingAuditPath(root)
    if (!existsSync(markerPath)) return
    const skill = readJson(markerPath)?.skill ?? null
    try {
      unlinkSync(markerPath)
    } catch {
      // Marqueur non supprimé : pire cas, un nudge en double au prochain Stop.
    }
    if (typeof skill !== 'string' || !AUDIT_SKILLS.has(skill)) return
    logAudit(root, skill)
    nudge('Stop', skill)
    return
  }

  // Appel réel de l'outil Skill (agent, invocation programmatique).
  const skill = payload?.tool_input?.skill
  if (typeof skill !== 'string' || !AUDIT_SKILLS.has(skill)) return
  logAudit(root, skill)
  nudge('PostToolUse', skill)
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour éprouver `skillFromSlashCommand` ou
 * `logAudit` lirait stdin et appellerait `process.exit(0)` à chaque
 * `pnpm test`.
 */
if (estPrincipal(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais.
    process.stderr.write(`[ovrsee] capture audit ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
