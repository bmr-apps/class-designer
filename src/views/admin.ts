// 운영 관리 (원본 views/admin.php): 개요·성취기준 DB(연구소·관리자), 사용자·계정·설정·AI 지식(관리자)
import { adm } from '../api';
import { link, nav } from '../router';
import { go, h, kst, ROLE_KO, takeFlash } from '../dom';
import type { Me } from '../main';

const ROLES = Object.entries(ROLE_KO);
const roleSel = (name: string, val = 'teacher', form?: string) => h('select', { name, form }, ROLES.map(([k, v]) => h('option', { value: k, selected: k === val, text: v })));
const table = (head: string[], rows: Node[]) => h('div', { class: 'wz-table' }, h('table', {}, h('thead', {}, h('tr', {}, head.map((t) => h('th', { text: t })))), h('tbody', {}, rows)));
const confirmBtn = (text: string, msg: string, fn: () => Promise<void>, cls = 'btn btn-secondary btn-sm') => h('button', { type: 'button', class: cls, text, onclick: async () => { if (msg && !confirm(msg)) return; await fn(); } });

export async function render(a: HTMLElement, me: Me) {
  if (me.role !== 'admin' && me.role !== 'researcher') { a.append(h('section', { class: 'card narrow' }, h('p', { class: 'err', text: '권한이 없습니다.' }))); return; }
  const isAdmin = me.role === 'admin', qs = new URLSearchParams(location.search);
  const tabs: Record<string, string> = { overview: '개요', standards: '성취기준 DB', ...(isAdmin ? { users: '멤버·권한', settings: '설정 (AI)', kb: 'AI 지식·데이터' } : {}) };
  let tab = qs.get('tab') || 'overview'; if (!tabs[tab]) tab = 'overview';
  a.append(h('section', { class: 'card wz-page-head admin' }, h('p', { class: 'wz-kicker', text: '관리' }), h('h1', { text: '운영 관리' }),
    h('nav', { class: 'wz-tabs', 'aria-label': '관리 메뉴' }, Object.entries(tabs).map(([k, v]) => h('a', { href: link('admin?tab=' + k), class: tab === k ? 'on' : '', 'aria-current': tab === k ? 'page' : null, text: v })))));
  const box = h('section', { class: 'card admin', id: 'admin-body' }); a.append(box);
  const msgEl = h('p', { class: 'hint', id: 'admin-msg', role: 'status' }); const fm = takeFlash(); msgEl.textContent = fm; msgEl.hidden = !fm;
  const say = (t: string, bad = false) => { msgEl.textContent = t; msgEl.hidden = !t; msgEl.classList.toggle('flash-err', bad); msgEl.scrollIntoView({ block: 'nearest' }); };
  const run = async (fn: () => Promise<any>, reload = true) => { try { const r = await fn(); if (reload) go(location.pathname + location.search, r?.msg); return r; } catch (e: any) { say(e.message, true); return null; } };
  box.append(msgEl);

  if (tab === 'overview') {
    const j = await adm('overview');
    box.append(h('div', { class: 'wz-stats' }, [[j.counts.designs, '중핵 설계안'], [j.counts.users, '사용자'], [Number(j.counts.std).toLocaleString('ko-KR'), '2022 성취기준'], [j.counts.ai, '이번 달 AI 호출']]
      .map(([n, l]) => h('div', {}, h('b', { text: String(n) }), h('span', { text: String(l) })))));
    box.append(h('div', { class: 'wz-listhead' }, h('h2', { text: '최근 설계안' }), h('a', { href: link('stats'), text: '별무리 연결 통계 →' })));
    box.append(table(['제목', '학년', '작성자', '수정'], j.recent.length ? j.recent.map((r: any) => h('tr', {}, h('td', {}, h('a', { href: link(`designs/${r.id}`), text: r.title })), h('td', { text: r.grade }), h('td', { text: r.owner }), h('td', { class: 'muted', text: kst(r.updated_at) })))
      : [h('tr', {}, h('td', { colspan: '4', class: 'muted', text: '아직 설계안이 없습니다.' }))]));
    if (isAdmin && j.trash.length) box.append(h('details', { class: 'trash' }, h('summary', {}, h('h2', { class: 'inline-h' }, '🗑 삭제된 설계 ', h('span', { class: 'badge', text: String(j.trash.length) }))),
      table(['제목', '작성자', '삭제', ''], j.trash.map((r: any) => h('tr', {}, h('td', { text: r.title }), h('td', { text: r.owner }), h('td', { class: 'muted', text: kst(r.deleted_at) }),
        h('td', {}, confirmBtn('복원', '', () => run(() => adm('design_restore', { id: r.id })))))))));
    box.append(h('p', { class: 'hint', text: '핵심 가치·역량·교수법 등 설계 지식은 「별무리 핵심 역량 평가 루브릭 안내서」를 바탕으로 한 지식 파일(core_seed.json)에서 불러옵니다. 관리자는 「AI 지식·데이터」 탭에서 고칠 수 있습니다.' }));
  }

  else if (tab === 'standards') {
    const q = qs.get('q') || '', subj = qs.get('subject') || '';
    const j = await adm('standards', { q, subject: subj });
    const subjects = Object.entries(j.subjects as Record<string, number>);
    box.append(h('p', { class: 'muted', text: '2022 개정 교육과정 고등학교 성취기준 (국가교육과정정보센터 NCIC 고시 원문). 중핵 설계의 성취기준 단계가 이 표에서 추천합니다.' }));
    box.append(h('form', { method: 'get', action: link('admin'), class: 'wz-search' }, h('input', { type: 'hidden', name: 'tab', value: 'standards' }),
      h('label', {}, '과목 ', h('select', { name: 'subject' }, h('option', { value: '', text: '전체' }), subjects.map(([s, n]) => h('option', { value: s, selected: s === subj, text: `${s} (${n})` })))),
      h('label', { class: 'grow' }, '검색어 ', h('input', { name: 'q', value: q, placeholder: '코드·영역·내용 (예: 12정보01, 데이터)' })), h('button', { class: 'btn btn-primary', text: '검색' })));
    if (!q && !subj) box.append(h('p', { class: 'muted', text: `과목 ${subjects.length}개. 과목을 고르거나 검색어를 넣으세요.` }));
    else { box.append(h('p', { class: 'muted', text: `${j.stds.length}건${j.stds.length >= 200 ? ' (최대 200건 표시)' : ''}` }));
      box.append(table(['코드', '과목', '영역', '성취기준', '출처'], j.stds.map((r: any) => h('tr', {}, h('td', { class: 'nowrap' }, h('code', { text: r.code })), h('td', { class: 'nowrap' }, r.subject, r.course_type ? [' ', h('span', { class: 'badge', text: r.course_type })] : null),
        h('td', { text: r.domain }), h('td', { text: r.text }), h('td', { class: 'muted', text: (r.source_title || '') + (r.source_page ? ' p.' + r.source_page : '') }))))); }
  }

  else if (tab === 'users') await usersTab(box, me, run, say);
  else if (tab === 'settings') await settingsTab(box, run);
  else if (tab === 'kb') await kbTab(box, qs, run, say);
}

