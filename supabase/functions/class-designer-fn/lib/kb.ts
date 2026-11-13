// Kb.php 포팅: 기본값(JSON) + 관리자 덮어쓰기(DB kb_overrides) 병합과 입력 검증
// deno-lint-ignore-file no-explicit-any
import { isArr, trim } from './php.ts';
import { piiScan } from './pii.ts';
export const DATASETS: Record<string, { file: string; label: string }> = {
  knowledge: { file: 'bmr_knowledge.json', label: '별무리 지식 베이스 (AI 프롬프트)' },
  seed: { file: 'core_seed.json', label: '설계 세부 데이터 (가치·역량·주제·교과)' },
  rubric: { file: 'core_seed.json', label: '루브릭 시드 (수준·학년 단계)' },
};
export const SECTIONS: Record<string, Record<string, string>> = {
  seed: { goals: '교육목표', values: '핵심 가치·정의', competencies: '핵심 역량 + 요소(학년별 우수/보통/미흡)', topics: '핵심 주제(학년·선수·권장 가치)', subjects: '핵심 교과', tools: '평가 도구', methods: '교수법' },
  rubric: { levels: '루브릭 수준 이름', stages: '학년 단계 (기초·발전·심화)', stage_defs: '단계 정의 (블룸 초점·동사·적용 범위)', whereto: 'WHERETO 점검 항목', fourmat: '4MAT 구간' },
};
export const MAX_BYTES = 200000;
export const LEGACY_LEVELS: Record<string, string> = { '잘함': '우수', '노력 필요': '미흡' };
export type Overrides = Record<string, Record<string, any>>;

