// ============================================================================
// Random utilities — weighted picks, range selection, sequential cycling
// ============================================================================

import { Dimension, DimensionValue } from "../models/schema";

/**
 * Global counter for sequential selection mode.
 * Maps dimension.id → current index.
 */
const sequentialCounters: Map<string, number> = new Map();

/**
 * Reset all sequential counters (used between batch runs or tests).
 */
export function resetSequentialCounters(): void {
  sequentialCounters.clear();
}

/**
 * Reset a specific dimension's sequential counter.
 */
export function resetSequentialCounter(dimensionId: string): void {
  sequentialCounters.delete(dimensionId);
}

/**
 * Pick a random value from a dimension based on its selectionMode.
 * Returns the string value.
 *
 * @throws Error if dimension has no values or invalid configuration
 */
export function resolveSelection(dimension: Dimension): string {
  if (dimension.values.length === 0) {
    throw new Error(
      `Dimension "${dimension.name}" (${dimension.id}) has no values to select from.`
    );
  }

  switch (dimension.selectionMode) {
    case "random":
      return weightedRandomPick(dimension.values);

    case "range":
      return rangePick(dimension);

    case "fixed":
      return fixedPick(dimension);

    case "sequential":
      return sequentialPick(dimension);

    default:
      throw new Error(
        `Unknown selectionMode "${dimension.selectionMode}" for dimension "${dimension.name}".`
      );
  }
}

/**
 * Pick multiple values from a dimension (for pickCount > 1).
 * Returns unique values unless the pool is smaller than count.
 */
export function resolveMultiSelection(
  dimension: Dimension,
  count: number
): string[] {
  if (count <= 0) return [];
  if (count === 1) return [resolveSelection(dimension)];

  const results: string[] = [];
  const available = [...dimension.values];

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    results.push(available[idx].value);
    available.splice(idx, 1); // remove to avoid duplicates
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal pick strategies
// ---------------------------------------------------------------------------

/**
 * Weighted random pick. If no weights, uniform distribution.
 */
function weightedRandomPick(values: DimensionValue[]): string {
  const totalWeight = values.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const v of values) {
    roll -= v.weight ?? 1;
    if (roll <= 0) {
      return v.value;
    }
  }

  // Fallback (shouldn't reach here)
  return values[values.length - 1].value;
}

/**
 * Range pick: select a random value within [rangeMin, rangeMax] indices.
 */
function rangePick(dimension: Dimension): string {
  const min = dimension.rangeMin ?? 0;
  const max = dimension.rangeMax ?? dimension.values.length - 1;

  const clampedMin = Math.max(0, Math.min(min, dimension.values.length - 1));
  const clampedMax = Math.max(clampedMin, Math.min(max, dimension.values.length - 1));

  const idx = clampedMin + Math.floor(Math.random() * (clampedMax - clampedMin + 1));
  return dimension.values[idx].value;
}

/**
 * Fixed pick: return the configured fixed value.
 * Falls back to first value if fixedValue is not set.
 */
function fixedPick(dimension: Dimension): string {
  if (dimension.fixedValue !== undefined && dimension.fixedValue !== null) {
    return dimension.fixedValue;
  }
  return dimension.values[0].value;
}

/**
 * Sequential pick: cycle through values in order.
 * State is maintained across calls via the sequentialCounters map.
 */
function sequentialPick(dimension: Dimension): string {
  const current = sequentialCounters.get(dimension.id) ?? 0;
  const value = dimension.values[current % dimension.values.length].value;
  sequentialCounters.set(dimension.id, current + 1);
  return value;
}

/**
 * Pick a random synonym from inline synonyms or synonym pools.
 * Returns original value if no synonyms available.
 */
export function pickSynonymExpansion(
  dimension: Dimension,
  selectedValue: DimensionValue
): string {
  // First try inline synonyms
  if (selectedValue.synonyms && selectedValue.synonyms.length > 0) {
    const allOptions = [selectedValue.value, ...selectedValue.synonyms];
    return allOptions[Math.floor(Math.random() * allOptions.length)];
  }

  // Then try synonym pools
  if (dimension.synonymPools && dimension.synonymPools.length > 0) {
    const pool = dimension.synonymPools[
      Math.floor(Math.random() * dimension.synonymPools.length)
    ];
    if (pool.entries.length > 0) {
      return pool.entries[Math.floor(Math.random() * pool.entries.length)];
    }
  }

  return selectedValue.value;
}
