// 홈: 새 설계 시작 · 내 설계안 · 공유된 수업 · 저장 전 Alter 대화 (원본 views/home.php + assets/home.js)
import { core } from '../api';
import { $, clear, go, h, infoBtn, kst, takeFlash, tpl } from '../dom';
import type { Me } from '../main';
import { link } from '../router';
import { mdNodes } from '../md';

const START = `
<section class="card wz-page-head home-start">
<p class="wz-kicker">중핵 수업 설계</p>
<div class="home-title-row"><h1>어떤 수업을 해 보고 싶으세요?</h1>
  <button type="button" class="btn btn-ghost info-btn" data-info-key="home.workflow" data-info-title="진행 안내" aria-label="진행 안내 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></div>
<p class="flash" role="status" id="home-flash" hidden></p>
<form class="wz-newform home-idea-form" id="new-form">
<label class="idea-field"><span class="idea-label-row"><span class="label-with-info"><span>수업 아이디어</span>
  <button type="button" class="btn btn-ghost info-btn" data-info-key="home.idea" data-info-title="수업 아이디어" aria-label="수업 아이디어 설명 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></span></span>
  <textarea name="intent" class="input-lg idea-input" rows="5" maxlength="800" placeholder="예: AI가 대신 써 준 글과 ‘내 배움’의 경계를 함께 살펴보고 싶습니다."></textarea></label>
<div class="idea-examples" aria-label="예시 아이디어"><span class="chip-example">예시</span>
  <button type="button" class="btn btn-ghost btn-sm idea-ex" data-idea="생태 위기 뉴스를 함께 읽고, 청지기로서 우리 학교에서 무엇을 할 수 있을지 탐구하고 싶어요.">생태 · 청지기</button>
  <button type="button" class="btn btn-ghost btn-sm idea-ex" data-idea="AI가 대신 써 준 글과 ‘내 배움’의 경계를 함께 살펴보고 싶습니다.">AI · 배움의 경계</button>
  <button type="button" class="btn btn-ghost btn-sm idea-ex" data-idea="사랑한다는 것이 무엇인지, 작품 속 인물의 선택으로 이야기해 보고 싶어요.">인문학 · 사랑</button></div>
<details class="home-settings"><summary><span class="label-with-info"><span>선택 설정</span>
  <button type="button" class="btn btn-ghost info-btn" data-info-key="home.settings" data-info-title="선택 설정" aria-label="선택 설정 설명 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></span></summary>
  <div class="home-settings-grid">
    <label class="home-title-field">제목 <input name="title" maxlength="200" placeholder="비우면 아이디어·기본 제목"></label>
    <label>학년 <select name="grade"><option>10</option><option>11</option><option>12</option></select></label>
    <label>학기 <input name="semester" value="1" maxlength="10" size="5" list="sem-list" placeholder="예: 1, 2, 여름"></label>
    <datalist id="sem-list"><option value="1"><option value="2"><option value="1~2"><option value="여름"><option value="겨울"></datalist>
    <label>학점 <input name="credits" type="number" min="1" max="8" value="2" class="in-xs"></label>
    <label>차시 <input name="sessions" type="number" min="4" max="200" placeholder="학점×18" class="in-sm"></label>
  </div></details>
<p class="error" id="new-err" role="alert"></p>
<div class="home-cta-row"><button class="btn btn-primary btn-lg" type="submit" id="new-btn">이 아이디어로 시작</button></div>
</form></section>`;
const CHAT = `
<button type="button" class="btn btn-primary chat-fab" id="home-chat-open" aria-controls="home-chat" aria-expanded="false">Alter와 대화</button>
<aside class="chat-drawer" id="home-chat" aria-label="저장 전 Alter 도움" hidden>
  <div class="chat-head"><b class="label-with-info">Alter · 저장 전 <button type="button" class="btn btn-ghost info-btn" data-info-key="home.alter" data-info-title="Alter · 저장 전" aria-label="Alter 안내 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></b><button type="button" class="btn btn-ghost btn-sm" id="home-chat-close" aria-label="닫기">✕</button></div>
  <p class="pii-note chat-pii">🔒 학생 개인정보는 쓰지 마세요.</p>
  <div class="chat-log" id="home-chat-log" role="log" aria-live="polite"></div>
  <form class="chat-form" id="home-chat-form"><textarea id="home-chat-input" rows="2" maxlength="1000" placeholder="예: AI 글쓰기와 배움의 경계로 수업을 짜고 싶어요" aria-label="Alter에게 묻기"></textarea>
    <div class="chat-actions"><button type="button" class="btn btn-ghost btn-sm" id="home-chat-clear">기록 지우기</button><span class="muted" id="home-chat-count">0/1000</span><button class="btn btn-primary" id="home-chat-send">보내기</button></div></form>
</aside>
<div class="chat-backdrop" id="home-chat-backdrop" hidden></div>`;

