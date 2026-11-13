// Core.php(별무리 중핵 수업 설계서 마법사) TypeScript 포팅. 순수 함수만 — DB·네트워크 없음.
// 시드(core_seed.json + 관리자 수정), 지식 베이스, 성취기준 원문 목록을 주입받는다.
// deno-lint-ignore-file no-explicit-any
import {
  column, diff, elvis, extractJson, has, ieq, inArr, intersect, isArr, isScalar, mbLen, mbSub, Obj, own, plus,
  sub, toInt, toStr, trim, truthy, unique, vals,
} from './php.ts';

export const PROMPT_VERSION = 'core-v3';
export const MAX_G = 8, MAX_R = 8, MAX_STD = 8;
export const EXTRA: Obj = { goal_add: 'goals', rubric_add: 'rubric' };
export const KB_MAP: Record<string, string[]> = {
  identity: ['purpose', 'goals', 'identity_rule', 'values', 'values_rule', 'orientation', 'noncurricular', 'design_process', 'examples'],
  question: ['purpose', 'goals', 'question_rule', 'topics', 'subjects', 'values', 'writing_rules', 'worldview_lens', 'topics', 'backward_design', 'examples'],
  topic: ['topics', 'values_by_topic', 'core_courses_2027'], subject: ['subjects', 'noncurricular', 'core_courses_2027'],
  values: ['purpose', 'goals', 'values', 'values_rule', 'values_by_topic'], competencies: ['competencies', 'rubric_guide', 'examples'],
  standards: ['standards_rule', 'subjects', 'noncurricular'], goals: ['goals', 'writing_rules', 'competencies', 'backward_design', 'examples'],
  task: ['writing_rules', 'project_model', 'orientation', 'backward_design', 'examples'],
  rubric: ['writing_rules', 'assessment', 'competencies', 'rubric_guide', 'methods', 'examples'],
  flow: ['ubd_4mat_whereto', 'credits', 'methods', 'assessment', 'worldview_lens', 'project_model'], whereto: ['ubd_4mat_whereto', 'backward_design', 'orientation', 'writing_rules'],
  std_search: ['standards_rule', 'subjects', 'noncurricular'],
  draft: ['goals', 'values', 'values_rule', 'values_by_topic', 'competencies', 'topics', 'subjects', 'writing_rules', 'assessment', 'credits', 'methods', 'ubd_4mat_whereto', 'worldview_lens', 'project_model', 'noncurricular', 'rubric_guide', 'backward_design', 'examples'],
};
export const STEPS: Record<string, [string, string]> = {
  start: ['시작 · 아이디어', 'input'], identity: ['정체성 · 핵심 가치', 'ai'],
  topic: ['핵심 주제 (1개)', 'ai'], prereq: ['선수과목', 'rule'], subject: ['핵심 교과 (1개)', 'ai'],
  question: ['핵심 질문 (주제·교과·가치 연결)', 'ai'],
  competencies: ['핵심 역량 (하위 역량)', 'ai'], standards: ['성취기준', 'ai'],
  goals: ['학습목표 G', 'ai'], task: ['수행과제', 'ai'], rubric: ['루브릭 R · 평가 도구 · 교수법', 'ai'],
  flow: ['4MAT 수업 흐름 · 교수법', 'ai'], whereto: ['WHERETO 점검', 'check'], output: ['설계서 출력', 'output'],
};
export const OLD_STEPS: Obj = { tools: 'rubric', methods: 'flow', values: 'identity' };
export const MAX_TOOLS = 3, MAX_METHODS = 2, CORE_V = 21;
export const APPLY_FIELDS = [
  'intent', 'course', 'grade', 'semester', 'credits', 'sessions',
  'identity.goals', 'identity.teacher_view', 'identity.student_view',
  'values', 'question', 'topic', 'subject', 'prereq', 'competencies',
];
export const CHAT_MAX = 1000, CHAT_TURNS = 10;
export const STD_LIMIT = 60, STD_CACHE_DAYS = 30;
export const PREFERRED_DOMAINS = ['ncic.re.kr', 'moe.go.kr', 'kice.re.kr', 'curri.ncic', 'edunet.net', 'go.kr'];
export const DRAFT_STEPS = ['topic', 'subject', 'values', 'competencies', 'standards', 'goals', 'task', 'rubric', 'flow'];
const stepOk = (k: string) => Object.prototype.hasOwnProperty.call(STEPS, k);

export class CoreError extends Error {}

export class Core {
  seed: Obj; kb: Obj; std: Obj[];
  constructor(seed: Obj, kb: Obj, std: Obj[]) {
    this.seed = seed; this.kb = kb;
    this.std = std.map((r) => plus(r, { verified: 1 }));
  }

