/**
 * `hooks/` n'est pas typé — cette déclaration existe pour que `app/src`, qui
 * l'est, puisse importer `density()` sans qu'on la réécrive en TypeScript.
 * C'est ce qui garde une seule implémentation pour l'interface, le CLI et le
 * serveur MCP.
 */
export function density(
  commits: Array<{ date: string }>,
  options?: { fenetre?: string; now?: Date },
): number[]

export function dailyCounts(
  entries: Array<{ date: string }>,
  days: number,
  now?: Date,
): number[]

export function foldWeekly(daily: number[]): number[]
