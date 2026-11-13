// 미리보기 모드: 서버 함수와 똑같은 처리(lib/actions.ts)를 브라우저에서 돌리고, 데이터는 이 브라우저(localStorage)에만 저장.
// Alter 는 실제 AI 대신 예시 답(모의 응답)을 돌려준다. 학생 개인정보 검사도 그대로 한다.
import { run, type AiPort, type Ctx, type Env } from '../../supabase/functions/class-designer-fn/lib/actions';
import { HttpError } from '../../supabase/functions/class-designer-fn/lib/errors';
import { ApiError } from '../api';
import { localRepo, PREVIEW_USER } from './repo';

const noAi: AiPort = {
  hasKey: () => false,
  generate: async () => { throw new Error('미리보기에서는 실제 AI 를 부르지 않습니다.'); },
  grounded: async () => { throw new Error('미리보기에서는 실제 AI 를 부르지 않습니다.'); },
};
let std: any[] | null = null;
const env: Env = {
  repo: localRepo, ai: noAi, preview: true,
  standards: async () => (std ??= (await import('../../supabase/functions/class-designer-fn/lib/standards')).STANDARDS),
};

export async function call(action: string, body: Record<string, unknown>) {
  const me = await localRepo.ensurePreviewMember();
  const c: Ctx = { uid: PREVIEW_USER.id, me, env };
  // 서버를 거치는 것처럼 JSON 으로 한 번 복사 (화면이 데이터를 직접 바꿔도 저장본은 그대로)
  const b = JSON.parse(JSON.stringify(body ?? {}));
  try { await new Promise((r) => setTimeout(r, 120)); return JSON.parse(JSON.stringify(await run(c, { ...b, action }))); }
  catch (e) {
    if (e instanceof HttpError) throw new ApiError(e.message, e.status, { ...e.extra, error: e.message });
    console.error(e); throw new ApiError('미리보기 처리 중 오류가 났습니다.', 500);
  }
}
