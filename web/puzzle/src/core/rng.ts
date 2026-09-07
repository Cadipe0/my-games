/* 시드 가능한 RNG. SPEC §5 — 로직 안에서 Math.random() 을 직접 부르지 않는다.
   테스트는 시드를 고정해서 같은 결과를 재현한다. */

export interface Rng {
  /** [0, 1) */
  next(): number;
}

/** mulberry32. 32비트 시드 하나로 재현 가능한 수열을 만든다 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** min 이상 max 이하 정수를 균등하게 뽑는다 */
export function nextInt(rng: Rng, min: number, max: number): number {
  if (max < min) throw new Error('nextInt: max < min');
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** 확률 p([0,1]) 로 참 */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** 배열에서 하나를 균등하게 고른다. 빈 배열이면 undefined */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(rng, 0, items.length - 1)];
}

/** 가중치에 비례해 하나를 고른다. 가중치 합이 0이면 undefined */
export function pickWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weightOf: (item: T) => number,
): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (total <= 0) return undefined;

  let roll = rng.next() * total;
  for (const item of items) {
    roll -= Math.max(0, weightOf(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** 원본을 건드리지 않고 섞은 새 배열을 돌려준다 (Fisher-Yates) */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
