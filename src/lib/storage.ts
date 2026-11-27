import type { DifficultyId, MapId, ScoreEntry, ScoreLedger } from './types';

const SCORE_KEY = 'runic-origami-ledger-v1';
const CODEX_KEY = 'runic-origami-codex-v1';
const MUTE_KEY = 'runic-origami-mute-v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const scoreKey = (m: MapId, d: DifficultyId): string => `${m}:${d}`;

export function loadLedger(): ScoreLedger {
  return read<ScoreLedger>(SCORE_KEY, {});
}

export function recordRun(m: MapId, d: DifficultyId, wave: number, won: boolean, kills: number): void {
  const ledger = loadLedger();
  const k = scoreKey(m, d);
  const prev: ScoreEntry = ledger[k] ?? { bestWave: 0, won: false, kills: 0, runs: 0 };
  ledger[k] = {
    bestWave: Math.max(prev.bestWave, wave),
    won: prev.won || won,
    kills: Math.max(prev.kills, kills),
    runs: prev.runs + 1,
  };
  write(SCORE_KEY, ledger);
}

export function loadCodex(): string[] {
  return read<string[]>(CODEX_KEY, []);
}

export function markDiscovered(id: string): void {
  const cur = loadCodex();
  if (!cur.includes(id)) write(CODEX_KEY, [...cur, id]);
}

export function loadMuted(): boolean {
  return read<boolean>(MUTE_KEY, false);
}

export function saveMuted(m: boolean): void {
  write(MUTE_KEY, m);
}
