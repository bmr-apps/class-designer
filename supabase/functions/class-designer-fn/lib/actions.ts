// 별무리 수업 디자이너 API — 원본 PHP index.php 의 설계·마법사·Alter·통계·관리 경로를 하나로.
// 저장소(Repo)와 AI 호출(AiPort)을 주입받아서, 서버 함수(Postgres)와 브라우저 미리보기(localStorage)가 같은 코드를 쓴다.
// 서버 함수는 표 주인 권한으로 접속해 RLS 를 건너뛰므로, 누가 무엇을 보고 고칠 수 있는지는 여기서 직접 확인한다.
// deno-lint-ignore-file no-explicit-any
import { fail } from './errors.ts';
import { APPLY_FIELDS, CHAT_MAX, CHAT_TURNS, Core, EXTRA, PROMPT_VERSION, STD_CACHE_DAYS, STEPS } from './core.ts';
import { DATASETS, Kb, MAX_BYTES, Overrides } from './kb.ts';
import { extractJson, mbLen, mbSub, toFloat, toInt, trim } from './php.ts';
import { piiScan } from './pii.ts';
import { evaluateLimits } from './limits.ts';
import { stable } from './ctx_pure.ts';
import { FILES } from './data.ts';

export type Role = 'teacher' | 'researcher' | 'admin';
export const ROLES: Role[] = ['teacher', 'researcher', 'admin'];
export type Member = { id: number; user_id: string | null; email: string; name: string; subject: string; role: Role; active: boolean; created_at?: string; last_login_at?: string | null };
export type AuthUser = { id: string; email: string; name: string; verified: boolean };
export type Design = { id: number; owner_id: string; title: string; subject: string; grade: string; semester: string; status: string; format: string; core: any;
  shared: boolean; deleted_at: string | null; deleted_by?: string | null; copied_from?: number | null; created_at: string; updated_at: string };
export type Msg = { role: 'user' | 'assistant'; content: string; created_at?: string; user_id?: string | null };
export type Prompt = { system: string; user: string };

/** 저장소: 서버(Postgres)와 미리보기(localStorage) 구현이 있다 */
export interface Repo {
  memberByUser(uid: string): Promise<Member | null>;
  memberByEmail(email: string): Promise<Member | null>;
  memberInsert(m: { user_id: string | null; email: string; name: string; role: Role; subject?: string }): Promise<Member>;
  memberPatch(id: number, p: Partial<Member>): Promise<void>;
  members(): Promise<Member[]>;
  names(uids: string[]): Promise<Record<string, string>>;
  settings(): Promise<Record<string, string>>;
  settingsSave(rows: { k: string; v: string }[]): Promise<void>;
  overrides(): Promise<Overrides>;
  designs(opts: { deleted: boolean; limit: number }): Promise<Design[]>;
  design(id: number, opts?: { deleted?: boolean }): Promise<Design | null>;
  designInsert(d: Partial<Design>): Promise<number>;
  designPatch(id: number, p: Partial<Design>): Promise<void>;
  syncTargets(id: number, targets: any[]): Promise<void>;
  clearTargets(id: number): Promise<void>;
  chat(designId: number, limit: number): Promise<Msg[]>;
  chatAdd(designId: number, rows: (Msg & { ai_log_id?: number | null })[]): Promise<void>;
  chatClear(designId: number): Promise<void>;
  chatRecent(uid: string, sinceIso: string): Promise<number>;
  draft(uid: string, limit: number): Promise<Msg[]>;
  draftAdd(uid: string, rows: Msg[]): Promise<void>;
  draftClear(uid: string): Promise<void>;
  draftRecent(uid: string, sinceIso: string): Promise<number>;
  aiUsage(uid: string): Promise<Record<string, number>>;
  aiLog(row: Record<string, any>): Promise<number>;
  stdCacheGet(key: string, sinceIso: string): Promise<any | null>;
  stdCachePut(row: { cache_key: string; subject: string; grade: number; query: string; result: any }): Promise<void>;
  linkStats(): Promise<any[]>;
  uncovered(): Promise<any[]>;
  counts(monthStartIso: string): Promise<{ designs: number; users: number; ai: number }>;
  kbVersions(ds: string, sec: string): Promise<any[]>;
  kbVersion(id: number): Promise<any | null>;
  kbSave(ds: string, sec: string, data: any, uid: string, action: string, note: string | null): Promise<void>;
  kbReset(ds: string, sec: string, uid: string): Promise<void>;
}
/** AI 공급자: 서버는 Gemini(키 CLASS_DESIGNER_GEMINI_API_KEY), 미리보기는 없음(모의 응답) */
export interface AiPort {
  hasKey(): boolean;
  generate(model: string, p: Prompt): Promise<[string, number, number]>;
  grounded(model: string, p: Prompt): Promise<[string, number, number, any]>;
}
export class AiKeyMissing extends Error {}
export type Env = { repo: Repo; ai: AiPort; standards: () => Promise<any[]> | any[]; preview?: boolean };
export type Ctx = { uid: string; me: Member; env: Env };

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const s = (v: any, n = 2000) => mbSub(trim(typeof v === 'string' ? v : v == null ? '' : String(v)), 0, n);
const since = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();
const monthStartKst = () => { const k = new Date(Date.now() + 9 * 3600e3); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600e3).toISOString(); };
export const kstTime = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
const isStaff = (m: Member) => m.role === 'admin' || m.role === 'researcher';
const requireRole = (c: Ctx, roles: Role[]) => { if (!roles.includes(c.me.role)) fail(403, '권한이 없습니다.'); };
const steps = () => Object.entries(STEPS).map(([key, [label, kind]]) => ({ key, label, kind }));
const idOf = (b: any) => { const n = toInt(b.id); if (n <= 0) fail(404, '설계안이 없습니다.'); return n; };