export async function render(a: HTMLElement, me: Me) {
  const j = await core('home');
  const staff = me.role === 'admin' || me.role === 'researcher', isAdmin = me.role === 'admin';
  const keys: string[] = j.steps.map((s: any) => s.key); const label: Record<string, string> = Object.fromEntries(j.steps.map((s: any) => [s.key, s.label]));
  a.append(tpl(START));
  const fm = takeFlash(); if (fm) { const f = $('home-flash'); f.textContent = fm; f.hidden = false; }
  const card = (d: any) => {
    const i = keys.indexOf(d.step); const pct = d.format === 'core' && i >= 0 ? Math.round(i / Math.max(1, keys.length - 1) * 100) : 0;
    const canEdit = d.owner_id === me.id || isAdmin;
    const acts = h('div', { class: 'dcard-actions' });
    if (canEdit) {
      acts.append(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: d.shared ? '🔒 공유 끄기' : '🔗 공유하기', onclick: async () => {
        try { const r = await core('share', { id: d.id, shared: !d.shared }); go(link(''), r.msg); } catch (e: any) { alert(e.message); } } }));
      acts.append(h('details', { class: 'del-confirm' }, h('summary', { class: 'btn btn-ghost btn-sm btn-danger-text', text: '🗑 삭제' }),
        h('div', { class: 'del-box' }, h('p', {}, `「${d.title}」을(를) 삭제할까요?`, h('br'), h('span', { class: 'muted', text: '목록과 공유에서 사라집니다. 필요하면 관리자가 복원할 수 있습니다.' })),
          h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: '삭제', onclick: async () => {
            try { const r = await core('delete', { id: d.id, confirm: 'yes' }); go(link(''), r.msg); } catch (e: any) { alert(e.message); } } }))));
    } else acts.append(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '📄 내 것으로 복사', onclick: async () => {
      try { const r = await core('copy', { id: d.id }); go(link('designs/' + r.id), r.msg); } catch (e: any) { alert(e.message); } } }));
    return h('div', { class: 'dcard-wrap' },
      h('a', { class: 'dcard', href: link('designs/' + d.id) },
        h('strong', {}, d.title, d.shared ? [' ', h('span', { class: 'badge badge-share', title: '다른 선생님이 볼 수 있음', text: '공유 중' })] : null),
        h('span', { text: `${d.grade}학년 ${d.semester}학기${d.subject_c ? ' · ' + d.subject_c : ''} · ${d.format === 'core' ? (label[d.step] ?? '시작') : '새 흐름으로 다시 시작'}` }),
        h('progress', { class: 'wz-progress', max: 100, value: pct, 'aria-label': `진행 ${pct}%`, text: pct + '%' }),
        h('span', { class: 'muted', text: `${d.owner} · ${kst(d.updated_at)}` })), acts);
  };
  a.append(h('section', { class: 'card' },
    h('div', { class: 'wz-listhead' }, h('h2', {}, staff ? '설계안 목록' : '내 설계안', ' ', h('span', { class: 'badge', text: String(j.designs.length) })), staff ? h('a', { href: link('stats'), text: '별무리 연결 통계 →' }) : null),
    h('div', { class: 'cards', id: 'my-cards' }, j.designs.length ? j.designs.map(card) : h('p', { class: 'muted', text: '아직 설계안이 없습니다. 위에서 새 설계를 시작하세요.' }))));
  a.append(h('section', { class: 'card', id: 'shared' },
    h('div', { class: 'wz-listhead' }, h('h2', { class: 'label-with-info' }, '공유된 수업 ', h('span', { class: 'badge', text: String(j.shared.length) }), ' ', infoBtn('home.shared', '공유된 수업'))),
    h('div', { class: 'cards' }, j.shared.length ? j.shared.map(card) : h('p', { class: 'muted', text: '아직 공유된 수업이 없습니다.' }))));
  a.append(tpl(CHAT));

  const form = $('new-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(form); const btn = $('new-btn') as HTMLButtonElement; btn.disabled = true; $('new-err').textContent = '';
    try { const r = await core('create', Object.fromEntries(fd.entries())); go(link('designs/' + r.id)); }
    catch (x: any) { $('new-err').textContent = x.message; btn.disabled = false; }
  });
  a.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('.idea-ex'); if (!b) return; const ta = form.querySelector('textarea[name=intent]') as HTMLTextAreaElement;
    ta.value = b.getAttribute('data-idea') || ''; ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); });
  homeChat();
}

