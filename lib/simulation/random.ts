export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Per-over seed derived from the session seed so both branches share it. */
export const overSeed = (seed: number, over: number) => (Math.imul(seed ^ 0x9e3779b9, 2654435761) + over * 7919) >>> 0;