// ---------- 멤버 확인 (구글 로그인 → 이 앱 멤버) ----------
/** 로그인한 사람을 이 앱 멤버로 확인한다. 학교 도메인(기본 bmrschool.org)이고 메일 확인이 된 계정은 처음 들어올 때 교사로 자동 등록. */
export async function resolveMember(repo: Repo, u: AuthUser): Promise<Member> {
  let m = await repo.memberByUser(u.id);
  const email = u.email.toLowerCase();
  if (!m && email) {
    const pre = await repo.memberByEmail(email);
    if (pre && !pre.user_id) { await repo.memberPatch(pre.id, { user_id: u.id, name: pre.name || mbSub(u.name, 0, 100) }); m = { ...pre, user_id: u.id, name: pre.name || u.name }; }
  }
  if (!m) {
    const st = await repo.settings();
    const domain = (st.google_domain || 'bmrschool.org').toLowerCase();
    const first = (st.first_admin_email || '').toLowerCase();
    if (!u.verified || !email.endsWith('@' + domain)) fail(403, `별무리학교 계정(@${domain})으로 로그인해 주세요. 다른 계정은 관리자가 멤버로 등록해야 쓸 수 있습니다.`, { not_member: true, email });
    m = await repo.memberInsert({ user_id: u.id, email, name: mbSub(u.name, 0, 100), role: first !== '' && email === first ? 'admin' : 'teacher' });
  }
  if (!m.active) fail(403, '비활성화된 계정입니다. 관리자에게 문의하세요.', { not_member: true });
  return m;
}

// ---------- AI 공통 (PII·한도 검사 → 호출 → 기록) ----------
const piiMsg = (hits: { type: string }[], what: string) => `학생 개인정보로 보이는 내용이 있어 ${what}: ` + [...new Set(hits.map((h) => h.type))].join(', ');
export function piiGuard(text: string, what = 'AI로 보내지 않았습니다') { const p = piiScan(text); if (p.length) fail(422, piiMsg(p, what)); }
export function cost(tin: number, tout: number, st: Record<string, string>): number {
  const pin = st.price_in_per_1k_krw !== undefined ? toFloat(st.price_in_per_1k_krw) : 0.5;
  const pout = st.price_out_per_1k_krw !== undefined ? toFloat(st.price_out_per_1k_krw) : 2;
  return Math.round((tin / 1000 * pin + tout / 1000 * pout) * 100) / 100;
}
async function limitGuard(c: Ctx, st: Record<string, string>) { const lim = evaluateLimits(await c.env.repo.aiUsage(c.uid), st); if (lim) fail(429, lim); }
const providerOf = (c: Ctx, st: Record<string, string>) => (c.env.preview || st.ai_provider !== 'gemini') ? 'mock' : 'gemini';

