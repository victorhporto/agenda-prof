import { vi } from "vitest";

export type SupabaseQueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

/**
 * Client Supabase mínimo para testes.
 * Cada `from()` consome o próximo resultado da fila.
 * A cadeia é thenable — funciona com `.single()` e com `await query.eq(...)`.
 */
export function createSupabaseMock(results: SupabaseQueryResult[] = []) {
  let index = 0;

  const from = vi.fn((_table?: string) => {
    const terminal = {
      data: results[index]?.data ?? null,
      error: results[index]?.error ?? null,
      count: results[index]?.count ?? null,
    };
    index += 1;

    const chain: Record<string, unknown> = {};
    const passthrough = vi.fn(() => chain);

    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "neq",
      "gte",
      "lte",
      "order",
    ] as const) {
      chain[method] = passthrough;
    }

    chain.single = vi.fn(async () => terminal);
    chain.maybeSingle = vi.fn(async () => terminal);
    chain.then = (
      onFulfilled?: (value: typeof terminal) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(terminal).then(onFulfilled, onRejected);

    return chain;
  });

  return {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "teacher-1" } },
      }),
    },
  };
}