type Run = (fn: () => Promise<any>, reload?: boolean) => Promise<any>;

async function usersTab(box: HTMLElement, me: Me, run: Run, _say: (t: string, b?: boolean) => void) {
  const j = await adm('users');
  box.append(h('p', { class: 'hint' }, '로그인은 BMR APPS 구글 계정으로 합니다. ', h('b', { text: '별무리학교 계정(@bmrschool.org)' }), '은 처음 로그인할 때 교사로 자동 등록되고, 다른 메일은 아래에서 먼저 등록해야 쓸 수 있습니다.'));
  const email = h('input', { name: 'email', type: 'email', required: true, placeholder: 'teacher@example.com', 'aria-label': '메일' });
  const name = h('input', { name: 'name', placeholder: '이름 (선택)', 'aria-label': '이름' });
  const subj = h('input', { name: 'subject', placeholder: '교과 (선택)', 'aria-label': '교과' });
  const role = roleSel('role');
  const add = h('form', { class: 'member-add' }, email, name, subj, role, h('button', { class: 'btn btn-primary', text: '멤버 등록' }));
  add.addEventListener('submit', (e) => { e.preventDefault(); run(() => adm('member_add', { email: email.value, name: name.value, subject: subj.value, role: (role as HTMLSelectElement).value })); });
  box.append(h('h2', { text: '멤버 등록' }), add);
  box.append(h('h2', { text: '멤버' }), table(['메일', '이름', '교과', '역할', '활성', '최근 로그인', ''], j.users.map((u: any) => {
    const nm = h('input', { value: u.name || '', 'aria-label': '이름' }); const sj = h('input', { value: u.subject || '', 'aria-label': '교과' });
    const rl = roleSel('role', u.role); const act = h('input', { type: 'checkbox', checked: !!u.active, 'aria-label': '활성' });
    return h('tr', {}, h('td', {}, u.email, !u.user_id ? [' ', h('span', { class: 'badge', text: '로그인 전' })] : null, u.user_id === me.id ? [' ', h('span', { class: 'badge badge-share', text: '나' })] : null),
      h('td', {}, nm), h('td', {}, sj), h('td', {}, rl), h('td', {}, act), h('td', { class: 'muted', text: kst(u.last_login_at) || '—' }),
      h('td', {}, h('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: '저장', onclick: () => run(() => adm('user_update', { id: u.id, name: (nm as HTMLInputElement).value, subject: (sj as HTMLInputElement).value, role: (rl as HTMLSelectElement).value, active: (act as HTMLInputElement).checked })) })));
  })));
}

async function settingsTab(box: HTMLElement, run: Run) {
  const j = await adm('settings_get'); const s = j.settings;
  box.append(h('p', { class: 'hint' }, 'API 키는 화면에 넣지 않습니다. 서버 함수 비밀값 ', h('code', { text: 'CLASS_DESIGNER_GEMINI_API_KEY' }), '에만 넣습니다 (BMR APPS 관리자). 지금 상태: ',
    h('b', { text: j.preview ? '미리보기 — 실제 AI 를 부르지 않음' : j.keys.gemini ? '✅ 키 있음' : '— 키 없음' })));
  const f = h('form', { class: 'wz-settings', id: 'settings-form' },
    h('label', {}, 'AI 공급자', h('select', { name: 'ai_provider' }, [['gemini', 'Google Gemini'], ['mock', '모의 (키 없이 시험)']].map(([k, v]) => h('option', { value: k, selected: (s.ai_provider || '') === k, text: v })))),
    h('label', {}, '모델 (비우면 gemini-3.8-flash)', h('input', { name: 'ai_model', value: s.ai_model || '' })),
    h('label', {}, '성취기준 검색 모델', h('input', { name: 'std_search_model', value: s.std_search_model || '' })),
    h('label', {}, '자동 등록 도메인', h('input', { name: 'google_domain', value: s.google_domain || 'bmrschool.org' })),
    ([['limit_user_daily_calls', '사용자 하루 호출 수'], ['limit_user_monthly_calls', '사용자 월 호출 수'], ['limit_user_monthly_cost_krw', '사용자 월 비용(원)'], ['limit_school_monthly_calls', '학교 월 호출 수'],
      ['limit_school_monthly_cost_krw', '학교 월 예산(원)'], ['price_in_per_1k_krw', '입력 1천 토큰당 단가(원)'], ['price_out_per_1k_krw', '출력 1천 토큰당 단가(원)'], ['ai_log_retention_days', 'AI 기록 보관 일수 (최대 90)']] as const)
      .map(([k, v]) => h('label', {}, `${v} (0 = 제한 없음)`, h('input', { name: k, value: s[k] ?? '0', inputmode: 'decimal' }))),
    h('div', { class: 'row end' }, h('button', { class: 'btn btn-primary', text: '저장' })));
  f.addEventListener('submit', (e) => { e.preventDefault(); const o: any = Object.fromEntries(new FormData(f).entries()); run(() => adm('settings_save', { settings: o })); });
  const u = j.usage || {};
  box.append(f, h('p', { class: 'muted', text: `이번 달 학교 전체: 호출 ${u.school_month_calls ?? 0}회, 비용 ${Math.round(Number(u.school_month_cost ?? 0)).toLocaleString('ko-KR')}원` }));
}

async function kbTab(box: HTMLElement, qs: URLSearchParams, run: Run, say: (t: string, b?: boolean) => void) {
  const kb = await adm('kb_get', { ds: qs.get('ds') || 'knowledge', sec: qs.get('sec') || '' });
  const kbLink = (ds: string, sec?: string) => link('admin?tab=kb&ds=') + encodeURIComponent(ds) + (sec ? '&sec=' + encodeURIComponent(sec) : '');
  box.append(h('p', { class: 'muted', text: 'AI 프롬프트에 들어가는 별무리 지식과 설계 세부 데이터(가치·역량·주제·교과·루브릭 시드)를 고칩니다. 고친 절만 DB에 저장되고, 나머지는 기본 파일(JSON)을 씁니다. 저장·복원은 모두 이력에 남습니다. 학생 개인정보는 넣지 마세요.' }));
  box.append(h('nav', { class: 'wz-tabs kb-ds', 'aria-label': '데이터 묶음' }, kb.datasets.map((d: any) => h('a', { href: kbLink(d.key), class: kb.ds === d.key ? 'on' : '', text: d.label }))));
  const ta = h('textarea', { name: 'data', class: 'kb-text autogrow' + (kb.isText ? '' : ' mono'), rows: 16, spellcheck: false, 'aria-label': '내용' }); ta.value = kb.text;
  const note = h('input', { name: 'note', maxlength: '200', placeholder: '예: 2027 중핵 과목 반영' });
  const f = h('form', { id: 'kb-form' }, h('label', { class: 'block' }, kb.isText ? '내용 (일반 텍스트)' : '내용 (JSON · 기본값과 같은 구조여야 저장됩니다)', ta),
    h('label', { class: 'block' }, '변경 메모 (선택) ', note),
    h('p', {}, h('button', { class: 'btn btn-primary', text: '검증 후 저장' }), kb.over ? [' ', confirmBtn('기본값으로 되돌리기', '이 절을 기본값(JSON 파일)으로 되돌릴까요? 현재 수정본은 이력에 남습니다.', () => run(() => adm('kb_reset', { ds: kb.ds, sec: kb.sec })), 'btn btn-secondary')] : null));
  f.addEventListener('submit', async (e) => { e.preventDefault(); try { const r = await adm('kb_save', { ds: kb.ds, sec: kb.sec, data: ta.value, note: note.value }); go(location.pathname + location.search, r.msg); } catch (x: any) { say(x.message, true); } });
  const ACT: Record<string, string> = { save: '저장', restore: '복원', reset: '기본값' };
  box.append(h('div', { class: 'kb-wrap' },
    h('ul', { class: 'kb-secs', 'aria-label': '절 목록' }, kb.secs.map((x: any) => h('li', { class: x.key === kb.sec ? 'on' : '' }, h('a', { href: kbLink(kb.ds, x.key) }, x.label, x.label !== x.key ? [' ', h('small', { class: 'muted', text: x.key })] : null), x.over ? [' ', h('span', { class: 'badge kb-over', text: '수정됨' })] : null))),
    h('div', { class: 'kb-edit' }, h('h2', {}, kb.sec, ' ', kb.over ? h('span', { class: 'badge kb-over', text: 'DB 수정본 사용 중' }) : h('span', { class: 'badge', text: '기본값' })), f,
      h('details', {}, h('summary', { text: '기본값 보기 (JSON 파일)' }), h('pre', { class: 'kb-default', text: kb.default })),
      h('h3', { text: '변경 이력' }),
      table(['#', '작업', '메모', '작성자', '시각', ''], kb.history.length ? kb.history.map((x: any) => h('tr', {}, h('td', { text: String(x.id) }), h('td', { text: ACT[x.action] ?? x.action }), h('td', { text: x.note ?? '' }), h('td', { text: x.name ?? '' }), h('td', { class: 'muted', text: kst(x.created_at) }),
        h('td', {}, x.bytes !== null ? confirmBtn('이 버전으로 복원', '이 버전으로 복원할까요?', () => run(() => adm('kb_restore', { vid: x.id }))) : null)))
        : [h('tr', {}, h('td', { colspan: '6', class: 'muted', text: '아직 변경 이력이 없습니다.' }))]))));
  requestAnimationFrame(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; });
}
