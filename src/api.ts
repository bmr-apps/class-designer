// 서버 호출 한곳. 실제 모드는 서버 함수 class-designer-fn(/api), 미리보기 모드는 이 브라우저 안에서 같은 코드를 돌린다.
import { supabase, FN_URL } from './supabase.js';
import { session } from './store.js';

export class ApiError extends Error { constructor(msg: string, public status: number, public data: any = null) { super(msg); } }
const httpMsg = (s: number) => s === 401 || s === 0 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : s === 403 ? '권한이 없습니다.' : s === 404 ? '찾을 수 없습니다.'
  : s === 429 ? '요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.' : s >= 500 ? '서버에 일시적인 문제가 있습니다. 잠시 뒤 다시 시도하세요.' : '요청을 처리하지 못했습니다.';

export const configured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
/** 미리보기 모드: 서버 없이 이 브라우저에만 저장 (탭을 닫으면 모드는 꺼지고, 데이터는 남음) */
export const isPreview = () => !configured || session.get('preview', false) === true;
export function setPreview(on: boolean) { if (on) session.set('preview', true); else session.remove('preview'); }

let previewCall: ((action: string, body: Record<string, unknown>) => Promise<any>) | null = null;
async function preview(action: string, body: Record<string, unknown>) {
  if (!previewCall) previewCall = (await import('./preview/backend')).call;
  return previewCall(action, body);
}

/** POST {action, ...body}. 오류는 ApiError(메시지는 사람이 읽을 수 있게) */
export async function call(action: string, body: Record<string, unknown> = {}): Promise<any> {
  if (isPreview()) return preview(action, body);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(httpMsg(401), 401);
  let r: Response;
  try {
    r = await fetch(`${FN_URL}/api`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...body, action }),
    });
  } catch { throw new ApiError('서버에 연결하지 못했습니다. 인터넷 연결을 확인하거나 잠시 뒤 다시 시도하세요.', 0, { offline: true }); }
  const j = await r.json().catch(() => null);
  if (!j) throw new ApiError(httpMsg(r.status) + ' (HTTP ' + r.status + ')', r.status, { not_ready: r.status === 404 || r.status >= 500 });
  if (!r.ok || j.error) throw new ApiError(j.error || httpMsg(r.status), r.status, j);
  return j;
}
export const core = call;
export const adm = call;

/** 서버 준비 상태: 함수 배포·DB 표가 다 되어 있으면 'ready' */
export async function health(): Promise<'ready' | 'no-function' | 'no-db' | 'offline'> {
  try {
    const r = await fetch(`${FN_URL}/health`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) return 'ready';
    return r.status === 404 ? 'no-function' : 'no-db';
  } catch { return 'offline'; }
}
