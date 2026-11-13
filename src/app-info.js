// 허브(BMR APPS)에 적힌 이 앱의 이름·설명을 읽어 옵니다.
// 관리자가 허브에서 앱 정보를 고치면, 앱을 다시 배포하지 않아도 새로고침만 하면 바뀝니다.
// 내 앱 화면에서도 쓸 수 있어요:  import { loadAppInfo } from './app-info.js';  const info = await loadAppInfo();
export const APP_SLUG = 'class-designer';

/** { slug, name, description, status, url } 또는 null (허브에 없거나 연결 실패) */
export async function loadAppInfo() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/app_public_info`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: APP_SLUG }),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** data-app-name / data-app-desc 가 붙은 요소와 문서 제목에 허브의 이름·설명을 넣습니다 */
export async function applyAppInfo(titleSuffix = '') {
  const info = await loadAppInfo();
  if (!info?.name) return null;
  for (const el of document.querySelectorAll('[data-app-name]')) el.textContent = info.name;
  for (const el of document.querySelectorAll('[data-app-desc]')) {
    el.textContent = info.description || '';
    el.hidden = !info.description;
  }
  document.title = info.name + titleSuffix;
  return info;
}
