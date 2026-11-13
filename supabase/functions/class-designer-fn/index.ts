// class-designer-fn — 별무리 수업 디자이너 의 서버 함수 (시작 예시)
// 선생님이 이 파일을 고쳐 저장소에 올리면, 관리자(BMR APPS 봇)가 검토한 뒤 배포합니다.
// 선생님이 직접 배포할 수는 없습니다 (배포에는 프로젝트 전체 관리 토큰이 필요해서).
//
// 이 예시가 보여 주는 것
//  1) 부른 사람 확인: 로그인한 사용자의 토큰이 있으면 Supabase Auth 로 확인 (없으면 손님)
//  2) 앱 전용 비밀값: CLASS_DESIGNER_* 이름의 함수 비밀값만 씁니다 (예: CLASS_DESIGNER_EXAMPLE_KEY)
//  3) 이 앱 스키마(class_designer) 조회: 함수 전용 DB 역할(class_designer_fn, 선생님 역할 class_designer_dev 의 권한을 물려받음)로 접속
//     → 다른 앱 스키마·허브 표에는 권한이 없고, 선생님이 자기 비밀번호를 바꿔도 함수는 그대로 동작합니다
//
// 주소: https://psupfmarnyxontorftio.supabase.co/functions/v1/class-designer-fn/<경로>
//   GET  /health            DB 연결 확인
//   GET  /hello             부른 사람(user)과 비밀값 설정 여부
//   GET  /documents?collection=notice   documents 표에서 최근 20개
//   POST /documents         (로그인 필요) { "collection": "notice", "data": { … } } 저장
import postgres from 'npm:postgres@3.4.5';

const FN = 'class-designer-fn';
const SCHEMA = 'class_designer';
const PREFIX = 'CLASS_DESIGNER_'; // 이 앱이 쓸 수 있는 비밀값 이름 앞부분
const ORIGINS = ['https://apps.bmrschool.net', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];

const secret = (name: string) => Deno.env.get(PREFIX + name) ?? '';
const DB_URL = secret('DB_URL');
// 서버리스라 연결을 적게: 최대 2개, 20초 쉬면 닫음. 트랜잭션 풀러(6543)라 prepare 끔
const db = DB_URL ? postgres(DB_URL, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} }) : null;

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
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

type User = { id: string; email: string | null } | null;
/** Authorization: Bearer <사용자 토큰> 이 있으면 Supabase Auth 에 물어 확인한다. 공개 키·잘못된 토큰이면 손님(null). */
async function getUser(req: Request): Promise<User> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
  const token = m?.[1] ?? '';
  if (!token || token.startsWith('sb_') || token.split('.').length !== 3) return null;
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email ?? null } : null;
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
      if (!db) return json(req, 503, { ok: false, db: false });
      await db`select 1`; return json(req, 200, { ok: true, db: true });
    }
    const user = await getUser(req);
    if (path === '/hello') {
      return json(req, 200, { app: SCHEMA, user, example_secret_set: Boolean(secret('EXAMPLE_KEY')), time: new Date().toISOString() });
    }
    if (!db) return json(req, 503, { error: '서버 설정이 아직 끝나지 않았습니다 (DB 연결 정보 없음).' });
    if (path === '/documents' && req.method === 'GET') {
      const c = new URL(req.url).searchParams.get('collection') ?? '';
      if (!c || c.length > 100) return json(req, 400, { error: 'collection 을 적어 주세요.' });
      // 함수는 표 주인 역할로 접속하므로 RLS 를 거치지 않는다 → 보여 줄 범위는 여기 코드에서 직접 정한다
      const rows = await db`select id, collection, data, owner, created_at from ${db(SCHEMA)}.documents
        where collection = ${c} order by created_at desc limit 20`;
      return json(req, 200, { documents: rows });
    }
    if (path === '/documents' && req.method === 'POST') {
      if (!user) return json(req, 401, { error: '로그인이 필요합니다.' });
      const t = await req.text();
      if (t.length > 16384) return json(req, 413, { error: '요청이 너무 큽니다.' });
      let b: { collection?: unknown; data?: unknown };
      try { b = JSON.parse(t); } catch { return json(req, 400, { error: 'JSON 형식이 아닙니다.' }); }
      if (typeof b.collection !== 'string' || !b.collection || b.collection.length > 100) return json(req, 400, { error: 'collection 형식이 올바르지 않습니다.' });
      if (typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) return json(req, 400, { error: 'data 는 JSON 객체여야 합니다.' });
      const [row] = await db`insert into ${db(SCHEMA)}.documents (collection, data, owner)
        values (${b.collection}, ${db.json(b.data as Record<string, never>)}, ${user.id}) returning id, collection, data, owner, created_at`;
      return json(req, 201, row);
    }
    return json(req, 404, { error: '없는 경로입니다.' });
  } catch (e) {
    console.error(FN, (e as { code?: string })?.code ?? '', (e as Error)?.message ?? e);
    return json(req, 500, { error: '서버 오류가 났습니다.', code: (e as { code?: string })?.code });
  }
});