async function coreAi(c: Ctx, designId: number | null, feature: string, prompt: Prompt, checkText: string, mock: () => unknown): Promise<[string, number]> {
  piiGuard(checkText);
  const st = await c.env.repo.settings();
  await limitGuard(c, st);
  const provider = providerOf(c, st);
  const model = provider === 'mock' ? 'mock' : (st.ai_model || DEFAULT_MODEL);
  const base = { user_id: c.uid, design_id: designId, feature, provider, model, prompt_version: PROMPT_VERSION, input_text: prompt.system + '\n---\n' + prompt.user };
  let out = '', tin = 0, tout = 0;
  try {
    if (provider === 'mock') { out = JSON.stringify(mock()); tin = Math.trunc(mbLen(prompt.system + prompt.user) / 2); tout = Math.trunc(mbLen(out) / 2); }
    else [out, tin, tout] = await c.env.ai.generate(model, prompt);
  } catch (e) {
    await c.env.repo.aiLog({ ...base, output_text: String((e as Error).message).slice(0, 2000), status: 'error' });
    if (e instanceof AiKeyMissing) fail(503, 'AI 키가 아직 설정되지 않았습니다. 관리자에게 문의하거나 직접 입력하세요.');
    fail(502, 'AI 호출에 실패했습니다. 직접 입력하거나 다시 시도하세요.');
  }
  const logId = await c.env.repo.aiLog({ ...base, output_text: out, tokens_in: tin, tokens_out: tout, cost_krw: cost(tin, tout, st), status: 'ok' });
  return [out, logId];
}

// ---------- 설계 도우미 ----------
async function kbAndCore(env: Env): Promise<{ kb: Kb; core: Core }> {
  const kb = new Kb(FILES, await env.repo.overrides());
  return { kb, core: new Core(kb.merged('core_seed.json'), kb.merged('bmr_knowledge.json'), await env.standards()) };
}
/** 읽기: 작성자·공유·연구소/관리자. 쓰기: 작성자·관리자 */
async function loadDesign(c: Ctx, id: number, write = false): Promise<Design> {
  const d = await c.env.repo.design(id);
  if (!d) return fail(404, '설계안이 없습니다.');
  const canRead = d.owner_id === c.uid || d.shared || isStaff(c.me);
  if (!canRead) fail(403, '권한이 없습니다.');
  if (write && !(d.owner_id === c.uid || c.me.role === 'admin')) fail(403, '권한이 없습니다.');
  return d;
}
function coreReady(cc: any, step: string, title: string): string | null {
  if (step === 'identity' || step === 'question') return (cc.intent !== '' || cc.course !== '' || title !== '') ? null : '먼저 수업 아이디어를 적어 주세요.';
  if (cc.question === '' || !cc.identity.goals.length) return '먼저 정체성(교육목표·가치)과 핵심 질문을 정하세요.';
  return null;
}
function seedView(core: Core) {
  const sd = core.seed;
  return { goals: sd.goals, values: sd.values, subjects: sd.subjects, tools: sd.tools, methods: sd.methods, whereto: sd.whereto, fourmat: sd.fourmat, competencies: core.compNames(),
    purpose: sd.purpose ?? '', levels: sd.levels, stage_defs: sd.stage_defs ?? {}, tool_codes: sd.tool_codes ?? '', max_tools: 3, max_methods: 2,
    comp_info: (sd.competencies ?? []).map((x: any) => ({ name: x.name, definition: x.definition ?? '', tools: x.tools ?? [], elements: (x.elements ?? []).map((e: any) => ({ stage: e.stage, element: e.element })) })),
    idea_examples: sd.idea_examples ?? [] };
}
const msgOf = (b: any) => trim(String(typeof b.message === 'string' ? b.message : '').replace(/\r\n/g, '\n'));
function checkMsg(msg: string) {
  if (msg === '') fail(422, '질문을 입력하세요.');
  if (mbLen(msg) > CHAT_MAX) fail(422, `질문은 ${CHAT_MAX}자 이내로 써 주세요.`);
}
async function stdCacheKey(subject: string, grade: number, q: string) { return await Core.stdCacheKey(subject, grade, q); }

// ---------- 관리: 지식 베이스 ----------
async function kbData(c: Ctx, kb: Kb, ds: string, sec: string) {
  if (!DATASETS[ds]) ds = 'knowledge';
  const secs = kb.sections(ds); if (!Object.prototype.hasOwnProperty.call(secs, sec)) sec = Object.keys(secs)[0] ?? '';
  const h = await c.env.repo.kbVersions(ds, sec);
  const nm = await c.env.repo.names(h.map((x: any) => x.user_id));
  const def = kb.defaults(kb.fileOf(ds))[sec];
  return { ds, sec, datasets: Object.entries(DATASETS).map(([k, m]) => ({ key: k, label: m.label })),
    secs: Object.entries(secs).map(([k, l]) => ({ key: k, label: l, over: kb.isOverridden(ds, k) })),
    isText: typeof def === 'string', over: kb.isOverridden(ds, sec), text: Kb.editText(kb.current(ds, sec)), default: Kb.editText(def ?? ''),
    history: h.map((x: any) => ({ id: x.id, action: x.action, note: x.note, created_at: x.created_at, name: nm[x.user_id] ?? '', bytes: x.data === null ? null : JSON.stringify(x.data).length })) };
}

