import type { EnemyKind, ModifierId, WaveGroup } from './types';

const K: Record<string, EnemyKind> = { m: 'moth', c: 'crane', f: 'fox', s: 'serpent', t: 'tortoise', d: 'dragon' };

/** "m 12 .6 0" = kind, count, spawn interval (s), start delay (s). Groups separated by ';'. */
const HANDCRAFTED: string[] = [
  'm 8 .9 0',
  'm 12 .7 0',
  'm 10 .6 0;c 3 1.2 6',
  'c 8 .9 0;m 8 .5 8',
  'm 15 .45 0;c 6 .8 6',
  'c 10 .7 0;f 2 2 6',
  'm 20 .4 0;s 3 1.5 6',
  'f 6 1 0;c 8 .6 6',
  's 6 1.1 0;m 16 .35 7',
  't 3 2 0;f 4 1 6;d 1 1 14',
  'c 16 .5 0;s 6 1 5',
  'f 8 .9 0;t 3 2 6',
  'm 30 .25 0;s 8 .9 5;c 10 .5 12',
  't 5 1.8 0;f 6 1 8',
  's 10 .8 0;t 4 1.6 8;c 12 .4 14',
  'f 12 .7 0;s 8 .8 8',
  't 8 1.4 0;m 30 .2 6',
  'c 25 .3 0;f 10 .7 8;s 8 .9 14',
  't 10 1.2 0;f 10 .6 8',
  'd 1 1 0;t 6 1.5 5;s 10 .8 10',
  'f 16 .5 0;t 8 1.2 6;c 20 .3 12',
  's 16 .6 0;t 10 1 8',
  'm 50 .15 0;f 14 .5 5;t 10 1 10',
  't 14 .9 0;s 14 .6 8;f 12 .5 14',
  'd 2 6 0;t 12 .9 6;f 14 .5 10;s 12 .6 14',
  'c 40 .2 0;f 18 .45 6;t 14 .8 12',
  's 20 .5 0;t 16 .8 8;m 60 .12 14',
  'f 24 .4 0;t 16 .7 8;s 16 .5 14',
  'c 50 .15 0;t 18 .7 6;f 20 .4 12',
  'd 2 5 0;t 18 .7 4;s 22 .45 10;f 20 .4 16',
  'm 80 .1 0;s 26 .4 6;t 20 .65 12',
  'f 30 .35 0;t 22 .6 8;c 40 .2 14',
  's 30 .4 0;t 24 .55 8;f 26 .35 14',
  'd 3 4 0;t 24 .55 6;f 30 .3 12;s 26 .4 16',
  'c 70 .12 0;t 28 .5 6;s 30 .35 12',
  'f 36 .28 0;t 30 .5 8;s 30 .35 14',
  'm 100 .08 0;c 50 .15 6;t 32 .45 12;f 30 .3 16',
  't 36 .42 0;s 36 .3 8;f 36 .26 14',
  'd 3 3 0;t 36 .4 4;f 40 .25 10;s 40 .28 16;c 60 .12 20',
  'd 4 3 0;t 44 .35 4;f 46 .22 10;s 46 .25 16;c 80 .1 20;m 100 .06 24',
];

function parse(line: string): WaveGroup[] {
  return line.split(';').map((g) => {
    const [k, n, i, d] = g.trim().split(/\s+/);
    return { kind: K[k], count: Number(n), interval: Number(i), delay: Number(d) };
  });
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Endless procedural director for waves beyond the target. */
function endlessGroups(w: number, target: number): WaveGroup[] {
  const n = w - target;
  const r = rng(w * 7919 + 13);
  const kinds: EnemyKind[] = ['moth', 'crane', 'fox', 'serpent', 'tortoise'];
  const groups: WaveGroup[] = [];
  const picks = 3 + Math.min(2, Math.floor(n / 6));
  let delay = 0;
  for (let i = 0; i < picks; i++) {
    const kind = kinds[Math.floor(r() * kinds.length)];
    const base = kind === 'moth' ? 60 : kind === 'crane' ? 36 : kind === 'tortoise' ? 20 : 24;
    const count = Math.floor(base * (1 + n * 0.06) * (0.8 + r() * 0.4));
    const interval = Math.max(0.07, (kind === 'tortoise' ? 0.6 : 0.3) * Math.pow(0.97, n));
    groups.push({ kind, count, interval, delay });
    delay += 5 + r() * 4;
  }
  if (n % 5 === 0) groups.push({ kind: 'dragon', count: 1 + Math.floor(n / 10), interval: 4, delay: 2 });
  return groups;
}

export function getWaveGroups(w: number, target: number): WaveGroup[] {
  if (w > target || w > HANDCRAFTED.length) return endlessGroups(w, target);
  return parse(HANDCRAFTED[w - 1]);
}

const MOD_CYCLE: ModifierId[] = ['swift', 'iron', 'mist'];

/** A Corrupted Ink modifier activates on every 5th endless wave and persists until replaced. */
export function endlessModifier(w: number, target: number): { id: ModifierId | null; fresh: boolean } {
  const n = w - target;
  if (n < 5) return { id: null, fresh: false };
  return { id: MOD_CYCLE[(Math.floor(n / 5) - 1) % 3], fresh: n % 5 === 0 };
}