function homeChat() {
  const chat = $('home-chat'), log = $('home-chat-log'), inp = $('home-chat-input') as HTMLTextAreaElement, openB = $('home-chat-open'), backdrop = $('home-chat-backdrop'), form = $('home-chat-form');
  let loaded = false, busy = false;
  const who = (r: string) => (r === 'user' ? '나' : r === 'assistant' ? 'Alter' : '안내');
  const node = (role: string, t: string, plain = false) => h('div', { class: 'chat-msg ' + role }, h('span', { class: 'chat-who', text: who(role) }), role === 'assistant' && !plain ? h('div', { class: 'chat-md md' }, mdNodes(t)) : h('p', { text: t }));
  const bubble = (role: string, t: string, plain = false) => { log.querySelector('.chat-empty')?.remove(); const b = node(role, t, plain); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  const empty = () => { if (!log.firstChild) log.append(h('p', { class: 'muted chat-empty', text: '아직 대화가 없습니다. 수업 아이디어를 Alter에게 편하게 물어 보세요.' })); };
  const setOpen = (o: boolean) => {
    chat.hidden = !o; backdrop.hidden = !o; openB.setAttribute('aria-expanded', String(o));
    document.body.classList.toggle('chat-on', o); document.body.classList.toggle('home-chat-on', o);
    document.body.classList.toggle('chat-sheet', o && matchMedia('(max-width: 1099px)').matches);
    if (o) { inp.focus(); if (!loaded) { loaded = true; core('draft_chat_get').then((j) => { log.querySelector('.chat-empty')?.remove(); const first = log.firstChild; (j.messages || []).forEach((m: any) => log.insertBefore(node(m.role, m.content), first)); log.scrollTop = log.scrollHeight; empty(); }).catch((e) => bubble('sys', e.message || '대화를 불러오지 못했습니다.')); } }
  };
  openB.addEventListener('click', () => setOpen(chat.hidden));
  $('home-chat-close').addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !chat.hidden) setOpen(false); });
  inp.addEventListener('input', () => { $('home-chat-count').textContent = inp.value.length + '/1000'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const q = inp.value.trim(); if (!q || busy) return; busy = true;
    const send = $('home-chat-send') as HTMLButtonElement; send.disabled = true;
    log.querySelector('.chat-empty')?.remove(); bubble('user', q); const kept = q; inp.value = ''; $('home-chat-count').textContent = '0/1000';
    const wait = bubble('assistant', 'Alter가 생각 중…', true);
    try { const intent = (document.querySelector('textarea[name=intent]') as HTMLTextAreaElement)?.value || '';
      const j = await core('draft_chat_post', { message: kept, stage: 'start', core: { intent } }); wait.remove(); bubble('assistant', j.reply || '(응답 없음)'); }
    catch (x: any) { wait.remove(); bubble('sys', x.message || 'Alter 응답에 실패했습니다.'); inp.value = kept; }
    finally { busy = false; send.disabled = false; }
  });
  $('home-chat-clear').addEventListener('click', async () => { if (!confirm('저장 전 대화를 지울까요?')) return;
    try { await core('draft_chat_clear'); clear(log); empty(); } catch (x: any) { bubble('sys', x.message || '지우기에 실패했습니다.'); } });
}