/** 한 요청 처리. body.action 으로 나눈다 */
export async function run(c: Ctx, b: Record<string, any>): Promise<unknown> {
  const action = String(b.action ?? '');
  const { repo } = c.env;
  const { kb, core } = await kbAndCore(c.env);
  const adminOnly = () => requireRole(c, ['admin']);

  switch (action) {
    case 'me': { const m = c.me; return { id: c.uid, name: m.name, email: m.email, role: m.role, subject: m.subject, preview: !!c.env.preview }; }
    // ---------- 홈 ----------
    case 'home': {
      const all = await repo.designs({ deleted: false, limit: 1000 });
      const nm = await repo.names(all.map((d) => d.owner_id));
      const prep = (d: Design) => { const st = String(d.core?.step ?? 'start'); return { id: d.id, owner_id: d.owner_id, title: d.title, grade: d.grade, semester: d.semester, status: d.status, format: d.format,
        updated_at: d.updated_at, shared: d.shared, owner: nm[d.owner_id] ?? '', step: ({ tools: 'rubric', methods: 'flow', values: 'identity' } as any)[st] ?? st, subject_c: String(d.core?.subject ?? ''),
        progress: Core.progress(d.core) }; };
      const staff = isStaff(c.me);
      return { designs: all.filter((d) => staff ? true : d.owner_id === c.uid).map(prep),
        shared: all.filter((d) => d.shared && d.owner_id !== c.uid).slice(0, 200).map(prep), steps: steps() };
    }
    case 'create': {
      const e = core.empty(); const gr = toInt(b.grade ?? 10);
      e.grade = [10, 11, 12].includes(gr) ? gr : 10;
      e.semester = mbSub(trim(String(b.semester ?? '1')), 0, 10) || '1';
      e.credits = Math.max(1, Math.min(8, toInt(b.credits ?? 2))); e.sessions = Math.max(4, Math.min(200, toInt(b.sessions ?? 0) || e.credits * 18));
      e.intent = mbSub(trim(String(b.intent ?? '')), 0, 800);
      const cc = core.sanitize(e);
      // 제목: 입력한 제목 → 과목명 → 기본 제목. 아이디어 문장을 제목·과목명으로 덮어쓰지 않는다(제목이 아이디어에 고정되던 문제).
      const courseIn = mbSub(trim(String(b.course ?? '')), 0, 60);
      cc.course = courseIn;
      let title = mbSub(trim(String(b.title ?? '')), 0, 200);
      if (title === '') title = courseIn !== '' ? courseIn : '새 중핵 수업 설계';
      const id = await repo.designInsert({ owner_id: c.uid, title, grade: String(cc.grade), semester: cc.semester, format: 'core', core: cc });
      // 저장 전 초안 대화를 이 설계로 옮김 (최대 40개)
      const dr = await repo.draft(c.uid, 40);
      const rows = dr.map((m) => ({ role: (m.role === 'assistant' ? 'assistant' : 'user') as Msg['role'], content: mbSub(trim(String(m.content ?? '')), 0, 6000), user_id: c.uid })).filter((m) => m.content !== '');
      if (rows.length) await repo.chatAdd(id, rows);
      await repo.draftClear(c.uid);
      return { id };
    }
    case 'view': {
      const d = await loadDesign(c, idOf(b));
      const cc = core.sanitize(d.core ?? {});
      const nm = await repo.names([d.owner_id]);
      return { id: d.id, title: d.title, core: cc, canEdit: d.owner_id === c.uid || c.me.role === 'admin', own: d.owner_id === c.uid, shared: d.shared, owner: nm[d.owner_id] ?? '',
        checks: core.checklist(cc), steps: steps(), seed: seedView(core), applyFields: APPLY_FIELDS,
        print: { toolSummary: Core.summaryText(core.toolSummary(cc)), methodSummary: Core.summaryText(core.methodSummary(cc)), recommended: core.designRecommended(cc),
          goalLabels: cc.goals.map((g: any) => Core.goalTargetLabel(g)) } };
    }
    case 'save': {
      const d = await loadDesign(c, idOf(b), true);
      const cc = core.sanitize(b.core && typeof b.core === 'object' ? b.core : {});
      const title = mbSub(trim(String(typeof b.title === 'string' ? b.title : d.title)), 0, 200)
        || mbSub(cc.course, 0, 60) || d.title || '새 중핵 수업 설계';
      const prev = core.sanitize(d.core ?? {});
      const changed = stable(cc) !== stable(d.core ?? {}) || title !== d.title;
      if (changed) {
        await repo.designPatch(d.id, { title, subject: mbSub(cc.subject, 0, 100), grade: String(cc.grade), semester: cc.semester, format: 'core', core: cc, updated_at: new Date().toISOString() });
        if (stable(Core.targets(prev)) !== stable(Core.targets(cc))) await repo.syncTargets(d.id, Core.targets(cc));
      }
      return { ok: true, saved_at: kstTime(), core: cc, changed, checks: core.checklist(cc), title };
    }
    case 'rule': {
      await loadDesign(c, idOf(b), true);
      const step = String(b.step ?? '');
      if (!Object.prototype.hasOwnProperty.call(STEPS, step)) fail(404, '알 수 없는 단계');
      return { rule: core.ruleInfo(step, core.sanitize(b.core ?? {})) };
    }
    case 'suggest': {
      const d = await loadDesign(c, idOf(b), true); const step = String(b.step ?? '');
      if ((STEPS[step]?.[1] ?? '') !== 'ai' && step !== 'whereto' && !Object.prototype.hasOwnProperty.call(EXTRA, step)) fail(422, '이 단계는 AI 추천이 없습니다.');
      const cc = core.sanitize(b.core ?? {});
      const why = coreReady(cc, step, d.title); if (why) fail(422, why);
      const prompt = core.prompt(step, cc, d.title);
      const [out, logId] = await coreAi(c, d.id, 'core_' + step, prompt, core.contextText(cc, d.title), () => core.mock(step, cc));
      const j = extractJson(out);
      if (!j) fail(502, 'AI 응답을 해석하지 못했습니다. 다시 시도하세요.', { log_id: logId });
      return { log_id: logId, step, rule: core.ruleInfo(EXTRA[step] ?? step, cc), ...core.parse(step, j, cc) };
    }
    case 'draft': {
      const d = await loadDesign(c, idOf(b), true);
      const cc = core.sanitize(b.core ?? {});
      const why = coreReady(cc, 'draft', d.title); if (why) fail(422, why);
      if (!Core.draftTargets(cc).length) fail(422, '비어 있는 단계가 없습니다.');
      const [out, logId] = await coreAi(c, d.id, 'core_draft', core.draftPrompt(cc, d.title), core.contextText(cc, d.title), () => core.mockDraft(cc));
      const j = extractJson(out);
      if (!j) fail(502, 'AI 응답을 해석하지 못했습니다. 다시 시도하세요.', { log_id: logId });
      const [draft, filled] = core.applyDraft(cc, j);
      return { log_id: logId, core: draft, filled };
    }
    case 'std_search': {
      const d = await loadDesign(c, idOf(b), true);
      const cc = core.sanitize(b.core ?? {});
      if (cc.subject === '') fail(422, '먼저 핵심 교과를 고르세요.');
      const q = mbSub(trim(String(b.query ?? '')), 0, 120) || trim(cc.topic + ' ' + cc.question);
      piiGuard(q + '\n' + core.contextText(cc), '검색하지 않았습니다');
      const key = await stdCacheKey(cc.subject, cc.grade, q);
      if (!b.refresh) {
        const hit = await repo.stdCacheGet(key, since(STD_CACHE_DAYS * 86400));
        if (hit && typeof hit === 'object') return { ...hit, cached: true, query: q };
      }
      const st = await repo.settings(); const provider = providerOf(c, st);
      if (provider !== 'mock' && !c.env.ai.hasKey()) return { ...core.stdFallback(cc), query: q, warning: '검색용 Gemini 키가 없어 학교 시드 목록을 보여 줍니다.' };
      await limitGuard(c, st);
      const prompt = core.stdSearchPrompt(cc, q); const model = st.std_search_model || 'gemini-3.5-flash';
      const base = { user_id: c.uid, design_id: d.id, feature: 'core_std_search', provider, model: provider === 'mock' ? 'mock' : model, prompt_version: PROMPT_VERSION, input_text: prompt.system + '\n---\n' + prompt.user };
      let text: string, meta: any, tin = 0, tout = 0;
      try {
        if (provider === 'mock') [text, meta] = Core.mockGrounded();
        else [text, tin, tout, meta] = await c.env.ai.grounded(model, prompt);
      } catch (e) {
        await repo.aiLog({ ...base, output_text: String((e as Error).message).slice(0, 2000), status: 'error' });
        return { ...core.stdFallback(cc), query: q, warning: '인터넷 검색에 실패해 학교 시드 목록을 보여 줍니다.' };
      }
      await repo.aiLog({ ...base, output_text: text, tokens_in: tin, tokens_out: tout, cost_krw: cost(tin, tout, st), status: 'ok' });
      const r = core.parseGrounded(text, meta, cc);
      if (!r.items.length) return { ...core.stdFallback(cc), query: q, warning: '검색 결과에서 성취기준을 찾지 못해 학교 시드 목록을 보여 줍니다.' };
      if (!r.sources.length) return { ...r, cached: false, query: q, warning: 'AI가 이번에는 인터넷 검색 근거를 돌려주지 않았습니다. 코드는 모두 미확인으로 표시했습니다. "다시 검색"을 눌러 보세요.' };
      await repo.stdCachePut({ cache_key: key, subject: mbSub(cc.subject, 0, 60), grade: cc.grade, query: q, result: r });
      return { ...r, cached: false, query: q };
    }
    case 'apply': {
      await loadDesign(c, idOf(b), true);
      const cc = core.sanitize(b.core && typeof b.core === 'object' ? b.core : {});
      const field = trim(String(b.field ?? ''));
      if (!APPLY_FIELDS.includes(field)) fail(422, '허용되지 않은 필드입니다.');
      let next: any;
      try { next = core.applyField(cc, field, b.value ?? null); } catch (e) { fail(422, (e as Error).message); }
      return { ok: true, core: next, field, needs_review: Core.questionNeedsReview(next) };
    }
    // ---------- Alter ----------
    case 'chat_get': {
      const d = await loadDesign(c, idOf(b));
      const rows = await repo.chat(d.id, 50); const nm = await repo.names(rows.map((r) => r.user_id ?? ''));
      return { messages: rows.map((r) => ({ role: r.role, content: r.content, at: r.created_at, name: r.role === 'user' ? (nm[r.user_id ?? ''] ?? '') : '' })) };
    }
    case 'chat_post': {
      const d = await loadDesign(c, idOf(b)); const msg = msgOf(b); checkMsg(msg);
      if (await repo.chatRecent(c.uid, since(60)) >= 8) fail(429, '질문이 너무 잦습니다. 1분 뒤 다시 시도하세요.');
      const cc = b.core && typeof b.core === 'object' ? core.sanitize(b.core) : core.sanitize(d.core ?? {});
      const stage = mbSub(trim(String(b.stage ?? cc.step ?? '')), 0, 40);
      const h = await repo.chat(d.id, CHAT_TURNS);
      const prompt = core.chatPrompt(cc, d.title, h, msg, stage);
      const [out, logId] = await coreAi(c, d.id, 'core_chat', prompt, msg + '\n' + core.contextText(cc, d.title), () => Core.mockChat(cc, msg));
      const parsed = Core.chatParse(out);
      await repo.chatAdd(d.id, [{ role: 'user', content: msg, user_id: c.uid }, { role: 'assistant', content: parsed.reply, user_id: c.uid, ai_log_id: logId }]);
      return { reply: parsed.reply, propose: parsed.propose, log_id: logId };
    }
    case 'chat_clear': {
      const d = await loadDesign(c, idOf(b), true);
      await repo.chatClear(d.id); return { ok: true };
    }
    case 'draft_chat_get': {
      const rows = await repo.draft(c.uid, 50);
      return { messages: rows.map((r) => ({ role: r.role, content: r.content, at: r.created_at, name: '' })) };
    }
    case 'draft_chat_post': {
      const msg = msgOf(b); checkMsg(msg);
      if (await repo.draftRecent(c.uid, since(60)) >= 8) fail(429, '질문이 너무 잦습니다. 1분 뒤 다시 시도하세요.');
      const cc = core.sanitize(b.core && typeof b.core === 'object' ? b.core : {});
      const stage = mbSub(trim(String(b.stage ?? 'start')), 0, 40);
      const h = await repo.draft(c.uid, CHAT_TURNS);
      const prompt = core.chatPrompt(cc, '새 설계(저장 전)', h, msg, stage);
      const [out, logId] = await coreAi(c, null, 'core_chat_draft', prompt, msg + '\n' + core.contextText(cc, '새 설계'), () => Core.mockChat(cc, msg));
      const parsed = Core.chatParse(out);
      await repo.draftAdd(c.uid, [{ role: 'user', content: msg }, { role: 'assistant', content: parsed.reply }]);
      return { reply: parsed.reply, propose: parsed.propose, log_id: logId };
    }
    case 'draft_chat_clear': { await repo.draftClear(c.uid); return { ok: true }; }
    // ---------- 공유·삭제·복사 ----------
    case 'share': {
      const d = await loadDesign(c, idOf(b), true); const on = b.shared === true || b.shared === '1' || b.shared === 1;
      await repo.designPatch(d.id, { shared: on });
      return { ok: true, shared: on, msg: on ? '공유했습니다. 다른 선생님이 「공유된 수업」에서 읽기 전용으로 볼 수 있습니다.' : '공유를 껐습니다.' };
    }
    case 'delete': {
      const d = await loadDesign(c, idOf(b), true);
      if (b.confirm !== 'yes') fail(422, '삭제를 확인하지 않아 지우지 않았습니다.');
      await repo.designPatch(d.id, { deleted_at: new Date().toISOString(), deleted_by: c.uid, shared: false });
      await repo.clearTargets(d.id);
      return { ok: true, msg: '「' + d.title + '」을(를) 삭제했습니다. 실수였다면 관리자에게 복원을 요청하세요.' };
    }
    case 'copy': {
      const d = await loadDesign(c, idOf(b)); const cc = core.sanitize(d.core ?? {}); cc.step = 'start';
      const title = mbSub('(사본) ' + d.title, 0, 200);
      const id = await repo.designInsert({ owner_id: c.uid, title, subject: d.subject, grade: d.grade, semester: d.semester, format: 'core', core: cc, copied_from: d.id });
      await repo.syncTargets(id, Core.targets(cc));
      return { id, msg: '내 설계안으로 복사했습니다.' };
    }
    // ---------- 별무리 연결 통계 ----------
    case 'stats': {
      requireRole(c, ['admin', 'researcher']);
      return { rows: await repo.linkStats(), uncovered: await repo.uncovered() };
    }
    // ---------- 관리 ----------
    case 'overview': {
      requireRole(c, ['admin', 'researcher']);
      const counts = { ...(await repo.counts(monthStartKst())), std: (await c.env.standards()).length };
      const recentAll = await repo.designs({ deleted: false, limit: 8 });
      const trashAll = c.me.role === 'admin' ? await repo.designs({ deleted: true, limit: 50 }) : [];
      const nm = await repo.names([...recentAll, ...trashAll].map((d) => d.owner_id));
      const flat = (d: Design) => ({ id: d.id, title: d.title, grade: d.grade, updated_at: d.updated_at, deleted_at: d.deleted_at, owner: nm[d.owner_id] ?? '' });
      return { counts, recent: recentAll.map(flat), trash: trashAll.map(flat), usage: await repo.aiUsage(c.uid), isAdmin: c.me.role === 'admin' };
    }
    case 'standards': {
      requireRole(c, ['admin', 'researcher']);
      const all = await c.env.standards();
      const subjects: Record<string, number> = {}; for (const r of all) subjects[r.subject] = (subjects[r.subject] ?? 0) + 1;
      const sorted = Object.fromEntries(Object.entries(subjects).sort(([a], [z]) => (a < z ? -1 : a > z ? 1 : 0)));
      const q = s(b.q, 60); const subj = s(b.subject, 60); let stds: any[] = [];
      if (q !== '' || subj !== '') {
        const t = q.toLowerCase();
        stds = all.filter((r) => (subj === '' || r.subject === subj) && (t === '' || [r.code, r.text, r.domain].some((x) => String(x ?? '').toLowerCase().includes(t))))
          .sort((a, z) => (a.subject + a.code < z.subject + z.code ? -1 : 1)).slice(0, 200)
          .map((r) => ({ code: r.code, subject: r.subject, course_type: r.course_type, domain: r.domain, text: r.text, source_title: r.source_title, source_page: r.source_page }));
      }
      return { subjects: sorted, stds, q, subject: subj };
    }
    case 'users': {
      adminOnly();
      return { users: await repo.members() };
    }
    case 'user_update': {
      adminOnly();
      const id = toInt(b.id); const role = (ROLES as string[]).includes(b.role) ? b.role as Role : 'teacher'; const active = !!b.active;
      const all = await repo.members(); const m = all.find((x) => x.id === id);
      if (!m) fail(404, '사용자를 찾지 못했습니다.');
      if (m!.user_id === c.uid && role !== 'admin') fail(422, '자기 자신의 관리자 권한은 해제할 수 없습니다.');
      if (m!.user_id === c.uid && !active) fail(422, '자기 자신은 비활성화할 수 없습니다.');
      await repo.memberPatch(id, { role, subject: s(b.subject, 100), active, name: s(b.name, 100) || m!.name });
      return { ok: true, msg: '저장했습니다.' };
    }
    case 'member_add': {
      adminOnly();
      const email = s(b.email, 200).toLowerCase(); const role = (ROLES as string[]).includes(b.role) ? b.role as Role : 'teacher';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(422, '메일 주소 형식이 아닙니다.');
      if (await repo.memberByEmail(email)) fail(422, '이미 등록된 메일입니다.');
      await repo.memberInsert({ user_id: null, email, name: s(b.name, 100), role, subject: s(b.subject, 100) });
      return { ok: true, msg: `${email} 을(를) ${role === 'admin' ? '관리자' : role === 'researcher' ? '연구소' : '교사'}로 등록했습니다. 이 메일의 구글 계정으로 로그인하면 바로 쓸 수 있습니다.` };
    }
    case 'design_restore': {
      adminOnly();
      const id = toInt(b.id);
      const d = await repo.design(id, { deleted: true });
      if (!d || !d.deleted_at) fail(404, '삭제된 설계를 찾지 못했습니다.');
      await repo.designPatch(id, { deleted_at: null, deleted_by: null });
      await repo.syncTargets(id, Core.targets(core.sanitize(d!.core ?? {})));
      return { ok: true, msg: '복원했습니다: ' + d!.title };
    }
    case 'settings_get': {
      adminOnly();
      return { settings: await repo.settings(), keys: { gemini: !c.env.preview && c.env.ai.hasKey() }, usage: await repo.aiUsage(c.uid), preview: !!c.env.preview };
    }
    case 'settings_save': {
      adminOnly();
      const p = b.settings ?? {}; const rows: { k: string; v: string }[] = [];
      rows.push({ k: 'ai_provider', v: p.ai_provider === 'gemini' ? 'gemini' : 'mock' });
      rows.push({ k: 'ai_model', v: String(p.ai_model ?? '').trim().replace(/[^\w.\-:]/g, '') });
      rows.push({ k: 'std_search_model', v: String(p.std_search_model ?? '').trim().replace(/[^\w.\-:]/g, '') || 'gemini-3.5-flash' });
      rows.push({ k: 'google_domain', v: String(p.google_domain ?? '').trim().toLowerCase().replace(/[^a-z0-9.\-]/g, '') || 'bmrschool.org' });
      for (const k of ['limit_user_daily_calls', 'limit_user_monthly_calls', 'limit_user_monthly_cost_krw', 'limit_school_monthly_calls', 'limit_school_monthly_cost_krw', 'ai_log_retention_days', 'price_in_per_1k_krw', 'price_out_per_1k_krw'])
        rows.push({ k, v: String(Math.max(0, toFloat(String(p[k] ?? '').trim()))) });
      await repo.settingsSave(rows);
      return { ok: true, msg: '저장했습니다.' };
    }
    case 'kb_get': {
      adminOnly();
      return await kbData(c, kb, String(b.ds ?? 'knowledge'), String(b.sec ?? ''));
    }
    case 'kb_save': case 'kb_reset': case 'kb_restore': {
      adminOnly();
      const ds = String(b.ds ?? ''); const sec = String(b.sec ?? '');
      if (action !== 'kb_restore' && (!DATASETS[ds] || !Object.prototype.hasOwnProperty.call(kb.sections(ds), sec))) fail(422, '알 수 없는 항목입니다.');
      if (action === 'kb_save') {
        const raw = typeof b.data === 'string' ? b.data : '';
        const [v, err] = kb.validate(ds, sec, raw);
        if (err) fail(422, '저장하지 않았습니다 — ' + err, { draft: raw.slice(0, MAX_BYTES) });
        await repo.kbSave(ds, sec, v, c.uid, 'save', s(b.note, 200) || null);
        return { ok: true, msg: '저장했습니다. 다음 AI 추천부터 반영됩니다.' };
      }
      if (action === 'kb_reset') { await repo.kbReset(ds, sec, c.uid); return { ok: true, msg: '기본값(JSON 파일)으로 되돌렸습니다.' }; }
      const v = await repo.kbVersion(toInt(b.vid));
      if (!v) fail(404, '복원하지 못했습니다 — 이력을 찾지 못했습니다.');
      if (v.data === null) { await repo.kbReset(v.dataset, v.section, c.uid); return { ok: true, msg: '선택한 버전으로 복원했습니다.' }; }
      const [val, err] = kb.validate(v.dataset, v.section, typeof v.data === 'string' ? v.data : JSON.stringify(v.data));
      if (err) fail(422, '복원하지 못했습니다 — ' + err);
      await repo.kbSave(v.dataset, v.section, val, c.uid, 'restore', '#' + v.id + ' 복원');
      return { ok: true, msg: '선택한 버전으로 복원했습니다.' };
    }
  }
  return fail(404, '알 수 없는 요청입니다.');
}