  kbText(step: string): string {
    const kb = this.kb; const L: string[] = [];
    const secs: string[] = step === 'chat' ? Object.keys(kb).filter((k) => k !== '_meta')
      : (KB_MAP[step] ?? KB_MAP[own(EXTRA, step) ?? ''] ?? []);
    for (const sec of secs) {
      let v = own(kb, sec); if (v === null || v === undefined) continue;
      if (isArr(v)) {
        v = vals(v).map((x: any) => isArr(x)
          ? ('- ' + toStr(x.code ?? '') + ' ' + toStr(x.text ?? '') + ': ' + toStr(x.desc ?? x.def ?? '') + (x.points !== undefined && x.points !== null ? ' (' + vals(x.points).map(toStr).join('; ') + ')' : ''))
          : toStr(x)).join('\n');
      }
      L.push(`### ${sec}\n${toStr(v)}`);
    }
    return L.join('\n\n');
  }
  systemPrompt(step: string): string {
    return "당신은 별무리교육연구소의 수업 설계 전문가입니다. 별무리고등학교(기독교 대안학교) 교사가 중핵 수업 설계서를 쓰도록 돕습니다. "
      + "아래 '별무리 지식 베이스'에 근거해 추천하고, 지식 베이스에 없는 학교 규정은 지어내지 말고 [제안]이라고 표시하세요. 한국어로 답합니다. "
      + "백워드 설계(목표→평가→수업) 순서를 지키고 앞 단계 선택과 일관되게 추천하세요. 핵심 가치는 평가 요소가 아니라 수업의 방향입니다. "
      + "학생 개인정보를 요구하거나 만들지 마세요. 후보 목록이 주어지면 그 안에서만 고르세요. 성취기준 코드를 지어내지 마세요(모르면 \"[코드 확인]\"). "
      + "반드시 지정한 JSON만 출력하고, 선택지는 정확히 3개이며 서로 뚜렷이 달라야 합니다. 각 why는 지식 베이스 근거를 담은 한 문장.\n\n"
      + "## 별무리 지식 베이스\n교육목적: 하나님 나라를 위한 책임 있는 그리스도의 제자\n" + this.kbText(step);
  }
  // ---------- AI 논의 챗봇 ----------
  chatPrompt(c: Obj, title: string, history: Obj[], msg: string, stage = ''): { system: string; user: string } {
    const sys = "당신은 별무리교육연구소의 수업 설계 전문가이자 별무리 교육 전문가입니다. 별무리고등학교(기독교 대안학교) 교사와 중핵 수업 설계에 대해 대화합니다. "
      + "아래 지식 베이스와 현재 설계(또는 아직 저장 전인 아이디어)에 근거해 답하고, 없는 규정은 지어내지 말고 [제안]이라고 표시하세요. 백워드 설계와 일관성을 살피세요. "
      + "핵심 가치는 평가 요소가 아니라 수업의 방향입니다. 성취기준 코드를 지어내지 마세요. 학생 개인정보를 요구·생성하지 마세요. "
      + "설계를 조용히 바꾸지 마세요. 칸을 고쳐야 하면 propose에 허용 필드 하나만 넣고, 교사가 미리보기에서 적용할지 고르게 합니다. "
      + "허용 필드: " + APPLY_FIELDS.join(', ') + ". 한국어로 짧게. "
      + "반드시 JSON만 출력: {\"reply\":\"답변\"} 또는 {\"reply\":\"답변\",\"propose\":{\"field\":\"question\",\"value\":\"제안 값\",\"label\":\"표시 이름\"}}.\n\n## 별무리 지식 베이스\n교육목적: 하나님 나라를 위한 책임 있는 그리스도의 제자\n" + this.kbText('chat');
    let h = '';
    for (const m of history.slice(-CHAT_TURNS)) h += (m.role === 'user' ? '교사: ' : '전문가: ') + mbSub(toStr(m.content), 0, 800) + '\n';
    let ctx = this.contextText(c, title);
    if (mbLen(ctx) > 2500) ctx = mbSub(ctx, 0, 2500) + '\\n…(생략)';
    const u = (stage !== '' ? `## 지금 단계\n${stage}\n\n` : '') + '## 지금까지의 설계\n' + ctx + '\n\n' + (h !== '' ? `## 앞선 대화\n${h}\n` : '') + '## 교사의 질문\n' + msg + '\n';
    return { system: sys, user: u };
  }
  static chatParse(out: string): { reply: string; propose: Obj | null } {
    const dec = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
    let j = dec(out);
    if (!isArr(j)) { const m = /\{[\s\S]*\}/.exec(out); if (m) j = dec(m[0]); }
    let r = trim(out);
    if (isArr(j)) {
      r = '';
      for (const k of ['reply', 'answer', 'message', 'response', 'text', 'content']) { const v = (j as any)[k]; if (typeof v === 'string' && trim(v) !== '' && has(j, k)) { r = v; break; } }
      if (r === '') {
        const parts: string[] = [];
        const walk = (v: any) => { if (isArr(v)) { for (const x of vals(v)) walk(x); } else if (typeof v === 'string' && mbLen(trim(v)) > 1) parts.push(trim(v)); };
        walk(j); r = parts.join('\n');
      }
    }
    const reply = mbSub(trim(r) !== '' ? trim(r) : '답을 만들지 못했습니다. 질문을 바꿔 다시 물어 주세요.', 0, 6000);
    let propose: Obj | null = null;
    if (isArr(j) && isArr((j as any).propose)) propose = Core.cleanPropose((j as any).propose);
    return { reply, propose };
  }
  static cleanPropose(p: any): Obj | null {
    if (!isArr(p)) return null;
    const field = trim(toStr(isScalar(p.field) ? p.field : (p.field ?? '')));
    if (!inArr(field, APPLY_FIELDS)) return null;
    const label = elvis(mbSub(trim(toStr(p.label ?? field)), 0, 80), field);
    let value = p.value ?? null;
    if (typeof value === 'string') value = mbSub(trim(value), 0, 800);
    else if (isArr(value)) value = vals(value).filter(isScalar).slice(0, 8);
    else return null;
    return { field, value, label };
  }
  applyField(c: Obj, field: string, value: any): Obj {
    if (!inArr(field, APPLY_FIELDS)) throw new CoreError('허용되지 않은 필드');
    const inp: Obj = { ...c };
    const s = (v: any, d = '') => (isScalar(v) ? toStr(v) : d);
    const arr = (v: any) => (v === null || v === undefined ? [] : isArr(v) ? v : [v]);
    if (field === 'intent') inp.intent = s(value);
    else if (field === 'course') inp.course = s(value);
    else if (field === 'grade') inp.grade = toInt(value);
    else if (field === 'semester') inp.semester = s(value, '1');
    else if (field === 'credits') inp.credits = toInt(value);
    else if (field === 'sessions') inp.sessions = toInt(value);
    else if (field === 'question') { inp.question = s(value); inp.question_basis = { topic: c.topic, subject: c.subject, values: c.values }; }
    else if (field === 'topic') inp.topic = s(value);
    else if (field === 'subject') inp.subject = s(value);
    else if (field === 'prereq') inp.prereq = arr(value);
    else if (field === 'values') inp.values = arr(value);
    else if (field === 'competencies') inp.competencies = arr(value);
    else if (field.startsWith('identity.')) {
      inp.identity = { ...(c.identity ?? {}) }; const k = field.slice(9);
      inp.identity[k] = k === 'goals' ? arr(value) : s(value);
    }
    const out = this.sanitize(inp);
    out.step = c.step ?? out.step;
    return out;
  }
  static questionNeedsReview(c: Obj): boolean {
    if ((c.question ?? '') === '') return false;
    const b = c.question_basis ?? { topic: '', subject: '', values: [] };
    const va = vals(b.values ?? []).map(toStr).sort(); const vb = vals(c.values ?? []).map(toStr).sort();
    return (b.topic ?? '') !== (c.topic ?? '') || (b.subject ?? '') !== (c.subject ?? '') || JSON.stringify(va) !== JSON.stringify(vb);
  }
  static mockChat(c: Obj, msg: string): { reply: string } {
    const q = c.question !== '' ? `핵심 질문 "${c.question}"` : '아직 핵심 질문이 없는 설계';
    return { reply: '[Alter 모의 응답] "' + mbSub(msg, 0, 60) + `"에 대해: ${q}를 기준으로 보면, 학습목표(G)마다 루브릭(R)이 하나씩 연결되는지 먼저 확인해 보세요.\n- 핵심 가치(` + elvis(c.values.join(', '), '미정') + ')는 평가하지 않고 수업 방향으로만 씁니다.\n- 하위 역량(' + elvis(c.competencies.join(', '), '미정') + ')은 학년 단계 요소와 맞춰 우수/보통/미흡를 쓰면 좋습니다.' };
  }
  static stepKeys(): string[] { return Object.keys(STEPS); }
  static nextStep(step: string): string | null { const k = Core.stepKeys(); const i = k.indexOf(step); return i === -1 ? null : (k[i + 1] ?? null); }

