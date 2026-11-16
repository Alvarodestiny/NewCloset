/** Pads a list so the last row of a 2-column FlatList keeps half width. */
export type GridCell<T> = T | { __spacer: true; id: string };

export function padGrid<T>(items: T[], columns = 2): GridCell<T>[] {
  const missing = (columns - (items.length % columns)) % columns;
  return [...items, ...Array.from({ length: missing }, (_, i) => ({ __spacer: true as const, id: `spacer-${i}` }))];
}

export function isSpacer<T>(cell: GridCell<T>): cell is { __spacer: true; id: string } {
  return typeof cell === 'object' && cell !== null && '__spacer' in cell;
}
