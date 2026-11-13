// supabase/migrations/*.sql 을 이름 순서대로 한 번씩 실행합니다.
// 실행 기록은 이 앱 스키마의 _migrations 표에 남깁니다 (다른 앱과 섞이지 않음).
// 사용: .env.local 에 DATABASE_URL 을 넣고 → npm run db:migrate
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import pg from 'pg';

const SCHEMA = 'class_designer';
function env(name) {
  if (process.env[name]) return process.env[name];
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}
const url = env('DATABASE_URL');
if (!url || url.includes('여기에_비밀번호')) { console.error('.env.local 에 DATABASE_URL 을 넣어 주세요 (허브 https://apps.bmrschool.net/hub/apps → 내 서비스 → 이 앱 → 앱 정보 → DB 접속 정보에서 받은 비밀번호).'); process.exit(1); }
const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(`create table if not exists ${SCHEMA}._migrations (name text primary key, applied_at timestamptz not null default now())`);
const done = new Set((await c.query(`select name from ${SCHEMA}._migrations`)).rows.map((r) => r.name));
let n = 0;
for (const f of files) {
  if (done.has(f)) continue;
  process.stdout.write(`• ${f} … `);
  try {
    await c.query('begin');
    await c.query(`set local search_path = ${SCHEMA}, extensions`);
    await c.query(readFileSync(`${dir}/${f}`, 'utf8'));
    await c.query(`insert into ${SCHEMA}._migrations (name) values ($1)`, [f]);
    await c.query('commit'); n++; console.log('완료');
  } catch (e) { await c.query('rollback'); console.log('실패'); console.error(e.message); await c.end(); process.exit(1); }
}
console.log(n ? `${n}개 적용했습니다.` : '새로 적용할 파일이 없습니다.');
await c.end();
