// 미리보기 저장소: localStorage('class-designer:preview-db') 하나에 JSON 으로 담는다. 서버 Repo 와 같은 모양.
import type { Design, Member, Msg, Repo } from '../../supabase/functions/class-designer-fn/lib/actions';
import { local } from '../store.js';

export const PREVIEW_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'preview@bmrschool.org', name: '미리보기 선생님' };
const KEY = 'preview-db';
type Db = {
  seq: number; members: Member[]; settings: Record<string, string>; designs: Design[];
  chat: (Msg & { id: number; design_id: number; ai_log_id?: number | null })[]; draft: (Msg & { id: number; user_id: string })[];
  ai_logs: any[]; targets: { design_id: number; type: string; key: string; text: string; assessed: boolean; tags: string[] }[];
  std_cache: Record<string, { result: any; created_at: string }>; kb_overrides: Record<string, Record<string, any>>; kb_versions: any[];
};
const fresh = (): Db => ({ seq: 1, members: [], settings: { ai_provider: 'mock', google_domain: 'bmrschool.org' }, designs: [], chat: [], draft: [], ai_logs: [], targets: [], std_cache: {}, kb_overrides: {}, kb_versions: [], });
let db: Db = load();
function load(): Db { const v = local.get(KEY, null); return v && typeof v === 'object' ? { ...fresh(), ...v } : fresh(); }
function save() {
  db.ai_logs = db.ai_logs.slice(-200); db.chat = db.chat.slice(-2000);
  try { local.set(KEY, db); } catch { /* 저장 공간이 꽉 차면 이번 변경만 메모리에 둠 */ }
}
const now = () => new Date().toISOString();
const nextId = () => db.seq++;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const localRepo: Repo & { ensurePreviewMember(): Promise<Member>; reset(): void } = {
  reset() { db = fresh(); save(); },
  async ensurePreviewMember() {
    db = load();
    let m = db.members.find((x) => x.user_id === PREVIEW_USER.id);
    if (!m) { m = { id: nextId(), user_id: PREVIEW_USER.id, email: PREVIEW_USER.email, name: PREVIEW_USER.name, subject: '', role: 'admin', active: true, created_at: now(), last_login_at: now() }; db.members.push(m); save(); }
    return clone(m);
  },
  async memberByUser(uid) { const m = db.members.find((x) => x.user_id === uid); return m ? clone(m) : null; },
  async memberByEmail(email) { const m = db.members.find((x) => x.email === email.toLowerCase()); return m ? clone(m) : null; },
  async memberInsert(m) { const r: Member = { id: nextId(), subject: '', active: true, created_at: now(), last_login_at: null, ...m, email: m.email.toLowerCase() } as Member; db.members.push(r); save(); return clone(r); },
  async memberPatch(id, p) { const m = db.members.find((x) => x.id === id); if (m) Object.assign(m, p); save(); },
  async members() { return clone(db.members); },
  async names(uids) { const o: Record<string, string> = {}; for (const m of db.members) if (m.user_id && uids.includes(m.user_id)) o[m.user_id] = m.name || m.email.split('@')[0]; return o; },
  async settings() { return { ...db.settings }; },
  async settingsSave(rows) { for (const r of rows) db.settings[r.k] = r.v; save(); },
  async overrides() { return clone(db.kb_overrides); },
  async designs({ deleted, limit }) {
    const list = db.designs.filter((d) => (deleted ? !!d.deleted_at : !d.deleted_at));
    list.sort((a, z) => String(deleted ? z.deleted_at : z.updated_at).localeCompare(String(deleted ? a.deleted_at : a.updated_at)));
    return clone(list.slice(0, limit));
  },
  async design(id, o = {}) { const d = db.designs.find((x) => x.id === id && (o.deleted || !x.deleted_at)); return d ? clone(d) : null; },
  async designInsert(d) {
    const r: Design = { id: nextId(), owner_id: d.owner_id!, title: d.title!, subject: d.subject ?? '', grade: d.grade ?? '', semester: d.semester ?? '', status: 'draft', format: d.format ?? 'core',
      core: clone(d.core), shared: false, deleted_at: null, deleted_by: null, copied_from: d.copied_from ?? null, created_at: now(), updated_at: now() };
    db.designs.push(r); save(); return r.id;
  },
  async designPatch(id, p) { const d = db.designs.find((x) => x.id === id); if (d) Object.assign(d, clone(p)); save(); },
  async syncTargets(id, targets) {
    db.targets = db.targets.filter((t) => t.design_id !== id).concat(targets.map((t: any) => ({ design_id: id, type: t.type, key: t.key ?? '', text: String(t.text ?? '').slice(0, 500), assessed: Number(t.assessed) === 1, tags: [...new Set<string>(t.tags ?? [])] })));
    save();
  },
  async clearTargets(id) { db.targets = db.targets.filter((t) => t.design_id !== id); save(); },
  async chat(designId, limit) { return clone(db.chat.filter((m) => m.design_id === designId).slice(-limit)); },
  async chatAdd(designId, rows) { for (const m of rows) db.chat.push({ id: nextId(), design_id: designId, role: m.role, content: m.content, user_id: m.user_id ?? null, ai_log_id: m.ai_log_id ?? null, created_at: now() }); save(); },
  async chatClear(designId) { db.chat = db.chat.filter((m) => m.design_id !== designId); save(); },
  async chatRecent(uid, since) { return db.chat.filter((m) => m.user_id === uid && m.role === 'user' && String(m.created_at) > since).length; },
  async draft(uid, limit) { return clone(db.draft.filter((m) => m.user_id === uid).slice(-limit)); },
  async draftAdd(uid, rows) { for (const m of rows) db.draft.push({ id: nextId(), user_id: uid, role: m.role, content: m.content, created_at: now() }); db.draft = db.draft.filter((m) => m.user_id !== uid).concat(db.draft.filter((m) => m.user_id === uid).slice(-40)); save(); },
  async draftClear(uid) { db.draft = db.draft.filter((m) => m.user_id !== uid); save(); },
  async draftRecent(uid, since) { return db.draft.filter((m) => m.user_id === uid && m.role === 'user' && String(m.created_at) > since).length; },
  async aiUsage(uid) {
    const k = new Date(Date.now() + 9 * 3600e3); const day = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600e3).toISOString();
    const month = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600e3).toISOString();
    const mine = db.ai_logs.filter((l) => l.user_id === uid), m = (l: any) => l.created_at >= month, sum = (a: any[]) => a.reduce((s, l) => s + Number(l.cost_krw || 0), 0);
    return { user_day_calls: mine.filter((l) => l.created_at >= day).length, user_month_calls: mine.filter(m).length, user_month_cost: sum(mine.filter(m)),
      school_month_calls: db.ai_logs.filter(m).length, school_month_cost: sum(db.ai_logs.filter(m)) };
  },
  async aiLog(row) { const id = nextId(); db.ai_logs.push({ id, created_at: now(), ...row, input_text: '', output_text: '' }); save(); return id; },
  async stdCacheGet(key, since) { const h = db.std_cache[key]; return h && h.created_at > since ? clone(h.result) : null; },
  async stdCachePut(row) { db.std_cache[row.cache_key] = { result: clone(row.result), created_at: now() }; save(); },
  async linkStats() {
    const { default: seed } = await import('../../supabase/functions/class-designer-fn/lib/data/core_seed.json');
    const live = new Set(db.designs.filter((d) => !d.deleted_at).map((d) => d.id));
    const codes: { tag_code: string; kind: string; name: string; sort: number }[] = [
      ...(seed as any).values.map((v: any, i: number) => ({ tag_code: 'VAL:' + v.code, kind: 'value', name: v.code, sort: i + 1 })),
      ...(seed as any).competencies.map((v: any, i: number) => ({ tag_code: 'COMP:' + v.name, kind: 'competency', name: v.name, sort: 11 + i })),
      ...(seed as any).goals.map((v: any, i: number) => ({ tag_code: 'GOAL:' + v.code, kind: 'goal', name: v.text, sort: 21 + i })),
    ];
    const ts = db.targets.filter((t) => live.has(t.design_id));
    return codes.map((c) => { const hit = ts.filter((t) => t.tags.includes(c.tag_code)); const ids = (f: (t: any) => boolean) => new Set(hit.filter(f).map((t) => t.design_id)).size;
      return { ...c, designs: ids(() => true), assessed_designs: ids((t) => t.assessed), taught_designs: ids((t) => t.tags.includes('TAUGHT:1')), total_designs: live.size }; });
  },
  async uncovered() {
    const byId = new Map(db.designs.filter((d) => !d.deleted_at).map((d) => [d.id, d]));
    return db.targets.filter((t) => t.type === 'goal' && !t.assessed && byId.has(t.design_id)).slice(0, 100).map((t) => ({ design_id: t.design_id, title: byId.get(t.design_id)!.title, target_key: t.key, text: t.text }));
  },
  async counts(monthStart) { return { designs: db.designs.filter((d) => !d.deleted_at).length, users: db.members.length, ai: db.ai_logs.filter((l) => l.created_at >= monthStart).length }; },
  async kbVersions(ds, sec) { return clone(db.kb_versions.filter((v) => v.dataset === ds && v.section === sec).slice(-30).reverse()); },
  async kbVersion(id) { const v = db.kb_versions.find((x) => x.id === id); return v ? clone(v) : null; },
  async kbSave(ds, sec, data, uid, action, note) { db.kb_versions.push({ id: nextId(), dataset: ds, section: sec, data: clone(data), action, note, user_id: uid, created_at: now() }); (db.kb_overrides[ds] ??= {})[sec] = clone(data); save(); },
  async kbReset(ds, sec, uid) { db.kb_versions.push({ id: nextId(), dataset: ds, section: sec, data: null, action: 'reset', note: '기본값으로 되돌림', user_id: uid, created_at: now() }); if (db.kb_overrides[ds]) delete db.kb_overrides[ds][sec]; save(); },
};
