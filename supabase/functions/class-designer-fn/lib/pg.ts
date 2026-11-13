// 서버 함수용 저장소: class_designer 스키마 (함수 전용 DB 계정 class_designer_fn 으로 접속, CLASS_DESIGNER_DB_URL)
// deno-lint-ignore-file no-explicit-any
import type postgres from 'npm:postgres@3.4.5';
import type { Design, Member, Msg, Repo, Role } from './actions.ts';
import type { Overrides } from './kb.ts';

type Sql = ReturnType<typeof postgres>;
const S = 'class_designer';
const DCOLS = 'id, owner_id, title, subject, grade, semester, status, format, core, shared, deleted_at, deleted_by, copied_from, created_at, updated_at';
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v ?? null);
const design = (r: any): Design => ({ ...r, id: Number(r.id), copied_from: r.copied_from == null ? null : Number(r.copied_from), created_at: iso(r.created_at), updated_at: iso(r.updated_at), deleted_at: iso(r.deleted_at) });
const member = (r: any): Member => ({ ...r, id: Number(r.id), created_at: iso(r.created_at), last_login_at: iso(r.last_login_at) });
const msg = (r: any): Msg => ({ role: r.role, content: r.content, created_at: iso(r.created_at), user_id: r.user_id ?? null });

export function pgRepo(sql: Sql): Repo {
  const t = (name: string) => sql(`${S}.${name}`);
  return {
    async memberByUser(uid) {
      const [r] = await sql`update ${t('members')} set last_login_at = now() where user_id = ${uid} returning *`;
      return r ? member(r) : null;
    },
    async memberByEmail(email) { const [r] = await sql`select * from ${t('members')} where email = ${email.toLowerCase()}`; return r ? member(r) : null; },
    async memberInsert(m) {
      const [r] = await sql`insert into ${t('members')} (user_id, email, name, role, subject, last_login_at)
        values (${m.user_id}, ${m.email.toLowerCase()}, ${m.name}, ${m.role}, ${m.subject ?? ''}, ${m.user_id ? new Date() : null}) returning *`;
      return member(r);
    },
    async memberPatch(id, p) {
      const allowed: any = {}; for (const k of ['user_id', 'name', 'subject', 'role', 'active'] as const) if (p[k] !== undefined) allowed[k] = p[k];
      if (Object.keys(allowed).length) await sql`update ${t('members')} set ${sql(allowed)} where id = ${id}`;
    },
    async members() { return (await sql`select * from ${t('members')} order by created_at`).map(member); },
    async names(uids) {
      const u = [...new Set(uids.filter(Boolean))]; if (!u.length) return {};
      const rows = await sql`select user_id, name, email from ${t('members')} where user_id = any(${u}::uuid[])`;
      const o: Record<string, string> = {}; for (const r of rows) o[r.user_id] = r.name || String(r.email).split('@')[0]; return o;
    },
    async settings() { const o: Record<string, string> = {}; for (const r of await sql`select k, v from ${t('settings')}`) o[r.k] = r.v; return o; },
    async settingsSave(rows) {
      for (const r of rows) await sql`insert into ${t('settings')} (k, v) values (${r.k}, ${r.v}) on conflict (k) do update set v = excluded.v`;
    },
    async overrides() {
      const ov: Overrides = {}; for (const r of await sql`select dataset, section, data from ${t('kb_overrides')}`) (ov[r.dataset] ??= {})[r.section] = r.data; return ov;
    },
    async designs({ deleted, limit }) {
      const rows = deleted
        ? await sql`select ${sql.unsafe(DCOLS)} from ${t('designs')} where deleted_at is not null order by deleted_at desc limit ${limit}`
        : await sql`select ${sql.unsafe(DCOLS)} from ${t('designs')} where deleted_at is null order by updated_at desc limit ${limit}`;
      return rows.map(design);
    },
    async design(id, o = {}) {
      const [r] = o.deleted
        ? await sql`select ${sql.unsafe(DCOLS)} from ${t('designs')} where id = ${id}`
        : await sql`select ${sql.unsafe(DCOLS)} from ${t('designs')} where id = ${id} and deleted_at is null`;
      return r ? design(r) : null;
    },
    async designInsert(d) {
      const [r] = await sql`insert into ${t('designs')} (owner_id, title, subject, grade, semester, format, core, copied_from)
        values (${d.owner_id!}, ${d.title!}, ${d.subject ?? ''}, ${d.grade ?? ''}, ${d.semester ?? ''}, ${d.format ?? 'core'}, ${sql.json(d.core)}, ${d.copied_from ?? null}) returning id`;
      return Number(r.id);
    },
    async designPatch(id, p) {
      const o: any = {};
      for (const k of ['title', 'subject', 'grade', 'semester', 'status', 'format', 'shared', 'deleted_at', 'deleted_by', 'updated_at'] as const) if (p[k] !== undefined) o[k] = p[k];
      if (p.core !== undefined) o.core = sql.json(p.core);
      if (Object.keys(o).length) await sql`update ${t('designs')} set ${sql(o)} where id = ${id}`;
    },
    async syncTargets(id, targets) { await sql`select ${sql(S)}.sync_targets(${id}, ${sql.json(targets)})`; },
    async clearTargets(id) { await sql`delete from ${t('plan_targets')} where design_id = ${id}`; },
    async chat(designId, limit) {
      return (await sql`select role, content, created_at, user_id from ${t('chat_messages')} where design_id = ${designId} order by id desc limit ${limit}`).reverse().map(msg);
    },
    async chatAdd(designId, rows) {
      for (const m of rows) await sql`insert into ${t('chat_messages')} (design_id, user_id, role, content, ai_log_id) values (${designId}, ${m.user_id ?? null}, ${m.role}, ${m.content}, ${m.ai_log_id ?? null})`;
    },
    async chatClear(designId) { await sql`delete from ${t('chat_messages')} where design_id = ${designId}`; },
    async chatRecent(uid, since) { const [r] = await sql`select count(*)::int n from ${t('chat_messages')} where user_id = ${uid} and role = 'user' and created_at > ${since}`; return r.n; },
    async draft(uid, limit) {
      return (await sql`select role, content, created_at from ${t('draft_chat_messages')} where user_id = ${uid} order by id desc limit ${limit}`).reverse().map(msg);
    },
    async draftAdd(uid, rows) {
      for (const m of rows) await sql`insert into ${t('draft_chat_messages')} (user_id, role, content) values (${uid}, ${m.role}, ${m.content})`;
      // 최근 40개만 보관
      await sql`delete from ${t('draft_chat_messages')} where user_id = ${uid} and id not in (select id from ${t('draft_chat_messages')} where user_id = ${uid} order by id desc limit 40)`;
    },
    async draftClear(uid) { await sql`delete from ${t('draft_chat_messages')} where user_id = ${uid}`; },
    async draftRecent(uid, since) { const [r] = await sql`select count(*)::int n from ${t('draft_chat_messages')} where user_id = ${uid} and role = 'user' and created_at > ${since}`; return r.n; },
    async aiUsage(uid) { const [r] = await sql`select ${sql(S)}.ai_usage(${uid}) u`; return r.u ?? {}; },
    async aiLog(row) {
      const full: any = { design_id: null, model: '', prompt_version: '', input_text: '', output_text: '', tokens_in: 0, tokens_out: 0, cost_krw: 0, status: 'ok', ...row };
      const [r] = await sql`insert into ${t('ai_logs')} ${sql(full, 'user_id', 'design_id', 'feature', 'provider', 'model', 'prompt_version', 'input_text', 'output_text', 'tokens_in', 'tokens_out', 'cost_krw', 'status')} returning id`;
      return Number(r.id);
    },
    async stdCacheGet(key, since) { const [r] = await sql`select result from ${t('std_cache')} where cache_key = ${key} and created_at > ${since}`; return r?.result ?? null; },
    async stdCachePut(row) {
      await sql`insert into ${t('std_cache')} (cache_key, subject, grade, query, result) values (${row.cache_key}, ${row.subject}, ${row.grade}, ${row.query}, ${sql.json(row.result)})
        on conflict (cache_key) do update set result = excluded.result, created_at = now()`;
    },
    async linkStats() { return (await sql`select * from ${t('link_stats')} order by kind, tag_code`).map((r: any) => ({ ...r, designs: Number(r.designs), assessed_designs: Number(r.assessed_designs), taught_designs: Number(r.taught_designs), total_designs: Number(r.total_designs) })); },
    async uncovered() {
      return [...await sql`select p.design_id, d.title, p.target_key, p.text from ${t('plan_targets')} p join ${t('designs')} d on d.id = p.design_id
        where p.target_type = 'goal' and not p.is_assessed and d.deleted_at is null order by d.updated_at desc limit 100`].map((r: any) => ({ ...r, design_id: Number(r.design_id) }));
    },
    async counts(monthStart) {
      const [r] = await sql`select (select count(*)::int from ${t('designs')} where deleted_at is null and format = 'core') designs,
        (select count(*)::int from ${t('members')}) users, (select count(*)::int from ${t('ai_logs')} where created_at >= ${monthStart}) ai`;
      return r as any;
    },
    async kbVersions(ds, sec) {
      return [...await sql`select id, action, note, created_at, data, user_id from ${t('kb_versions')} where dataset = ${ds} and section = ${sec} order by id desc limit 30`].map((r: any) => ({ ...r, id: Number(r.id), created_at: iso(r.created_at) }));
    },
    async kbVersion(id) { const [r] = await sql`select * from ${t('kb_versions')} where id = ${id}`; return r ? { ...r, id: Number(r.id) } : null; },
    async kbSave(ds, sec, data, uid, action, note) {
      await sql.begin(async (tx: any) => {
        await tx`insert into ${t('kb_versions')} (dataset, section, data, action, note, user_id) values (${ds}, ${sec}, ${sql.json(data)}, ${action}, ${note}, ${uid})`;
        await tx`insert into ${t('kb_overrides')} (dataset, section, data, updated_by, updated_at) values (${ds}, ${sec}, ${sql.json(data)}, ${uid}, now())
          on conflict (dataset, section) do update set data = excluded.data, updated_by = excluded.updated_by, updated_at = now()`;
      });
    },
    async kbReset(ds, sec, uid) {
      await sql`insert into ${t('kb_versions')} (dataset, section, data, action, note, user_id) values (${ds}, ${sec}, null, 'reset', '기본값으로 되돌림', ${uid})`;
      await sql`delete from ${t('kb_overrides')} where dataset = ${ds} and section = ${sec}`;
    },
  };
}
export type { Role };
