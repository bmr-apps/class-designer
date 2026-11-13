// 마이그레이션 SQL 을 실제 DB 없이 미리 시험합니다 (PGlite: 브라우저/Node 용 Postgres).
// BMR APPS 의 bmr.uid() 등은 흉내 낸 것으로 바꿔 넣습니다. 사용: node scripts/check-migrations.mjs
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const db = new PGlite();
const q = (s, p) => db.query(s, p);
await db.exec(`
  create role anon; create role authenticated;
  create schema bmr; create schema class_designer; create schema extensions;
  create function bmr.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema bmr, class_designer to anon, authenticated;
  grant execute on function bmr.uid() to anon, authenticated;
`);
const dir = 'supabase/migrations';
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(`set search_path = class_designer, extensions; ${readFileSync(`${dir}/${f}`, 'utf8')}`);
  console.log('✓', f);
}
const A = '00000000-0000-0000-0000-00000000000a', T = '00000000-0000-0000-0000-00000000000b', U = '00000000-0000-0000-0000-00000000000c';
await q(`insert into class_designer.members (user_id, email, role) values ($1,'admin@bmrschool.org','admin'), ($2,'t@bmrschool.org','teacher'), ($3,'u@bmrschool.org','teacher')`, [A, T, U]);
const { rows: [d1] } = await q(`insert into class_designer.designs (owner_id, title, core) values ($1, '내 설계', '{}') returning id`, [T]);
await q(`insert into class_designer.designs (owner_id, title, core, shared) values ($1, '공유 설계', '{}', true)`, [U]);
await q(`insert into class_designer.designs (owner_id, title, core) values ($1, '남의 비공개', '{}')`, [U]);
await q(`select class_designer.sync_targets($1, $2)`, [d1.id, JSON.stringify([{ type: 'design', key: 'd', text: 'x', assessed: 0, tags: ['VAL:샬롬', 'COMP:협업능력'] }])]);
console.log('ai_usage', (await q(`select class_designer.ai_usage($1) u`, [T])).rows[0].u);
const as = async (uid, sql) => { await db.exec(`set role authenticated; set test.uid = '${uid}'`); try { return (await q(sql)).rows; } finally { await db.exec('reset role'); } };
const titles = async (uid) => (await as(uid, 'select title from class_designer.designs order by id')).map((r) => r.title).join(', ');
console.log('교사 T 가 보는 설계:', await titles(T));
console.log('관리자 가 보는 설계:', await titles(A));
console.log('비멤버 가 보는 설계:', await titles('00000000-0000-0000-0000-0000000000ff') || '(없음)');
console.log('교사 T 가 보는 멤버 수:', (await as(T, 'select count(*)::int n from class_designer.members'))[0].n);
console.log('관리자 가 보는 멤버 수:', (await as(A, 'select count(*)::int n from class_designer.members'))[0].n);
console.log('통계(관리자):', (await as(A, `select tag_code, designs from class_designer.link_stats where designs > 0`)).map((r) => `${r.tag_code}=${r.designs}`).join(' '));
for (const [what, sql] of [['교사 쓰기', `insert into class_designer.designs (owner_id, title, core) values ('${T}', 'x', '{}')`], ['sync_targets 실행', `select class_designer.sync_targets(1, '[]')`], ['std_cache 읽기', 'select * from class_designer.std_cache']]) {
  try { await as(T, sql); console.log('✗ 막혀야 하는데 됨:', what); process.exitCode = 1; } catch (e) { console.log('✓ 막힘:', what, '—', e.message); }
}
await db.exec(`set role anon`); try { await q('select * from class_designer.designs'); console.log('✗ 손님이 읽음'); process.exitCode = 1; } catch (e) { console.log('✓ 막힘: 손님 읽기 —', e.message); } await db.exec('reset role');
await q('select class_designer.purge_old()'); console.log('✓ purge_old');
