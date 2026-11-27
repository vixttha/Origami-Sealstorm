/** Returns CJK text when a CJK font is available, otherwise a short Latin fallback (or empty string). */
const FALLBACK: Record<string, string> = {
  風: 'K', 火: 'F', 水: 'M', 土: 'T', 墨: 'S', 折: 'O', 守: 'G', 社: 'S', 勝: 'W', 敗: 'L',
  蒸: 'St', 嵐: 'Mo', 泥: 'Mu', 滲: 'Wa', 炎: 'Fi', 溶: 'Sl', 漆: 'Sc', 砂: 'Sa', 颪: 'Ga', 石: 'Pe',
  見習: 'I', 師範: 'II', 名人: 'III',
};

let cjk: boolean | null = null;

function detect(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return true;
    g.font = '40px "Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Noto Serif JP","MS Mincho",serif';
    const missing = g.measureText('\uFFFF').width;
    return g.measureText('風').width !== missing || g.measureText('墨').width !== missing;
  } catch {
    return true;
  }
}

export function glyph(s: string): string {
  if (cjk === null) cjk = detect();
  return cjk ? s : FALLBACK[s] ?? '';
}
