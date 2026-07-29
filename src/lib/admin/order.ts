/**
 * Display order for the hand-curated home page lists.
 *
 * Kept as a pure function over ids so it can be tested without a database, and
 * so the callers can renumber every row from 0 on each move. Swapping only the
 * two neighbours' `displayOrder` values looks equivalent and is not: rows that
 * arrive with duplicate or sparse orders — which seeded and hand-inserted rows
 * do — then swap into an order that does not change what is rendered.
 */
export function reorder(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;

  const to = from + delta;
  if (to < 0 || to >= ids.length) return null;

  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
