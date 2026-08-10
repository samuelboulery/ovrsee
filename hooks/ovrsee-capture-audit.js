#!/usr/bin/env node
/**
 * Hook PostToolUse, matcher `Skill` : après un skill d'audit (revue de code,
 * revue de sécurité, audit de sur-ingénierie), pousse Claude à décomposer les
 * constats en tickets dans le même tour.
 *
 * Symétrique à `ovrsee-capture-plan.js`, mais ne capture rien sur disque —
 * un rapport d'audit n'est pas une intention approuvée, il n'a pas de statut
 * ouvert/fermé à suivre. Seul le nudge compte ici.
 *
 * Contrat (identique à ovrsee-capture-plan.js) : JSON sur stdin, exit 0
 * TOUJOURS. Un hook qui bloquerait l'outil casserait la revue elle-même.
 *
 *   stdin  {"tool_name":"Skill","tool_input":{"skill":"code-review:code-review",...},"cwd":"/chemin"}
 *   stdout {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}
 *          Silencieux (aucune sortie) si le skill invoqué n'est pas un audit.
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Noms exacts tels qu'invoqués par l'outil Skill : `plugin:skill` pour les
 * skills de plugin, nom nu pour les skills sans plugin. Une entrée mal
 * orthographiée rend le hook silencieusement inutile — pas d'erreur, juste
 * un nudge qui ne part jamais.
 */
const AUDIT_SKILLS = new Set(['code-review:code-review', 'security-review', 'ponytail:ponytail-audit', 'ponytail:ponytail-review'])

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Racine du dépôt git contenant `cwd`, ou null.
 * execFile sans shell : `cwd` vient d'un JSON externe et ne doit jamais être
 * interprété par un shell.
 */
function repoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Trace un audit dans `ovrsee/audits.jsonl`, seulement si le projet est déjà
 * équipé. Un échec d'écriture ne doit jamais faire échouer le hook — c'est
 * le nudge qui compte, pas la trace.
 */
function logAudit(root, skill) {
  const ovrseeDir = join(root, 'ovrsee')
  if (!existsSync(ovrseeDir)) return
  try {
    appendFileSync(
      join(ovrseeDir, 'audits.jsonl'),
      `${JSON.stringify({ date: new Date().toISOString(), skill })}\n`,
    )
  } catch {
    // Tant pis pour la trace, le nudge part quand même.
  }
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

  const skill = payload?.tool_input?.skill
  if (typeof skill !== 'string' || !AUDIT_SKILLS.has(skill)) return
  const root = repoRoot(payload.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à faire.

  logAudit(root, skill)

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[ovrsee] Revue « ${skill} » terminée. Décompose les constats en tickets via le skill cockpit-tickets — un ticket par constat réel, pas par ligne de rapport ; priorité dérivée de la gravité, charge estimée (xs–xl) quand c'est raisonnable.`,
      },
    }),
  )
}

try {
  main()
} catch (err) {
  // Dernier filet : on signale, on ne bloque jamais.
  process.stderr.write(`[ovrsee] capture audit ignorée : ${err?.message ?? err}\n`)
}
process.exit(0)
