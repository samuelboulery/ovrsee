/**
 * Le strict nécessaire de `node:test` et `node:assert/strict`.
 *
 * Écrit à la main plutôt qu'installé : `@types/node` déclare une plateforme
 * entière pour deux modules dont les tests n'utilisent qu'une poignée de
 * fonctions, et le projet tient à trois dépendances de production. Compléter ce
 * fichier quand un test a besoin d'autre chose est moins cher que la
 * dépendance.
 */
declare module 'node:test' {
  interface TestFn {
    (name: string, fn: () => void | Promise<void>): void
    skip: (name: string, fn?: () => void | Promise<void>) => void
  }
  const test: TestFn
  export default test
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value
    ok: (value: unknown, message?: string) => asserts value
    equal: (actual: unknown, expected: unknown, message?: string) => void
    notEqual: (actual: unknown, expected: unknown, message?: string) => void
    deepEqual: (actual: unknown, expected: unknown, message?: string) => void
    match: (value: string, pattern: RegExp, message?: string) => void
    throws: (fn: () => unknown, expected?: RegExp | Error, message?: string) => void
    fail: (message?: string) => never
  }
  const assert: Assert
  export default assert
}