  empty(): Obj {
    const fm = vals(this.seed.fourmat ?? []); const rg = this.flowRanges(36);
    return {
      v: CORE_V, grade: 10, semester: '1', credits: 2, sessions: 36, course: '', intent: '', identity: { goals: [], teacher_view: '', student_view: '' }, question: '',
      topic: '', prereq: [], subject: '', values: [], competencies: [], standards: [], goals: [],
      task: { text: '', role: '', audience: '', product: '' }, tools: [], rubric: [], methods: [],
      flow: fm.map((f: any, i: number) => ({ k: f.k, sessions: rg[i] ?? null, activity: '', r: [], methods: [] })),
      whereto: [], question_basis: { topic: '', subject: '', values: [] }, step: 'start', sources: {},
    };
  }
  flowRanges(total: number): string[] {
    const fm = vals(this.seed.fourmat ?? []); if (!fm.length) return [];
    const base = Math.max(1, toInt(fm[fm.length - 1].to)); total = Math.max(fm.length, total); const out: string[] = []; let prev = 0; const n = fm.length;
    fm.forEach((f: any, i: number) => {
      let to = i === n - 1 ? total : Math.round(toInt(f.to) * total / base);
      to = Math.max(prev + 1, Math.min(to, total - (n - 1 - i)));
      out.push((prev + 1) === to ? String(to) : (prev + 1) + '–' + to); prev = to;
    });
    return out;
  }
  static cleanRange(v: any): string | null {
    let s = isScalar(v) ? toStr(v) : '';
    s = trim(s.replace(/[-~—]/g, '–').replace(/ /g, ''));
    const m = /^(\d{1,3})(?:–(\d{1,3}))?$/.exec(s); if (!m) return null;
    const a = parseInt(m[1], 10); const b = m[2] !== undefined ? parseInt(m[2], 10) : a;
    return a >= 1 && b >= a ? (a === b ? String(a) : `${a}–${b}`) : null;
  }
  toolName(v: any): string {
    const s0 = trim(isScalar(v) ? toStr(v) : ''); if (s0 === '') return '';
    const tools: string[] = vals(this.seed.tools ?? []);
    if (inArr(s0, tools)) return s0;
    const m = own(this.seed.tool_legacy ?? {}, s0); if (m !== undefined && m !== null && inArr(m, tools)) return m;
    for (const t of tools) { const mm = /\(([A-Z]{2,4})\)/.exec(t); if (mm && ieq(mm[1], s0)) return t; }
    return '';
  }
  toolList(v: any, max = MAX_TOOLS): string[] {
    return unique(vals(v).filter(isScalar).map((x) => this.toolName(x)).filter(truthy)).slice(0, max);
  }
  methodList(v: any, max = MAX_METHODS): string[] {
    const m = vals(this.seed.methods ?? []);
    return unique(vals(v).filter(isScalar).map((x) => trim(toStr(x))).filter((x) => inArr(x, m))).slice(0, max);
  }
  recommendedTools(comp: string): string[] {
    for (const cp of vals(this.seed.competencies)) if (cp.name === comp) return this.toolList(cp.tools ?? [], 20);
    return [];
  }
  rowRecommended(r: Obj, c: Obj): string[] {
    if ((r.competency ?? '') !== '') return this.recommendedTools(r.competency);
    const cs = truthy(c.competencies) ? vals(c.competencies) : [''];
    return unique(cs.flatMap((x: any) => this.recommendedTools(x)));
  }
  toolSummary(c: Obj): Obj {
    const o: Obj = {}; for (const r of vals(c.rubric)) for (const t of vals(r.tools ?? [])) (o[t] ??= []).push(r.key);
    return o;
  }
  methodSummary(c: Obj): Obj {
    const o: Obj = {};
    for (const f of vals(c.flow)) for (const m of vals(f.methods ?? [])) (o[m] ??= []).push(f.k);
    for (const r of vals(c.rubric)) for (const m of vals(r.methods ?? [])) (o[m] ??= []).push(r.key);
    for (const k of Object.keys(o)) o[k] = unique(o[k]);
    return o;
  }
  designRecommended(c: Obj): string[] {
    const o = new Set<string>(); for (const cp of vals(c.competencies ?? [])) for (const t of this.recommendedTools(toStr(cp))) o.add(t);
    return [...o];
  }
  static summaryText(sum: Obj): string {
    return Object.keys(sum).map((k) => k + ' (' + vals(sum[k]).join('·') + ')').join(', ');
  }
  // ---------- 규칙 ----------
  topic(name: string): Obj | null { for (const t of vals(this.seed.topics)) if (t.name === name) return t; return null; }
  topicsForGrade(g: number): Obj[] { return vals(this.seed.topics).filter((t: any) => toInt(t.grade) === g); }
  prereqFor(topic: string): Obj { const t = this.topic(topic); return t ? { prereq: t.prereq, next: t.next } : { prereq: [], next: null }; }
  valuesFor(topic: string): any[] { return this.topic(topic)?.values ?? []; }
  stdSubjects(subject: string, grade = 10): string[] {
    const m = own(this.seed.std_subject_map ?? {}, subject);
    if (!truthy(m)) return [subject];
    return unique(grade <= 10 ? [...vals(m.common), ...vals(m.elective)] : [...vals(m.elective), ...vals(m.common)]);
  }
  static stdLabel(r: Obj): string {
    return trim(toStr(r.source_title ?? '') + (truthy(r.source_page) ? ', p.' + toInt(r.source_page) + '~ (과목 시작 쪽)' : ''));
  }
  stdRow(r: Obj): Obj {
    const src = Core.cleanSources([{ title: Core.stdLabel(r), uri: toStr(r.source_url ?? '') }]);
    return { code: toStr(r.code), text: toStr(r.text), subject: toStr(r.subject), domain: toStr(r.domain ?? ''),
      course_type: toStr(r.course_type ?? ''), status: truthy(r.verified) ? 'ncic' : 'unverified', source: Core.stdLabel(r), sources: src };
  }
  standardsFor(subject: string, grade = 10, limit = STD_LIMIT): Obj[] {
    const subs = this.stdSubjects(subject, grade); if (!subs.length) return [];
    const rows = this.std.filter((r) => inArr(r.subject, subs));
    if (!rows.length) {
      const old = vals(own(this.seed.subject_std_map ?? {}, subject) ?? [subject]);
      return vals(this.seed.standards ?? []).filter((x: any) => inArr(x.subject, old)).map((x: any) => plus(x, { status: 'seed', sources: [], source: '학교 시드 데이터' }));
    }
    const pos = new Map<string, number>(); subs.forEach((s, i) => pos.set(s, i));
    const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const sorted = rows.slice().sort((a, b) => ((pos.get(a.subject) ?? 99) - (pos.get(b.subject) ?? 99)) || cmpStr(toStr(a.code), toStr(b.code)));
    return sorted.map((r) => this.stdRow(r)).slice(0, limit);
  }
  stdByCodes(codes: any[]): Record<string, Obj> {
    const cs = unique(codes.map((x) => toStr(x)).filter((c) => /^\[[^\]]{3,30}\]$/u.test(c)));
    const out: Record<string, Obj> = Object.create(null);
    if (!cs.length) return out;
    const set = new Set(cs);
    for (const r of this.std) if (set.has(r.code) && !(r.code in out)) out[r.code] = this.stdRow(r);
    return out;
  }
  static stageForGrade(g: number): string { return ({ 10: '기초', 11: '발전', 12: '심화' } as Record<number, string>)[g] ?? '기초'; }
  compNames(): string[] { return column(this.seed.competencies, 'name'); }
  element(comp: string, grade: number): Obj | null {
    for (const c of vals(this.seed.competencies)) if (c.name === comp) for (const e of vals(c.elements)) if (e.stage === Core.stageForGrade(grade)) return plus(e, { competency: comp });
    return null;
  }
  // ---------- 정리 (클라이언트 입력 화이트리스트) ----------
  sanitize(inp: Obj): Obj {
    const s = this.seed; const str = (v: any, n = 1000) => sub(v, n);
    const list = (v: any, n: number, len = 200) => unique(vals(v).filter(isScalar).slice(0, n).map((x) => str(x, len)).filter((x) => x !== ''));
    const o = this.empty();
    const gr = toInt(inp.grade ?? 10); o.grade = inArr(gr, [10, 11, 12]) ? gr : 10;
    o.credits = Math.max(1, Math.min(8, toInt(inp.credits ?? 2)));
    o.semester = elvis(str(inp.semester ?? '1', 10), '1');
    o.sessions = Math.max(4, Math.min(200, elvis(toInt(inp.sessions ?? (o.credits * 18)), o.credits * 18)));
    const legacy = toInt(inp.v ?? 0) < CORE_V;
    o.course = str(inp.course ?? '', 60); o.intent = str(inp.intent ?? '', 800);
    const id = toObj(inp.identity ?? []);
    o.identity = { goals: intersect(column(s.goals, 'code'), list(id.goals ?? [], 3, 2)), teacher_view: str(id.teacher_view ?? '', 600), student_view: str(id.student_view ?? '', 600) };
    o.question = str(inp.question ?? '', 300);
    o.topic = str(inp.topic ?? '', 60);
    o.prereq = list(inp.prereq ?? [], 4, 60);
    o.subject = str(inp.subject ?? '', 40);
    o.values = intersect(column(s.values, 'code'), list(inp.values ?? [], 2, 10));
    o.competencies = intersect(this.compNames(), list(inp.competencies ?? [], 3, 30));
    for (const x of vals(inp.standards ?? []).slice(0, MAX_STD)) if (isArr(x) && str(x.text ?? '') !== '') {
      o.standards.push({ code: elvis(str(x.code ?? '', 40), '[코드 확인]'), text: str(x.text ?? '', 500),
        status: inArr(x.status ?? '', ['ncic', 'grounded', 'seed', 'unverified', 'teacher']) ? x.status : 'teacher', sources: Core.cleanSources(x.sources ?? []) });
    }
    if (o.standards.length) {
      const db = this.stdByCodes(column(o.standards, 'code'));
      for (const sx of o.standards) if (sx.status === 'ncic') { const r = db[sx.code];
        if (r && r.text === sx.text) sx.sources = r.sources; else sx.status = 'teacher'; }
    }
    vals(inp.goals ?? []).filter((x: any) => isArr(x) && str(x.text ?? '') !== '').slice(0, MAX_G).forEach((x: any, i: number) => o.goals.push({ key: 'G' + (i + 1), ...this.goalTarget(x) }));
    const t = toObj(inp.task ?? []); for (const [k, n] of [['text', 600], ['role', 100], ['audience', 100], ['product', 150]] as [string, number][]) o.task[k] = str(t[k] ?? '', n);
    vals(inp.rubric ?? []).slice(0, MAX_R).forEach((x0: any, i: number) => {
      if (!isArr(x0)) return; let x = x0 as Obj;
      if (legacy) x = plus(x, { tools: [] });
      o.rubric.push({ key: 'R' + (i + 1), ...this.rubricRow(x, o.goals, o.grade, o) });
    });
    const rk = column(o.rubric, 'key'); const fin = new Map<string, Obj>();
    for (const f of vals(inp.flow ?? [])) if (isArr(f)) fin.set(toStr(f.k ?? ''), f);
    const def = this.flowRanges(o.sessions); const sameTotal = toInt(inp.sessions ?? 36) === o.sessions;
    o.flow.forEach((f: Obj, i: number) => {
      const x = fin.get(toStr(f.k)) ?? {}; f.activity = str(x.activity ?? '', 800); f.r = intersect(rk, list(x.r ?? [], MAX_R, 3));
      f.sessions = (sameTotal ? Core.cleanRange(x.sessions ?? '') : null) ?? (def[i] ?? f.sessions); f.methods = this.methodList(x.methods ?? []);
    });
    if (legacy) {
      const gt = this.toolList(inp.tools ?? []); const gm = this.methodList(inp.methods ?? []);
      if (gt.length && !column(o.rubric, 'tools').some(truthy)) for (const r of o.rubric) r.tools = gt;
      if (gm.length && !column(o.flow, 'methods').some(truthy)) for (const f of o.flow) if (f.activity !== '') f.methods = gm;
    }
    o.tools = Object.keys(this.toolSummary(o)); o.methods = Object.keys(this.methodSummary(o));
    o.whereto = intersect(column(s.whereto, 0), list(inp.whereto ?? [], 7, 3));
    const stIn = inp.step ?? '';
    const st = own(OLD_STEPS, stIn) ?? stIn; o.step = isScalar(st) && stepOk(toStr(st)) ? toStr(st) : 'start';
    const srcIn = inp.sources ?? [];
    const entries: [string, any][] = isArr(srcIn) ? Object.entries(srcIn) : (srcIn === null ? [] : [['0', srcIn]]);
    for (const [k, v] of entries) {
      const sk = own(OLD_STEPS, k) ?? k;
      if (stepOk(sk)) o.sources[sk] = inArr(v, ['ai', 'ai_edited', 'ai_draft', 'teacher', 'rule']) ? v : 'teacher';
    }
    const qb = toObj(inp.question_basis ?? []);
    o.question_basis = { topic: str(qb.topic ?? '', 60), subject: str(qb.subject ?? '', 40), values: intersect(column(s.values, 'code'), list(qb.values ?? [], 2, 10)) };
    if (o.question !== '' && o.question_basis.topic === '' && o.question_basis.subject === '' && !o.question_basis.values.length) {
      o.question_basis = { topic: o.topic, subject: o.subject, values: o.values };
    }
    return o;
  }
  static cleanSources(v: any): Obj[] {
    const out: Obj[] = [];
    for (const x of vals(v).filter(isArr).slice(0, 5)) {
      const u = mbSub(trim(toStr(isScalar(x.uri) ? x.uri : (x.uri ?? ''))), 0, 1000);
      if (!/^https?:\/\/[^\s"<>]+$/i.test(u)) continue;
      let host = ''; try { host = new URL(u).hostname; } catch { host = ''; }
      out.push({ title: elvis(mbSub(trim(toStr(isScalar(x.title) ? x.title : (x.title ?? ''))), 0, 200), elvis(host, '출처')), uri: u });
    }
    return out;
  }
  // ---------- AI 프롬프트 ----------
  contextText(c: Obj, title = ''): string {
    const s = this.seed; const gn: Obj = {}; for (const g of vals(s.goals)) gn[g.code] = g.text; const L: string[] = [];
    L.push('과목명: ' + elvis(c.course, title) + ` / 학년: ${c.grade} / ${c.semester}학기 / 학점: ${c.credits} (총 ${c.sessions}차시, 쿼터마다 8주차 평가·9주차 발표회)`);
    if (truthy(c.intent)) L.push('교사의 한 줄 의도: ' + c.intent);
    if (truthy(c.identity.goals)) L.push('교육목표: ' + c.identity.goals.map((g: any) => own(gn, g) ?? g).join('; '));
    if (truthy(c.identity.teacher_view)) L.push('교사관: ' + c.identity.teacher_view);
    if (truthy(c.identity.student_view)) L.push('학생관: ' + c.identity.student_view);
    if (truthy(c.topic)) L.push('핵심 주제: ' + c.topic + (truthy(c.prereq) ? ' (선수: ' + c.prereq.join(', ') + ')' : ''));
    if (truthy(c.subject)) L.push('핵심 교과: ' + c.subject);
    if (truthy(c.values)) L.push('핵심 가치(평가하지 않음): ' + c.values.join(', '));
    if (truthy(c.question)) L.push('핵심 질문: ' + c.question);
    if (truthy(c.competencies)) L.push('핵심 역량: ' + c.competencies.join(', '));
    for (const x of c.standards) L.push(`성취기준: ${x.code} ${x.text}`);
    for (const x of c.goals) L.push(`${x.key}: ${x.text}`);
    if (truthy(c.task.text)) L.push(`수행과제: ${c.task.text} (역할 ${c.task.role}, 청중 ${c.task.audience}, 산출물 ${c.task.product})`);
    for (const r of c.rubric) L.push(`${r.key}(${r.goal}, ${r.competency}-${r.element}): ${r.criterion} / A ${r.A} / B ${r.B} / C ${r.C} / 도구 ` + elvis(vals(r.tools ?? []).join(','), '-') + ' / 교수법 ' + elvis(vals(r.methods ?? []).join(','), '-'));
    for (const f of c.flow) if (truthy(f.activity)) L.push(`4MAT ${f.k} (${f.sessions}차시): ${f.activity} [` + f.r.join(',') + '] 교수법 ' + elvis(vals(f.methods ?? []).join(','), '-'));
    const t = this.toolSummary(c); if (Object.keys(t).length) L.push('평가 도구 모음(자동): ' + Core.summaryText(t));
    const m = this.methodSummary(c); if (Object.keys(m).length) L.push('교수법 모음(자동): ' + Core.summaryText(m));
    return L.join('\n');
  }
  prompt(step: string, c: Obj, title = ''): { system: string; user: string } {
    const s = this.seed;
    const sys = this.systemPrompt(step);
    let u = '## 지금까지의 설계\n' + this.contextText(c, title) + '\n\n## 요청\n';
    const opt = (fields: string) => '형식: {"options":[{' + fields + ',"why":"이유"}]}';
    switch (step) {
      case 'identity':
        u += '교육목표 후보: ' + vals(s.goals).map((g: any) => `${g.code}=${g.text}`).join(' / ') + '\n가치 후보: ' + vals(s.values).map((v: any) => `${v.code}=${v.def}`).join(', ')
          + '\n수업 아이디어·학년·의도에 맞는 정체성 3가지를 제안하세요. goals는 교육목표 번호 1–2개, values는 핵심 가치 1–2개(평가하지 않음, 수업 방향), teacher_view·student_view는 가치와 아이디어를 반영한 구체적 은유 한 문장. 교사관·학생관은 제안일 뿐이며 교사가 직접 고치거나 적용을 고릅니다. '
          + opt('"goals":["2"],"values":["샬롬"],"teacher_view":"교사관 한 문장","student_view":"학생관 한 문장"'); break;
      case 'question':
        u += '학생이 학기 내내 붙들 핵심 질문 3개를 제안하세요. 핵심 질문은 앞에서 정한 핵심 주제(' + elvis(c.topic, '미정') + ')·핵심 교과(' + elvis(c.subject, '미정') + ')·핵심 가치(' + elvis(c.values.join(', '), '미정') + ') 세 가지를 하나로 잇는 질문이어야 합니다: 주제를 탐구하고, 교과의 개념·방법으로 답을 찾으며, 가치를 품습니다. 정답이 하나가 아닌, 학생 말투의 20자 안팎 열린 질문이며 교육목표·교사관·학생관과도 이어져야 합니다. why에는 주제·교과·가치가 질문에 각각 어떻게 들어 있는지 한 문장으로 쓰세요. ' + opt('"value":"핵심 질문"'); break;
      case 'goal_add':
        u += '지금 학습목표에 더할 학습목표 1개를 3가지 후보로 제안하세요. 기존 G와 겹치지 않고, "나는 ~할 수 있다" 형식의 관찰 가능한 문장, std는 위 성취기준 코드 중 하나(없으면 빈 값). ' + opt('"goal":{"text":"학습목표","std":"코드"}'); break;
      case 'rubric_add': {
        const gk = column(c.goals, 'key'); const hasG = column(c.rubric, 'goal'); const miss = diff(gk, hasG);
        const els = (truthy(c.competencies) ? c.competencies : this.compNames()).map((n: string) => this.element(n, c.grade)).filter(truthy) as Obj[];
        u += '루브릭이 없는 목표: ' + elvis(miss.join(', '), '없음(기존 목표 중 하나)') + '\n역량 요소: ' + els.map((e) => `${e.competency}-${e.stage}·${e.element}`).join('; ') + '\n' + this.toolPromptText(c)
          + '\n추가할 루브릭 1행을 3가지 후보로 제안하세요. goal은 ' + elvis((miss.length ? miss : gk).join('/'), 'G1') + ' 중 하나(평가 대상은 그 G에 연결된 역량 또는 성취기준 1개로 고정, competency 칸은 비워도 됨), A·B·C는 수·질·독립성 중 하나로 차이. tools는 그 역량의 권장 도구 중심으로 1–3개, methods는 교수법 1–2개. '
          + opt('"row":{"goal":"G1","competency":"하위 역량","criterion":"평가 항목","A":"","B":"","C":"","tools":["도구"],"methods":["교수법"]}'); break;
      }
      case 'topic':
        u += `${c.grade}학년 핵심 주제 후보: ` + this.topicsForGrade(c.grade).map((t) => t.name + (truthy(t.values) ? '(권장 가치 ' + vals(t.values).join('·') + ')' : '')).join(', ') + '\n교사의 의도·교육목표·교사관·학생관에 가장 잘 맞는 주제 3개를 순서대로 고르세요. 주제가 정해지면 교과를 거쳐, 정체성에서 고른 가치와 함께 핵심 질문으로 이어집니다. ' + opt('"value":"주제명"'); break;
      case 'subject':
        u += '핵심 교과 후보: ' + vals(s.subjects).join(', ') + '\n핵심 주제를 교과 안에서 가장 잘 다룰 교과 3개를 고르세요. ' + opt('"value":"교과명"'); break;
      case 'values': {
        const rec = vals(this.valuesFor(c.topic));
        u += '가치 후보: ' + vals(s.values).map((v: any) => `${v.code}=${v.def}`).join(', ') + (rec.length ? '\n주제별 권장 가치: ' + rec.join(', ') : '') + '\n핵심 주제(' + elvis(c.topic, '미정') + ')·핵심 교과(' + elvis(c.subject, '미정') + ')가 있으면 참고하되 주제 뒤로 미루지 마세요(앱 v21: 정체성 단계에서 선정). 교사의 의도·교육목표·교사관·학생관에 맞는 가치 조합(1–2개) 3가지를 제안하세요. ' + opt('"values":["가치"]'); break;
      }
      case 'competencies':
        u += '하위 역량 후보: ' + this.compNames().join(', ') + '\n핵심 질문·주제·교과에 맞는 하위 역량 조합(2–3개) 3가지를 제안하세요. ' + opt('"values":["하위 역량"]'); break;
      case 'standards': {
        const cand = this.standardsFor(c.subject, c.grade, 40);
        if (cand.length) u += '성취기준 후보(교육부 고시 원문 DB, 코드 고정):\n' + cand.map((x) => `${x.code} (${x.subject}) ${x.text}`).join('\n') + '\n후보 중 이 수업에 맞는 성취기준 묶음(1–3개) 3가지를 고르세요. ' + opt('"codes":["코드"]');
        else u += '이 교과의 성취기준 데이터가 없습니다. 2022 개정 교육과정 수준의 성취기준 문장 3개를 제안하되 code는 반드시 "[코드 확인]"으로 두세요. ' + opt('"code":"[코드 확인]","text":"성취기준 문장"');
        break;
      }
      case 'goals':
        u += '성취기준·역량·핵심 질문에 맞는 학습목표 세트(G 3–4개, "나는 ~할 수 있다"로 끝나는 관찰 가능한 문장) 3가지를 제안하세요. 각 G는 평가 대상 1개에만 연결합니다: type은 "competency"(고른 하위 역량: ' + c.competencies.join(', ') + ') 또는 "standard"(고른 성취기준 코드: ' + column(c.standards, 'code').join(', ') + ') 중 하나, target은 그 이름/코드 1개(둘 다·여러 개 금지). ' + opt('"goals":[{"text":"학습목표","type":"competency|standard","target":"역량 이름 또는 성취기준 코드"}]'); break;
      case 'task':
        u += '학습목표를 증명할 수행과제 3가지를 제안하세요. 역할·청중·산출물이 드러나야 합니다(예: 후배 멘토가 되어 · 9학년에게 · 가이드 포스터를 만든다). ' + opt('"text":"과제 한 문장","role":"역할","audience":"청중","product":"산출물"'); break;
      case 'rubric': {
        const els = c.competencies.map((n: string) => this.element(n, c.grade)).filter(truthy) as Obj[];
        u += '연결할 역량 루브릭 요소(학년 단계 고정):' + '\n' + els.map((e) => `- ${e.competency}-${e.stage}·${e.element}: 우수 ${e['우수']} / 보통 ${e['보통']} / 미흡 ${e['미흡']}`).join('\n')
          + '\n학습목표 1개당 1행의 루브릭 세트 3가지를 제안하세요. goal은 G번호이며, 평가 대상은 그 G에 연결된 1개로 고정됩니다(' + c.goals.map((g: Obj) => `${g.key}→` + (g.tt === 'competency' ? '역량 ' : '성취기준 ') + g.target).join('; ') + '). 역량 G는 위 학년 단계 요소에 맞추고, 성취기준 G는 그 성취기준 도달 정도로 쓰세요. competency 칸은 비워도 됩니다, A 우수·B 보통·C 미흡는 수·질·독립성 중 하나로 관찰 가능한 차이를 쓰세요. 평가 도구는 따로 정하지 않고 행마다 tools 1–3개(그 역량의 권장 도구 우선), methods는 그 R을 기르는 교수법 1–2개.\n' + this.toolPromptText(c) + '\n'
          + opt('"rows":[{"goal":"G1","competency":"하위 역량","criterion":"평가 항목","A":"","B":"","C":"","tools":["도구"],"methods":["교수법"]}]'); break;
      }
      case 'flow':
        u += `총 ${c.sessions}차시 4MAT 흐름 3가지를 제안하세요. 차시 구간: ` + c.flow.map((f: Obj) => `${f.k} ${f.sessions}`).join(', ') + ' (what 끝 무렵 1쿼터 8주차 평가·9주차 발표회, whatif에 수행과제 완성·2쿼터 평가·발표회). r에는 그 구간에서 다루는 R번호, methods는 그 구간 활동의 교수법 1–2개(후보: ' + vals(s.methods).join(', ') + '). 모든 R이 한 번 이상 나와야 합니다. '
          + opt('"flow":[{"k":"why","activity":"","r":["R1"],"methods":["교수법"]},{"k":"what","activity":"","r":[],"methods":[]},{"k":"how","activity":"","r":[],"methods":[]},{"k":"whatif","activity":"","r":[],"methods":[]}]'); break;
      case 'whereto':
        u += 'WHERETO 7요소(' + vals(s.whereto).map((w: any) => `${w[0]}=${w[1]}`).join(', ') + ')를 설계에 비추어 점검하세요. 형식: {"checks":[{"k":"W","ok":true,"evidence":"설계에서 인용한 구절","suggestion":"보완 제안"}]}'; break;
      default: throw new CoreError('AI 추천이 없는 단계');
    }
    return { system: sys, user: u };
  }
  parse(step: string, j: Obj, c: Obj): Obj {
    const s = this.seed; const str = (v: any, n = 600) => sub(v, n);
    const opts = vals(j.options ?? []).filter(isArr).slice(0, 3);
    const inList = (arr: any, allowed: any[], min: number, max: number) => {
      const v = unique(intersect(vals(arr).filter(isScalar).map((x) => str(x, 40)), allowed));
      return v.length && v.length >= min ? v.slice(0, max) : null;
    };
    const out: Obj[] = [];
    if (step === 'whereto') {
      const ck: Obj[] = [];
      for (const x of vals(j.checks ?? [])) if (isArr(x) && inArr(x.k ?? '', column(s.whereto, 0)))
        ck.push({ k: x.k, ok: truthy(x.ok ?? false), evidence: str(x.evidence ?? '', 300), suggestion: str(x.suggestion ?? '', 300) });
      return { checks: ck };
    }
    for (const o of opts) {
      const why = str(o.why ?? '', 300); let v: any = null;
      switch (step) {
        case 'topic': v = inArr(o.value ?? '', column(this.topicsForGrade(c.grade), 'name')) ? o.value : null; break;
        case 'subject': v = inArr(o.value ?? '', vals(s.subjects)) ? o.value : null; break;
        case 'values': v = inList(o.values ?? [], column(s.values, 'code'), 1, 2); break;
        case 'competencies': v = inList(o.values ?? [], this.compNames(), 2, 3); break;
        case 'standards': {
          const cand = new Map<string, Obj>(); for (const x of this.standardsFor(c.subject, c.grade, 40)) cand.set(x.code, x);
          if (cand.size) { const codes = inList(o.codes ?? [], [...cand.keys()], 1, 3); v = codes ? codes.map((k) => { const x = cand.get(k)!; return { code: k, text: x.text, status: x.status, sources: x.sources }; }) : null; }
          else if (str(o.text ?? '') !== '') v = [{ code: '[코드 확인]', text: str(o.text ?? '', 500), status: 'unverified', sources: [] }];
          break;
        }
        case 'goals': { const g = vals(o.goals ?? []).map((x: any) => (isArr(x) ? this.goalTarget(x) : null)).filter((x: any) => x && x.text !== '').slice(0, MAX_G); v = g.length ? g : null; break; }
        case 'identity': {
          const gs = inList(o.goals ?? [], column(s.goals, 'code'), 1, 2);
          const vs = inList(o.values ?? [], column(s.values, 'code'), 0, 2) ?? [];
          v = gs ? { goals: gs, values: vs, teacher_view: str(o.teacher_view ?? '', 600), student_view: str(o.student_view ?? '', 600) } : null; break;
        }
        case 'question': v = elvis(str(o.value ?? '', 300), null); break;
        case 'goal_add': { const g = toObj(o.goal ?? []); v = str(g.text ?? '') !== '' ? this.goalTarget(g) : null; break; }
        case 'rubric_add': { const r = toObj(o.row ?? []); const gk = column(c.goals, 'key'); if (inArr(r.goal ?? '', gk)) v = this.rubricRow(r, c.goals, c.grade, c); break; }
        case 'task': v = str(o.text ?? '') !== '' ? { text: str(o.text, 600), role: str(o.role ?? '', 100), audience: str(o.audience ?? '', 100), product: str(o.product ?? '', 150) } : null; break;
        case 'rubric': {
          const rows: Obj[] = []; const gk = column(c.goals, 'key');
          for (const r of vals(o.rows ?? []).slice(0, MAX_R)) if (isArr(r) && inArr(r.goal ?? '', gk)) rows.push(this.rubricRow(r, c.goals, c.grade, c));
          v = rows.length ? rows : null; break;
        }
        case 'flow': {
          const f = new Map<string, Obj>();
          for (const x of vals(o.flow ?? [])) if (isArr(x) && inArr(x.k ?? '', ['why', 'what', 'how', 'whatif']))
            f.set(x.k, { k: x.k, activity: str(x.activity ?? '', 800), r: vals(x.r ?? []).filter((r) => typeof r === 'string' && /^R[1-8]$/.test(r)), methods: this.methodList(x.methods ?? []) });
          v = f.size === 4 ? [...f.values()] : null; break;
        }
      }
      if (v !== null && v !== undefined) out.push({ value: v, why });
    }
    return { options: out };
  }
  ruleInfo(step: string, c: Obj): Obj {
    switch (step) {
      case 'topic': return { candidates: column(this.topicsForGrade(c.grade), 'name') };
      case 'prereq': return { ...this.prereqFor(c.topic), known: this.topic(c.topic) !== null };
      case 'identity': return { recommended_values: this.valuesFor(c.topic), value_defs: this.seed.values };
      case 'values': return { recommended: this.valuesFor(c.topic) };
      case 'standards': return { candidates: this.standardsFor(c.subject, c.grade), note: this.seed.standards_note ?? '' };
      case 'rubric': {
        const rec: Obj = {}; for (const n of c.competencies) rec[n] = this.recommendedTools(n);
        return { elements: c.competencies.map((n: string) => this.element(n, c.grade)).filter(truthy), recommended: rec };
      }
      default: return {};
    }
  }
  mock(step: string, c: Obj): Obj {
    const s = this.seed; const why = '모의 추천입니다.';
    const comps = truthy(c.competencies) ? c.competencies : ['비판적 사고력', '의사소통능력'];
    switch (step) {
      case 'identity': return { options: [{ goals: ['2'], values: ['샬롬'], teacher_view: '정답보다 질문을 함께 붙드는 안내자', student_view: '읽고 질문하고 자기 언어로 쓰는 사람', why },
        { goals: ['1'], values: ['제자도'], teacher_view: '땅과 함께 일하며 본을 보이는 동역자', student_view: '맡은 것을 끝까지 돌보는 청지기', why }, { goals: ['2', '3'], values: ['소명', '공동체'], teacher_view: '함께 실험하고 분별 기준을 세우는 동료 탐구자', student_view: '배운 것을 이웃에게 전하는 제자', why }] };
      case 'question': return { options: ['AI가 대신 써 준 글은 내 배움일까?', '땅을 돌보는 일은 왜 예배가 될 수 있을까?', '사랑한다는 것은 무엇을 하는 것일까?'].map((q) => ({ value: q, why })) };
      case 'goal_add': return { options: [{ goal: { text: '나는 배운 내용을 후배에게 설명할 수 있다.', type: truthy(c.competencies) ? 'competency' : 'standard', target: c.competencies[0] ?? (c.standards[0]?.code ?? '') }, why }] };
      case 'rubric_add': return { options: [{ row: { goal: (diff(column(c.goals, 'key'), column(c.rubric, 'goal'))[0] ?? (c.goals[0]?.key ?? 'G1')), competency: comps[0], criterion: '추가 평가 항목', A: '스스로 3개 이상', B: '2개', C: '도움을 받아 1개', methods: ['협동학습'] }, why }] };
      case 'topic': return { options: column(this.topicsForGrade(c.grade), 'name').slice(0, 3).map((t) => ({ value: t, why })) };
      case 'subject': return { options: ['정보미디어', '국어', '사회'].map((t) => ({ value: t, why })) };
      case 'values': return { options: [elvis(this.valuesFor(c.topic), ['공동체']), ['샬롬'], ['소명', '공동체']].map((v) => ({ values: v, why })) };
      case 'competencies': return { options: [['비판적 사고력', '의사소통능력'], ['창의적 사고력', '협업능력'], ['실천적 사고력', '자기주도성', '타인 존중']].map((v) => ({ values: v, why })) };
      case 'standards': {
        const cand = column(this.standardsFor(c.subject, c.grade), 'code');
        return cand.length ? { options: [0, 1, 2].map((i) => ({ codes: cand.slice(i, i + 2), why })) } : { options: [{ code: '[코드 확인]', text: '교과 핵심 개념을 실생활 문제에 적용한다.', why }] };
      }
      case 'goals': return { options: [0, 1, 2].map(() => ({ goals: [{ text: '핵심 개념을 설명할 수 있다.', type: 'standard', target: c.standards[0]?.code ?? '' }, { text: '근거를 들어 판단할 수 있다.', type: 'competency', target: c.competencies[0] ?? '' }, { text: '결과물을 청중에게 발표할 수 있다.', type: 'competency', target: c.competencies[1] ?? (c.competencies[0] ?? '') }], why })) };
      case 'task': return { options: [{ text: '후배 멘토가 되어 9학년에게 가이드 포스터를 만든다.', role: '후배 멘토', audience: '9학년', product: '가이드 포스터', why }] };
      case 'rubric': {
        const n = Math.max(0, c.goals.length - 1); const rows: Obj[] = [];
        for (let i = 0; i <= n; i++) rows.push({ goal: 'G' + (i + 1), competency: comps[i % comps.length], criterion: '평가 항목 ' + (i + 1), A: '근거 3개 이상을 스스로 찾는다', B: '근거 2개를 찾는다', C: '도움을 받아 1개를 찾는다', methods: [['토론법', '협동학습', '프로젝트'][i % 3]] });
        return { options: [{ rows, why }] };
      }
      case 'flow': return { options: [{ flow: [{ k: 'why', activity: '핵심 질문 제시와 동기 유발', r: [], methods: ['토론법'] }, { k: 'what', activity: '개념 학습, 1쿼터 8주차 평가·9주차 발표회', r: ['R1'], methods: ['강의법', '플립러닝'] }, { k: 'how', activity: '연습과 적용, 중간 피드백', r: ['R2'], methods: ['협동학습'] }, { k: 'whatif', activity: '수행과제 완성, 2쿼터 평가·발표회', r: ['R3'], methods: ['프로젝트'] }], why }] };
      case 'whereto': return { checks: vals(s.whereto).map((w: any) => ({ k: w[0], ok: true, evidence: '', suggestion: '' })) };
      default: return {};
    }
  }
  // ---------- 성취기준 인터넷 검색 ----------
  static async stdCacheKey(subject: string, grade: number, query: string): Promise<string> {
    const raw = trim(subject).toLowerCase() + '|' + grade + '|' + trim(query).toLowerCase().replace(/\s+/gu, ' ');
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  stdSearchPrompt(c: Obj, query: string): { system: string; user: string } {
    const subs = this.stdSubjects(c.subject, c.grade ?? 10).slice(0, 4);
    const u = "2022 개정 교육과정 고등학교 '" + subs.join('/') + "' 과목 성취기준 중 '" + query + "'와 관련된 성취기준 3–6개의 코드와 원문을 Google에서 검색해서 알려줘. "
      + '국가교육과정정보센터(ncic.re.kr)·교육부 자료를 우선 찾아. 코드는 검색 결과에 나온 그대로 쓰고, 확인 못 하면 "[코드 확인]"으로 써. '
      + '마지막에 JSON {"items":[{"code":"","text":"","why":"이 주제와 관련된 이유 한 문장"}]}';
    return { system: '', user: u };
  }
  static domainRank(t: string): number {
    const l = t.toLowerCase();
    for (let i = 0; i < PREFERRED_DOMAINS.length; i++) if (l.includes(PREFERRED_DOMAINS[i])) return i;
    return 99;
  }
  parseGrounded(text: string, meta: Obj, _c: Obj): Obj {
    const chunks = new Map<number, Obj>();
    vals(meta.groundingChunks ?? []).forEach((ch: any, i: number) => { const w = isArr(ch) ? (ch.web ?? {}) : {}; if (truthy(w.uri)) chunks.set(i, { title: toStr(w.title ?? ''), uri: toStr(w.uri) }); });
    const segs: { text: string; chunks: number[] }[] = [];
    for (const sp of vals(meta.groundingSupports ?? [])) {
      const idx = vals(sp?.groundingChunkIndices ?? []).filter((i: any) => typeof i === 'number' && chunks.has(i));
      if (idx.length) segs.push({ text: toStr(sp?.segment?.text ?? ''), chunks: idx });
    }
    const j = extractJson(text) || {};
    const itemsIn = vals(isArr(j) ? (j as any).items ?? [] : []).filter(isArr);
    const db = this.stdByCodes(itemsIn.map((x: any) => { const k = trim(toStr(isScalar(x.code) ? x.code : (x.code ?? ''))); return k !== '' && k[0] !== '[' ? `[${k}]` : k; }));
    const sortSrc = (list: Obj[]) => Core.cleanSources(list.slice().sort((a, b) => Core.domainRank(a.title + ' ' + a.uri) - Core.domainRank(b.title + ' ' + b.uri)));
    const all = sortSrc([...chunks.values()]); const items: Obj[] = [];
    for (const x of itemsIn.slice(0, MAX_STD)) {
      const txt = mbSub(trim(toStr(isScalar(x.text) ? x.text : (x.text ?? ''))), 0, 500); if (txt === '') continue;
      let code = trim(toStr(isScalar(x.code) ? x.code : (x.code ?? '')));
      if (code !== '' && code[0] !== '[') code = `[${code}]`;
      const valid = /^\[[0-9]{1,2}[0-9A-Za-z가-힣]{1,12}-?[0-9]{2}(-[0-9]{2})?\]$/u.test(code);
      const bare = trim(code, '[]'); const src = new Map<number, Obj>();
      if (valid) for (const sg of segs) if (bare !== '' && sg.text.includes(bare)) for (const ci of sg.chunks) src.set(ci, chunks.get(ci)!);
      const why = mbSub(trim(toStr(isScalar(x.why) ? x.why : (x.why ?? ''))), 0, 300);
      if (valid && db[code]) { const row = db[code];
        items.push({ code, text: row.text, why, status: 'ncic', sources: [...row.sources, ...sortSrc([...src.values()])].slice(0, 5), subject: row.subject });
        continue; }
      code = '[코드 확인]';
      if (!src.size) for (const sg of segs) if (mbLen(sg.text) > 10 && (sg.text.includes(mbSub(txt, 0, 20)) || txt.includes(mbSub(sg.text, 0, 20)))) for (const ci of sg.chunks) src.set(ci, chunks.get(ci)!);
      items.push({ code, text: txt, why, status: 'unverified', sources: sortSrc([...src.values()]) });
    }
    return { items, sources: all, queries: vals(meta.webSearchQueries ?? []).map(toStr).slice(0, 5) };
  }
  stdFallback(c: Obj): Obj {
    return { items: this.standardsFor(c.subject, c.grade ?? 10, 20).map((x) => ({ code: x.code, text: x.text, why: x.source ?? '원문 DB', status: x.status, sources: x.sources ?? [], subject: x.subject ?? '' })), sources: [], queries: [], fallback: true,
      note: this.seed.standards_note ?? '' };
  }
  static mockGrounded(): [string, Obj] {
    const text = '검색 결과 요약\n```json\n{"items":[{"code":"[10공국1-01-01]","text":"대화의 원리를 이해하고 상황에 맞게 대화한다.","why":"모의"},{"code":"[99가짜-01-01]","text":"지어낸 성취기준이다.","why":"모의"}]}\n```';
    const meta = { webSearchQueries: ['2022 개정 공통국어1 성취기준'], groundingChunks: [{ web: { uri: 'https://example.org/b', title: 'blog.example' } }, { web: { uri: 'https://ncic.re.kr/x', title: 'ncic.re.kr' } }],
      groundingSupports: [{ segment: { text: '[10공국1-01-01] 대화의 원리를 이해하고' }, groundingChunkIndices: [0, 1] }] };
    return [text, meta];
  }
  // ---------- 초안 전체 작성 ----------
  static draftTargets(c: Obj): string[] {
    return DRAFT_STEPS.filter((k) => k === 'task' ? c.task.text === '' : k === 'flow' ? !column(c.flow, 'activity').some(truthy) : !truthy(c[k]));
  }
  draftPrompt(c: Obj, title = ''): { system: string; user: string } {
    const s = this.seed; const t = Core.draftTargets(c);
    const cands: Obj = { topic: '주제 후보: ' + column(this.topicsForGrade(c.grade), 'name').join(', '), subject: '교과 후보: ' + vals(s.subjects).join(', '),
      values: '가치 후보: ' + column(s.values, 'code').join(', '), competencies: '하위 역량 후보: ' + this.compNames().join(', '),
      flow: `4MAT 차시 구간(총 ${c.sessions}차시): ` + c.flow.map((f: Obj) => `${f.k} ${f.sessions}`).join(', ') + ' · 구간마다 교수법(methods) 1–2개, 후보: ' + vals(s.methods).join(', '),
      standards: '성취기준: 원문 DB 후보 ' + elvis(this.standardsFor(c.subject, c.grade, 20).map((x) => `${x.code} ${x.text}`).join(' / '), '없음') + ' — 후보에 없으면 code는 "[코드 확인]"',
      rubric: '루브릭: G 하나당 1행, 역량은 고른 하위 역량, 학년 단계 ' + Core.stageForGrade(c.grade) + '. 행마다 tools 1–3개·methods 1–2개. ' + this.toolPromptText(c) };
    const fmt: Obj = { topic: '"topic":"주제"', subject: '"subject":"교과"', values: '"values":["가치"]', competencies: '"competencies":["역량"]', standards: '"standards":[{"code":"","text":""}]',
      goals: '"goals":[{"text":"나는 ~할 수 있다.","type":"competency|standard","target":"역량 이름 또는 성취기준 코드 1개"}]', task: '"task":{"text":"","role":"","audience":"","product":""}',
      rubric: '"rubric":[{"goal":"G1","competency":"","criterion":"","A":"","B":"","C":"","tools":["도구"],"methods":["교수법"]}]', flow: '"flow":[{"k":"why","activity":"","r":[],"methods":[]},{"k":"what","activity":"","r":["R1"],"methods":[]},{"k":"how","activity":"","r":[],"methods":[]},{"k":"whatif","activity":"","r":[],"methods":[]}]' };
    const u = '## 지금까지의 설계\n' + this.contextText(c, title) + '\n\n## 요청\n별무리 교육 전문가로서 남은 단계(' + t.join(', ') + ')의 초안을 한 번에 작성하세요. 앞 선택과 서로 번호로 이어지게(G↔성취기준, R↔G, 4MAT↔R) 쓰고, 예시 설계서 수준으로 구체적으로. 선택지는 1개만.\n'
      + t.filter((k) => k in cands).map((k) => cands[k] ?? '').join('\n') + '\n형식: {' + t.map((k) => fmt[k]).join(',') + '}';
    return { system: this.systemPrompt('draft').replace('선택지는 정확히 3개이며 서로 뚜렷이 달라야 합니다.', '초안 하나만 씁니다.'), user: u };
  }
  applyDraft(c0: Obj, j: Obj): [Obj, string[]] {
    const c: Obj = structuredClone(c0); const filled: string[] = [];
    for (const k of Core.draftTargets(c)) {
      if (!has(j, k)) continue; const x = j[k];
      let v: any;
      if (k === 'standards') {
        const xs = vals(x ?? []).filter(isArr);
        const seed = this.stdByCodes(xs.map((sx: any) => toStr(isScalar(sx.code) ? sx.code : (sx.code ?? '')))); v = [];
        for (const sx of xs.slice(0, 4)) { const code = toStr(isScalar(sx.code) ? sx.code : (sx.code ?? '')); const txt = trim(toStr(isScalar(sx.text) ? sx.text : (sx.text ?? '')));
          if (seed[code]) v.push({ code, text: seed[code].text, status: seed[code].status, sources: seed[code].sources });
          else if (txt !== '') v.push({ code: '[코드 확인]', text: mbSub(txt, 0, 500), status: 'unverified', sources: [] }); }
      } else {
        const wrap = ({ topic: { value: x }, subject: { value: x }, values: { values: x }, competencies: { values: x }, goals: { goals: x }, task: isArr(x) ? x : {}, rubric: { rows: x }, flow: { flow: x } } as Obj)[k] ?? {};
        const p = this.parse(k, { options: [wrap] }, c); v = p.options[0]?.value ?? null;
      }
      if (!truthy(v)) continue;
      switch (k) {
        case 'topic': c.topic = v; c.prereq = this.prereqFor(v).prereq; break;
        case 'goals': c.goals = v.map((g: Obj, i: number) => ({ key: 'G' + (i + 1), ...g })); break;
        case 'rubric': c.rubric = v.map((r: Obj, i: number) => ({ key: 'R' + (i + 1), ...r })); break;
        case 'flow': { const by = new Map<string, Obj>(); for (const f of v) by.set(f.k, f);
          for (const f of c.flow) { f.activity = by.get(f.k)?.activity ?? ''; f.r = by.get(f.k)?.r ?? []; f.methods = by.get(f.k)?.methods ?? []; } break; }
        default: c[k] = v;
      }
      if (!isArr(c.sources) || Array.isArray(c.sources)) c.sources = { ...(c.sources ?? {}) };
      c.sources[k] = 'ai_draft'; filled.push(k);
    }
    return [this.sanitize(c), filled];
  }
  mockDraft(c: Obj): Obj {
    const m = (k: string) => this.mock(k, c).options?.[0] ?? {};
    return { topic: m('topic').value ?? '', subject: '국어', values: ['공동체'], competencies: ['비판적 사고력', '의사소통능력'],
      standards: [{ code: '[10공국1-01-01]', text: 'x' }, { code: '[99지어냄-01]', text: '지어낸 문장' }],
      goals: [{ text: '나는 근거를 들어 설명할 수 있다.', std: '[10공국1-01-01]' }, { text: '나는 글을 고쳐 쓸 수 있다.', std: '' }],
      task: m('task'),
      rubric: [{ goal: 'G1', competency: '비판적 사고력', criterion: '근거', A: '3개', B: '2개', C: '1개', tools: ['ES', '포트폴리오(PF)'], methods: ['토론법'] }, { goal: 'G2', competency: '의사소통능력', criterion: '고쳐쓰기', A: '', B: '', C: '', tools: ['발표(PR)'], methods: ['협동학습'] }],
      flow: [{ k: 'why', activity: '동기', r: [], methods: ['토론법'] }, { k: 'what', activity: '개념', r: ['R1'], methods: ['강의법'] }, { k: 'how', activity: '적용', r: ['R2'], methods: ['협동학습'] }, { k: 'whatif', activity: '완성', r: ['R1', 'R2'], methods: ['프로젝트'] }] };
  }
  // ---------- 별무리 연결 통계 ----------
  static targets(c: Obj): Obj[] {
    const T: Obj[] = [];
    T.push({ type: 'design', key: 'D', text: c.question, assessed: 0,
      tags: [...c.values.map((v: string) => `VAL:${v}`), ...c.identity.goals.map((g: string) => `GOAL:${g}`), ...(truthy(c.topic) ? ['TOPIC:' + c.topic] : []), ...(truthy(c.subject) ? ['SUBJ:' + c.subject] : [])] });
    const assessedGoals = column(c.rubric, 'goal');
    for (const g of c.goals) T.push({ type: 'goal', key: g.key, text: g.text, assessed: inArr(g.key, assessedGoals) ? 1 : 0, tags: g.target !== '' ? [(g.tt === 'competency' ? 'COMP:' : 'STD:') + g.target] : [] });
    const usedR = (c.flow.length ? c.flow : [{ r: [] }]).flatMap((f: Obj) => f.r);
    for (const r of c.rubric) T.push({ type: 'rubric', key: r.key, text: r.criterion, assessed: 1,
      tags: [truthy(r.competency) ? 'COMP:' + r.competency : '', truthy(r.element) ? 'ELEM:' + r.competency + '/' + r.element : '', truthy(r.goal) ? 'LINK:' + r.goal : '', inArr(r.key, usedR) ? 'TAUGHT:1' : ''].filter(truthy) });
    for (const cp of c.competencies) if (!inArr(cp, column(c.rubric, 'competency'))) T.push({ type: 'competency', key: 'C', text: cp, assessed: 0, tags: [`COMP:${cp}`] });
    return T;
  }
  // ---------- 점검 ----------
  checklist(c: Obj): { step: string; msg: string }[] {
    const W: { step: string; msg: string }[] = []; const w = (k: string, m: string) => W.push({ step: k, msg: m });
    if (trim(c.course) === '' && trim(c.intent) === '') w('start', '수업 아이디어나 과목명을 적어 주세요.');
    if (!c.identity.goals.length) w('identity', '교육목표를 고르세요.');
    if (trim(c.identity.teacher_view) === '') w('identity', '교사관을 이번 설계에 맞게 쓰세요(매번 작성).');
    if (trim(c.identity.student_view) === '') w('identity', '학생관을 이번 설계에 맞게 쓰세요(매번 작성).');
    if (trim(c.question) === '') w('question', '핵심 질문이 비어 있습니다.');
    if (trim(c.topic) === '') w('topic', '핵심 주제 1개를 정하세요.');
    if (trim(c.subject) === '') w('subject', '핵심 교과 1개를 정하세요.');
    if (!c.values.length || c.values.length > 2) w('identity', '핵심 가치는 1–2개입니다(평가하지 않음 · 정체성에서 고름).');
    const n = c.competencies.length; const cap = Math.max(3, c.credits * 2);
    if (n < 2) w('competencies', '하위 역량은 2개 이상 고르세요.'); else if (n > cap) w('competencies', `하위 역량이 많습니다. 1학점당 2개 권장(${c.credits}학점 = ` + (c.credits * 2) + '개).');
    if (!c.standards.length) w('standards', '성취기준을 하나 이상 넣으세요.');
    for (const x of c.standards) if (inArr(x.status, ['unverified', 'teacher']) || x.code.includes('코드 확인')) { w('standards', 'NCIC 원문으로 확인되지 않은 성취기준이 있습니다: ' + x.code); break; }
    if (!c.goals.length) w('goals', '학습목표(G)를 하나 이상 쓰세요.');
    const stdCodes = column(c.standards, 'code');
    for (const g of c.goals) {
      if (g.target === '') w('goals', g.key + ': 평가 대상(하위역량 또는 성취기준) 1개를 고르세요.');
      else if (truthy(g.extra)) w('goals', g.key + ': 대상은 1개만 됩니다. 첫 번째(' + g.target + ')만 유지하고 나머지(' + g.extra.join(', ') + ')는 확인 후 지우세요.');
      else if (!inArr(g.target, g.tt === 'competency' ? c.competencies : stdCodes)) w('goals', g.key + ': 대상 ' + g.target + '이(가) 1단계에서 고른 항목에 없습니다.');
    }
    if (trim(c.task.text) === '') w('task', '수행과제가 비어 있습니다.');
    const miss = diff(column(c.goals, 'key'), column(c.rubric, 'goal'));
    if (miss.length) w('rubric', '루브릭(R)이 없는 목표: ' + miss.join(', '));
    for (const r of c.rubric) if (trim(r.A) === '' || trim(r.B) === '' || trim(r.C) === '') { w('rubric', r.key + ': 우수/보통/미흡 서술을 모두 채우세요.'); break; }
    const noTool = c.rubric.filter((r: Obj) => !truthy(r.tools ?? [])).map((r: Obj) => r.key);
    if (noTool.length) w('rubric', '평가 도구를 고르지 않은 R: ' + noTool.join(', '));
    const emptyK = c.flow.filter((f: Obj) => trim(f.activity) === '').map((f: Obj) => f.k);
    if (emptyK.length) w('flow', `${c.sessions}차시 중 활동이 빈 구간: ` + emptyK.join(', '));
    const noM = c.flow.filter((f: Obj) => trim(f.activity) !== '' && !truthy(f.methods ?? [])).map((f: Obj) => f.k);
    if (noM.length) w('flow', '교수법 태그가 없는 4MAT 구간: ' + noM.join(', '));
    const last = c.flow[c.flow.length - 1]; const mm = last ? /(\d+)$/.exec(toStr(last.sessions)) : null;
    if (last && mm && toInt(mm[1]) !== toInt(c.sessions)) w('flow', `4MAT 마지막 차시(${mm[1]})가 총 차시(${c.sessions})와 다릅니다.`);
    const left = diff(column(this.seed.whereto ?? [], 0), c.whereto);
    if (left.length) w('whereto', 'WHERETO 미점검: ' + left.join(', '));
    return W;
  }
  // ---------- G 평가 대상 ----------
  goalTarget(x: Obj): Obj {
    const str = (v: any, n: number) => sub(v, n);
    const comps = this.compNames(); let cand: [string, string][] = [];
    const ttv = x.tt ?? (x.type ?? '');
    const tt = inArr(ttv, ['competency', 'standard']) ? (x.tt ?? x.type) : '';
    if (tt !== '' && str(x.target ?? '', 80) !== '') cand.push([tt, str(x.target, 80)]);
    for (const t of vals(x.targets ?? [])) if (isArr(t) && inArr(t.type ?? '', ['competency', 'standard']) && str(t.target ?? '', 80) !== '') cand.push([t.type, str(t.target, 80)]);
    for (const code of str(x.std ?? '', 200).split(/\s*[,;/]\s*/u)) if (code !== '') cand.push(['standard', mbSub(code, 0, 40)]);
    for (const cp of vals(x.competency ?? (x.competencies ?? []))) if (typeof cp === 'string' && inArr(trim(cp), comps)) cand.push(['competency', trim(cp)]);
    const seen = new Set<string>(); cand = cand.filter((c) => { const k = c[0] + '|' + c[1]; if (seen.has(k)) return false; seen.add(k); return true; });
    const first = cand[0] ?? ['', ''];
    const extra = cand.slice(1).map((c) => (c[0] === 'competency' ? '역량 ' : '성취기준 ') + c[1]);
    for (const e of vals(x.extra ?? [])) if (typeof e === 'string' && trim(e) !== '' && !inArr(trim(e), extra)) extra.push(str(e, 90));
    return { text: str(x.text ?? '', 400), tt: first[0], target: first[1], std: first[0] === 'standard' ? first[1] : '', extra: extra.slice(0, 5) };
  }
  rubricRow(x: Obj, goals: Obj[], grade: number, c: Obj = {}): Obj {
    const str = (v: any, n: number) => sub(v, n);
    let g: Obj | null = null; for (const gg of goals) if (gg.key === (x.goal ?? null)) g = gg;
    let comp = ''; let elem = '';
    if (g && g.tt === 'competency') { comp = inArr(g.target, this.compNames()) ? g.target : ''; const el = comp ? this.element(comp, grade) : null; elem = el ? el.stage + '·' + el.element : ''; }
    else if (g && g.tt === 'standard') elem = '성취기준·' + g.target;
    else if (!g && inArr(x.competency ?? '', this.compNames())) { comp = x.competency; const el = this.element(comp, grade); elem = el ? el.stage + '·' + el.element : ''; }
    let tools = this.toolList([...vals(x.tools ?? []), ...(x.tool !== undefined && x.tool !== null ? [x.tool] : [])]);
    if (!tools.length && !has(x, 'tools') && (x.tool === undefined || x.tool === null)) tools = this.rowRecommended({ competency: comp }, plus(c, { competencies: [] })).slice(0, 1);
    return { goal: g ? g.key : '', competency: comp, element: elem, criterion: str(x.criterion ?? '', 200),
      A: str(x.A ?? '', 400), B: str(x.B ?? '', 400), C: str(x.C ?? '', 400), tools, methods: this.methodList(x.methods ?? []) };
  }
  toolPromptText(c: Obj): string {
    return '평가 도구 후보(안내서 약어): ' + vals(this.seed.tools ?? []).join(', ') + '\n역량별 권장 도구: ' + elvis(vals(c.competencies ?? []).map((cp: string) => cp + '=' + this.recommendedTools(cp).join('·')).join('; '), '역량 미정')
      + '\n교수법 후보: ' + vals(this.seed.methods ?? []).join(', ');
  }
  static goalTargetLabel(g: Obj): string { return g.target === '' ? '대상 없음' : (g.tt === 'competency' ? '하위역량 · ' : '성취기준 · ') + g.target; }
}
/** (array)$v → 키 접근 가능한 객체 */
function toObj(v: any): Obj { if (v === null || v === undefined) return {}; if (isArr(v)) return v; return { 0: v }; }
