/**
 * Deterministically samples event IDs from a list of evidence event IDs.
 *
 * Immutability Guarantee: Input array is not modified.
 * Determinism Guarantee: Same input always produces identical sample array.
 */
export function sampleEventIds(eventIds: readonly string[], maxSamples: number): string[] {
  if (!eventIds || eventIds.length === 0) {
    return [];
  }

  if (eventIds.length <= maxSamples) {
    return [...eventIds];
  }

  if (maxSamples <= 1) {
    return [eventIds[0]!];
  }

  const indices = new Set<number>();
  indices.add(0); // first
  indices.add(eventIds.length - 1); // last

  const step = (eventIds.length - 1) / (maxSamples - 1);
  for (let i = 1; i < maxSamples - 1; i++) {
    const idx = Math.min(eventIds.length - 1, Math.round(i * step));
    indices.add(idx);
  }

  const sortedIndices = Array.from(indices).sort((a, b) => a - b);
  return sortedIndices.map((idx) => eventIds[idx]!);
}
