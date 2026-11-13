// 별무리 수업 디자이너 — 화면 진입점 (BMR APPS 스타일)
import '@fontsource-variable/figtree';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/app.css';
import './wizard/info.js';
import { ApiError, call, configured, health, isPreview, setPreview } from './api';
import { supabase } from './supabase.js';
import { loginWithGoogle, logout } from './auth.js';
import { loadAppInfo } from './app-info.js';
import { $, clear, h, ROLE_KO } from './dom';
import { BASE, link, nav, route } from './router';

export type Me = { id: string; name: string; email: string | null; role: string; subject: string; preview?: boolean };
const app = () => $('app');

// ---------- 머리줄 ----------
function header(me: Me | null) {
  const n = $('topnav'); clear(n); if (!me) return;
  const r = route();
  const item = (href: string, text: string, on: boolean) => h('a', { href, class: 'nav-item' + (on ? ' on' : ''), 'aria-current': on ? 'page' : null, 'data-nav': '', text });
  const staff = me.role === 'admin' || me.role === 'researcher';
  const links = h('div', { class: 'nav-links' }, item(link(''), '내 설계안', r.name === 'home' || r.name === 'design'),
    staff ? item(link('stats'), '연결 통계', r.name === 'stats') : null, staff ? item(link('admin'), '관리', r.name === 'admin') : null);
  const who = h('span', { class: 'who' }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: (me.name || me.email || '?').trim().slice(0, 1) }),
    h('span', { class: 'who-txt' }, h('b', { text: me.name || (me.email ?? '').split('@')[0] }), h('small', { text: ROLE_KO[me.role] ?? me.role })));
  const out = h('button', { type: 'button', class: 'ghost small', text: me.preview ? '미리보기 끝내기' : '로그아웃', onclick: async () => {
    if (me.preview) setPreview(false); else await logout(); nav('', undefined, true); } });
  n.append(links, who, out);
}
function banner(me: Me | null) {
  const b = $('banner'); clear(b);
  if (!me?.preview) return;
  b.append(h('div', { class: 'preview-bar', role: 'note' },
    h('b', { text: '미리보기' }), h('span', { text: '서버 없이 이 브라우저에만 저장됩니다 · Alter 는 예시 답을 보여 줍니다' }),
    h('button', { type: 'button', class: 'ghost small', text: '미리보기 데이터 지우기', onclick: async () => {
      if (!confirm('이 브라우저의 미리보기 설계안을 모두 지울까요?')) return;
      (await import('./preview/repo')).localRepo.reset(); nav('', '미리보기 데이터를 지웠습니다.', true); } })));
}

// ---------- 들어오기 전 화면 ----------
const ART = '<div class="art" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i><i class="f"></i></div>';
function hero(kicker: string, title: string, body: (Node | string)[], actions: Node[]) {
  const s = h('section', { class: 'hero' }, h('div', { class: 'copy' }, h('span', { class: 'eyebrow', text: kicker }), h('h1', { text: title }), ...body, h('div', { class: 'hero-actions' }, actions)));
  s.insertAdjacentHTML('beforeend', ART); return s;
}
const previewBtn = () => h('button', { type: 'button', class: 'ghost', text: '미리보기로 둘러보기', onclick: () => { setPreview(true); nav('', undefined, true); } });
async function loginView(a: HTMLElement, msg = '') {
  const st = configured ? await health() : 'offline';
  a.append(hero('BMR APPS · 별무리 교육연구소', '별무리 수업 디자이너', [
    h('p', { class: 'desc', text: '아이디어 한 줄에서 정체성·핵심 질문·루브릭·4MAT 수업까지. Alter가 단계마다 함께 고민합니다.' }),
    msg ? h('p', { class: 'notice bad', role: 'alert', text: msg }) : null as any,
    st !== 'ready' ? h('p', { class: 'notice', text: '서버 준비 중입니다. 지금은 미리보기로 둘러볼 수 있어요.' }) : null as any,
  ].filter(Boolean), [h('button', { type: 'button', class: 'btn-google', onclick: () => loginWithGoogle() }, h('span', { class: 'g', 'aria-hidden': 'true', text: 'G' }), '구글로 로그인'), previewBtn()]));
  a.append(h('section', { class: 'steps-strip', 'aria-label': '설계 흐름' }, ['시작', '정체성', '핵심 주제', '선수과목', '핵심 교과', '핵심 질문', '역량', '성취기준', '평가', '수업']
    .map((t, i) => h('span', { class: 'strip-step' }, h('b', { text: String(i + 1) }), t))));
  a.append(h('p', { class: 'muted center small', text: '별무리학교 구글 계정(@bmrschool.org)으로 로그인하세요. 학생 개인정보는 쓰지 않습니다.' }));
}
function stateView(a: HTMLElement, kicker: string, title: string, text: string, actions: Node[]) {
  a.append(h('section', { class: 'card state-card' }, h('span', { class: 'eyebrow', text: kicker }), h('h1', { text: title }), h('p', { text }), h('div', { class: 'row wrap' }, actions)));
}

