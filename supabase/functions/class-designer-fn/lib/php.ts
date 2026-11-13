// PHP 동작을 그대로 흉내 내는 작은 도우미들 (Core.php 포팅의 정확성을 위해).
// deno-lint-ignore-file no-explicit-any
export type Obj = Record<string, any>;

export const isArr = (v: any): v is Obj => v !== null && typeof v === 'object';
export const isList = (v: any): v is any[] => Array.isArray(v);
export const isScalar = (v: any): boolean => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

const WS = ' \t\n\r\0\x0B';
export function trim(s: string, chars: string = WS): string {
  let a = 0, b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}
/** PHP (string) 캐스트 (스칼라·null) */
export function toStr(v: any): string {
  if (v === null || v === undefined || v === false) return '';
  if (v === true) return '1';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  if (typeof v === 'string') return v;
  return 'Array';
}
export function mbSub(s: string, start: number, len?: number): string {
  const a = Array.from(s);
  return a.slice(start, len === undefined ? undefined : start + len).join('');
}
export const mbLen = (s: string): number => Array.from(s).length;
/** mb_substr(trim(is_scalar($v) ? (string)$v : ''), 0, $n) */
export const sub = (v: any, n: number): string => mbSub(trim(isScalar(v) ? toStr(v) : ''), 0, n);

/** PHP (int) 캐스트 */
export function toInt(v: any): number {
  if (v === null || v === undefined || v === false) return 0;
  if (v === true) return 1;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : 0;
  if (typeof v === 'string') {
    const m = /^[ \t\n\r\v\f]*([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?)/.exec(v);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  if (isArr(v)) return Object.keys(v).length ? 1 : 0;
  return 0;
}
export function toFloat(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const m = /^\s*([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?)/.exec(v); return m ? Number(m[1]) : 0; }
  if (v === true) return 1;
  return 0;
}
/** PHP 참/거짓 판정 */
export function truthy(v: any): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '' && v !== '0';
  if (Array.isArray(v)) return v.length > 0;
  if (isArr(v)) return Object.keys(v).length > 0;
  return true;
}
/** $a ?: $b */
export const elvis = <T, U>(a: T, b: U): T | U => (truthy(a) ? a : b);
/** array_values((array)$v) */
export function vals(v: any): any[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.slice();
  if (isArr(v)) return Object.values(v);
  return [v];
}
/** (array)$v 를 객체로 (키 접근용) */
export function obj(v: any): Obj {
  if (v === null || v === undefined) return {};
  if (isArr(v)) return v;
  return { 0: v };
}
export function own(o: any, k: any): any {
  if (!isArr(o)) return undefined;
  const key = toStr(k);
  return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}
export const has = (o: any, k: string): boolean => isArr(o) && Object.prototype.hasOwnProperty.call(o, k);
/** array_unique (문자열 비교, 첫 값 유지) */
export function unique<T>(a: T[]): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const x of a) { const k = toStr(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}
export function intersect<T>(a: T[], b: any[]): T[] { const s = new Set(b.map(toStr)); return a.filter((x) => s.has(toStr(x))); }
export function diff<T>(a: T[], b: any[]): T[] { const s = new Set(b.map(toStr)); return a.filter((x) => !s.has(toStr(x))); }
/** array_column($rows, $col) */
export function column(rows: any, col: string | number): any[] {
  const out: any[] = [];
  for (const r of vals(rows)) if (isArr(r) && Object.prototype.hasOwnProperty.call(r, String(col))) out.push((r as any)[col]);
  return out;
}
/** in_array strict */
export const inArr = (v: any, a: any[]): boolean => a.some((x) => x === v);
/** $o + $defaults (없는 키만 추가) */
export function plus(a: Obj, b: Obj): Obj { const o: Obj = { ...a }; for (const k of Object.keys(b)) if (!Object.prototype.hasOwnProperty.call(o, k)) o[k] = b[k]; return o; }
/** PHP strcasecmp(ASCII) === 0 */
export const ieq = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
/** Criteria::extractJson */
export function extractJson(text: string): any {
  let t = trim(text);
  const m = /```(?:json)?\s*([\s\S]+?)```/.exec(t);
  if (m) t = trim(m[1]);
  const tryJ = (s: string) => { try { const d = JSON.parse(s); return isArr(d) ? d : null; } catch { return null; } };
  let d = tryJ(t); if (d) return d;
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) { d = tryJ(t.slice(a, b + 1)); if (d) return d; }
  return null;
}