export class Kb {
  constructor(public files: Record<string, any>, public ov: Overrides = {}) {}
  defaults(file: string): any { return this.files[file] ?? {}; }
  sections(ds: string): Record<string, string> {
    if (ds === 'knowledge') { const o: Record<string, string> = {}; for (const k of Object.keys(this.defaults('bmr_knowledge.json'))) if (k !== '_meta') o[k] = k; return o; }
    return SECTIONS[ds] ?? {};
  }
  fileOf(ds: string): string { return DATASETS[ds]?.file ?? ''; }
  merged(file: string): any {
    const d: any = structuredClone(this.defaults(file));
    for (const [ds, m] of Object.entries(DATASETS)) if (m.file === file) for (const [sec, v] of Object.entries(this.ov[ds] ?? {}))
      if (Object.prototype.hasOwnProperty.call(this.sections(ds), sec) && Object.prototype.hasOwnProperty.call(d, sec)) d[sec] = v;
    return file === 'core_seed.json' ? Kb.normalizeLevels(d) : d;
  }
  static normalizeLevels(d: any): any {
    if (Array.isArray(d.levels)) d.levels = d.levels.map((x: any) => (typeof x === 'string' ? (LEGACY_LEVELS[x] ?? x) : x));
    for (const c of Array.isArray(d.competencies) ? d.competencies : []) for (const e of Array.isArray(c?.elements) ? c.elements : []) if (isArr(e))
      for (const [old, nw] of Object.entries(LEGACY_LEVELS)) if (Object.prototype.hasOwnProperty.call(e, old)) { if (e[nw] === undefined || e[nw] === null) e[nw] = e[old]; delete e[old]; }
    return d;
  }
  current(ds: string, sec: string): any { return this.merged(this.fileOf(ds))[sec] ?? null; }
  isOverridden(ds: string, sec: string): boolean { return this.ov[ds]?.[sec] !== undefined; }
  validate(ds: string, sec: string, raw: string): [any, string | null] {
    if (!DATASETS[ds] || !Object.prototype.hasOwnProperty.call(this.sections(ds), sec)) return [null, '알 수 없는 항목입니다.'];
    if (new TextEncoder().encode(raw).length > MAX_BYTES) return [null, '너무 깁니다 (최대 200KB).'];
    const def = this.defaults(this.fileOf(ds))[sec] ?? null; let v: any;
    if (typeof def === 'string') { v = trim(raw.replace(/\r\n/g, '\n')); if (v === '') return [null, '내용이 비었습니다.']; }
    else {
      try { v = JSON.parse(raw); } catch (e) { return [null, 'JSON 형식 오류: ' + (e as Error).message]; }
      if (!isArr(v) || !Object.keys(v).length) return [null, '목록/객체가 비었거나 형식이 다릅니다.'];
      const defList = Array.isArray(def) || def === null;
      if (Array.isArray(v) !== defList) return [null, '기본값과 구조가 다릅니다 (' + (defList ? '목록 [ ]' : '객체 { }') + ' 이어야 합니다).'];
      const e = this.schema(ds, sec, v); if (e) return [null, e];
    }
    const flat = typeof v === 'string' ? v : JSON.stringify(v);
    const pii = piiScan(flat);
    if (pii.length) return [null, '학생 개인정보로 보이는 내용이 있어 저장하지 않았습니다: ' + [...new Set(pii.map((p) => p.type))].join(', ')];
    if (/<\s*script/i.test(flat)) return [null, '스크립트 태그는 넣을 수 없습니다.'];
    return [v, null];
  }
  private schema(ds: string, sec: string, v: any): string | null {
    const str = (x: any) => typeof x === 'string' && trim(x) !== '';
    const strList = (v: any[]) => { for (let i = 0; i < v.length; i++) if (!str(v[i])) return (i + 1) + '번째 항목이 비었거나 문자열이 아닙니다.'; return new Set(v).size !== v.length ? '중복 항목이 있습니다.' : null; };
    const need = (v: any[], keys: string[]) => { for (let i = 0; i < v.length; i++) { const x = v[i]; if (!isArr(x)) return (i + 1) + '번째 항목이 객체가 아닙니다.'; for (const k of keys) if (x[k] === undefined || x[k] === null || (!str(x[k]) && !Number.isInteger(x[k]))) return (i + 1) + `번째 항목에 "${k}"가 없습니다.`; } return null; };
    if (ds === 'seed') switch (sec) {
      case 'subjects': case 'tools': case 'methods': return strList(v);
      case 'goals': return need(v, ['code', 'text']);
      case 'values': return need(v, ['code', 'def']);
      case 'topics': { const e = need(v, ['name', 'grade']); if (e) return e;
        for (let i = 0; i < v.length; i++) if (![10, 11, 12].includes(parseInt(String(v[i].grade), 10))) return (i + 1) + '번째 주제의 grade는 10·11·12 중 하나입니다.';
        return null; }
      case 'competencies': { const e = need(v, ['area', 'name']); if (e) return e;
        const stages = Object.keys(this.current('rubric', 'stages') ?? {});
        for (const x of v) { if (!Array.isArray(x.elements) || !x.elements.length) return `${x.name}: elements(요소 목록)가 필요합니다.`;
          const e2 = need(x.elements, ['stage', 'element', '우수', '보통', '미흡']); if (e2) return `${x.name} 요소 ${e2}`;
          for (const el of x.elements) if (stages.length && !stages.includes(el.stage)) return `${x.name}: stage는 ` + stages.join('·') + ' 중 하나입니다.'; }
        return null; }
    }
    if (ds === 'rubric') switch (sec) {
      case 'levels': return v.length !== 3 ? '수준은 정확히 3개여야 합니다.' : strList(v);
      case 'stage_defs': for (const [k, x] of Object.entries(v)) if (!str(k) || !isArr(x) || !str((x as any).bloom ?? '') || !str((x as any).focus ?? '')) return '단계마다 bloom(초점)과 focus(정의)를 쓰세요.'; return null;
      case 'stages': for (const [k, x] of Object.entries(v)) if (!str(k) || !str(x)) return '단계 이름과 학년을 모두 쓰세요.'; return null;
    }
    return null;
  }
  static editText(v: any): string { return typeof v === 'string' ? v : JSON.stringify(v, null, 4); }
}