// ---------- 라우팅 ----------
let rendering = 0;
async function render() {
  const my = ++rendering;
  const a = app(); clear(a); a.append(h('p', { class: 'booting', text: '불러오는 중…' }));
  document.body.classList.remove('print-layout');
  const r = route();
  let me: Me | null = null;
  const done = () => { if (my !== rendering) return false; clear(a); return true; };
  if (!isPreview()) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { if (!done()) return; header(null); banner(null); return loginView(a); }
  }
  try { me = await call('me'); }
  catch (e) {
    if (!done()) return; header(null); banner(null);
    const x = e as ApiError;
    if (x.status === 401) { await logout(); return loginView(a, '로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
    if (x.status === 403 && x.data?.not_member) return stateView(a, '멤버 확인', '이 앱 멤버가 아니에요', x.message, [h('button', { type: 'button', onclick: async () => { await logout(); nav('', undefined, true); }, text: '다른 계정으로 로그인' }), previewBtn()]);
    return stateView(a, '서버 준비 중', '아직 서버가 준비되지 않았어요', '관리자가 서버 함수와 데이터베이스를 준비하면 바로 쓸 수 있습니다. 그동안 미리보기로 둘러볼 수 있어요. (' + x.message + ')',
      [h('button', { type: 'button', text: '다시 시도', onclick: () => render() }), previewBtn()]);
  }
  if (!done() || !me) return;
  header(me); banner(me);
  if (r.name === 'print') { document.body.classList.add('print-layout'); return (await import('./views/print')).render(a, me, r.id!); }
  if (r.name === 'home') return (await import('./views/home')).render(a, me);
  if (r.name === 'design') return (await import('./views/core')).render(a, me, r.id!);
  if (r.name === 'stats') return (await import('./views/stats')).render(a, me);
  if (r.name === 'admin') return (await import('./views/admin')).render(a, me);
  a.append(h('section', { class: 'card state-card' }, h('h1', { text: '페이지가 없습니다' }), h('p', {}, h('a', { href: link(''), 'data-nav': '', text: '내 설계안으로' }))));
}
const safeRender = () => render().catch((e) => { console.error(e); const a = app(); clear(a); stateView(a, '오류', '문제가 생겼습니다', e?.message || String(e), [h('a', { class: 'btn', href: link(''), text: '처음으로' })]); });

// 앱 안 링크는 다시 불러오지 않고 화면만 바꿈 (새 탭·다른 앱 주소는 그대로)
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
  if (!el || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || el.target === '_blank' || el.hasAttribute('download')) return;
  const u = new URL(el.href, location.href);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE) || (u.pathname === location.pathname && u.search === location.search && u.hash)) return;
  e.preventDefault(); nav(u.pathname + u.search);
});
document.addEventListener('submit', (e) => {
  const f = e.target as HTMLFormElement; if (e.defaultPrevented || (f.method || 'get').toLowerCase() !== 'get' || !f.getAttribute('action')) return;
  const u = new URL(f.action, location.href); if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
  e.preventDefault(); const q = new URLSearchParams(new FormData(f) as any).toString(); nav(u.pathname + (q ? '?' + q : ''));
});
window.addEventListener('cd:go', (e) => { const d = (e as CustomEvent).detail; nav(d.path, d.msg); });
window.addEventListener('cd:route', () => { window.scrollTo(0, 0); safeRender(); });
window.addEventListener('popstate', () => safeRender());
supabase.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { if (!isPreview()) safeRender(); } });
// 허브에서 고친 앱 이름을 머리줄에 반영 (실패하면 처음 이름 그대로)
loadAppInfo().then((i) => { if (i?.name) document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = i.name; }); });
safeRender();
