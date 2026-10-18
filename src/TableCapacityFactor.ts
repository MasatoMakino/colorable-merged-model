/**
 * Ratio of hash-table capacity to the number of stored keys in
 * FastEdgesGeometry. The set is closed to the measured values: a ratio at or
 * below 1 can fill a table and stall linear probing.
 */
export type TableCapacityFactor = 1.5 | 2;

export const DEFAULT_TABLE_CAPACITY_FACTOR: TableCapacityFactor = 2;

/**
 * Throws a RangeError unless `factor` is one of the TableCapacityFactor
 * values. Guards untyped callers, because an invalid factor can stall probing.
 */
export function assertTableCapacityFactor(
  factor: unknown,
): asserts factor is TableCapacityFactor {
  if (factor !== 1.5 && factor !== 2) {
    throw new RangeError(
      `tableCapacityFactor must be 1.5 or 2, but got ${String(factor)}`,
    );
  }
}
