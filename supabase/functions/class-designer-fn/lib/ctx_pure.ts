// 외부 의존성 없는 도우미 (단위 테스트에서도 불러옴)
// deno-lint-ignore-file no-explicit-any
/** 키 순서와 무관한 비교용 직렬화 (jsonb는 키 순서를 바꾼다) */
export function stable(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') { const k = Object.keys(v).sort(); return k.length ? '{' + k.map((x) => JSON.stringify(x) + ':' + stable(v[x])).join(',') + '}' : '[]'; }
  return JSON.stringify(v);
}
