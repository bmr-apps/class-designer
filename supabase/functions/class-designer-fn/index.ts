// class-designer-fn — 별무리 수업 디자이너 서버 함수
// 선생님이 이 파일을 고쳐 저장소에 올리면, 관리자(BMR APPS)가 검토한 뒤 배포합니다.
//
//   GET  /health   DB 연결 확인
//   GET  /hello    부른 사람과 설정 여부 (비밀값 값은 보여 주지 않음)
//   POST /api      { action, ... }  설계·마법사·Alter·통계·관리 (로그인 + 이 앱 멤버만)
//
// 비밀값 (함수 비밀값, 이름은 CLASS_DESIGNER_ 로 시작)
//   CLASS_DESIGNER_DB_URL          함수 전용 DB 계정 접속 주소 (BMR APPS 가 넣어 둠)
//   CLASS_DESIGNER_GEMINI_API_KEY  Alter(Gemini) 키 — 관리자에게 값 전달
//
// 함수는 표 주인 권한으로 접속해 RLS 를 거치지 않습니다. 읽기·쓰기 권한은 lib/actions.ts 에서 직접 확인합니다.
// 학생 개인정보로 보이는 글(전화번호·학번+이름 등)은 AI 로 보내기 전에 막습니다 (lib/pii.ts).
import postgres from 'npm:postgres@3.4.5';
import { resolveMember, run, type AuthUser, type Ctx, type Env } from './lib/actions.ts';
import { HttpError } from './lib/errors.ts';
import { pgRepo } from './lib/pg.ts';
import { gemini } from './lib/gemini.ts';
import { STANDARDS } from './lib/standards.ts';

const FN = 'class-designer-fn';
const ORIGINS = ['https://apps.bmrschool.net', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const DB_URL = Deno.env.get('CLASS_DESIGNER_DB_URL') ?? '';
// 서버리스라 연결을 적게: 최대 2개, 20초 쉬면 닫음. 트랜잭션 풀러(6543)라 prepare 끔
const sql = DB_URL ? postgres(DB_URL, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} }) : null;
const env: Env | null = sql ? { repo: pgRepo(sql), ai: gemini, standards: () => STANDARDS } : null;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600', Vary: 'Origin',
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

/** Authorization: Bearer <사용자 토큰> 을 Supabase Auth 에 물어 확인. 공개 키·잘못된 토큰이면 null */
async function getUser(req: Request): Promise<AuthUser | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
  const token = m?.[1] ?? '';
  if (!token || token.startsWith('sb_') || token.split('.').length !== 3) return null;
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  const meta = u.user_metadata ?? {};
  // 이름은 표시용으로만 쓴다 (권한 판단에는 user_metadata 를 쓰지 않음)
  return { id: u.id, email: String(u.email ?? '').toLowerCase(), name: String(meta.full_name ?? meta.name ?? '').slice(0, 100), verified: !!u.email_confirmed_at };
}
const route = (req: Request) => {
  const p = new URL(req.url).pathname; const i = p.indexOf('/' + FN);
  return (i < 0 ? '/' : p.slice(i + FN.length + 1)).replace(/\/+$/, '') || '/';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const o = req.headers.get('Origin');
  if (o && !ORIGINS.includes(o)) return json(req, 403, { error: '허용되지 않은 출처입니다.' });
  const path = route(req);
  try {
    if (path === '/health') {
      if (!sql) return json(req, 503, { ok: false, db: false });
      await sql`select 1 from class_designer.members limit 1`; return json(req, 200, { ok: true, db: true });
    }
    if (path === '/hello') {
      const user = await getUser(req);
      return json(req, 200, { app: 'class_designer', user: user ? { id: user.id, email: user.email } : null, db: !!sql, gemini_key_set: gemini.hasKey(), time: new Date().toISOString() });
    }
    if (path !== '/api' || req.method !== 'POST') return json(req, 404, { error: '없는 경로입니다.' });
    if (!env) return json(req, 503, { error: '서버 설정이 아직 끝나지 않았습니다 (DB 연결 정보 없음).' });
    const raw = await req.text();
    if (raw.length > 400_000) return json(req, 413, { error: '요청이 너무 큽니다.' });
    let body: Record<string, unknown> = {};
    try { const b = raw ? JSON.parse(raw) : {}; body = b && typeof b === 'object' && !Array.isArray(b) ? b : {}; } catch { return json(req, 400, { error: 'JSON 형식이 아닙니다.' }); }
    const user = await getUser(req);
    if (!user) return json(req, 401, { error: '로그인이 필요합니다. 다시 로그인해 주세요.' });
    const me = await resolveMember(env.repo, user);
    const c: Ctx = { uid: user.id, me, env };
    const out = await run(c, body);
    // 오래된 AI 기록·캐시·초안 대화 정리 (대략 50번에 한 번, 실패해도 무시)
    if (Math.random() < 0.02) sql!`select class_designer.purge_old()`.catch(() => {});
    return json(req, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message, code: e.status, ...e.extra });
    console.error(FN, (e as { code?: string })?.code ?? '', (e as Error)?.message ?? e);
    return json(req, 500, { error: '서버 오류가 났습니다. 잠시 뒤 다시 시도하세요.' });
  }
});
