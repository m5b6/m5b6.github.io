import type { InmateId } from "@/lib/asylum/cast";

export function mix32(...values: number[]) {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash = (hash ^ (value | 0)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97) >>> 0;
    hash = (hash ^ (hash >>> 15)) >>> 0;
  }
  return hash >>> 0;
}

export function idSalt(id: InmateId) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export const BEAT_STRIDE = 7;

export function beatCursor(base: number, beat: number, stride = BEAT_STRIDE) {
  return base + beat * stride;
}

export function weightedIndex(weights: readonly number[], roll: number) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return 0;
  let cursor = roll % total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= Math.max(0, weights[index]);
    if (cursor < 0) return index;
  }
  return weights.length - 1;
}
