// 중핵 수업 설계 마법사 (원본 views/core.php). 마법사 동작은 legacy/core.js(원본 그대로, 서버 호출만 교체)
import { core } from '../api';
import { $, go, h, takeFlash, tpl } from '../dom';
import { mountCore } from '../wizard/core.js';
import type { Me } from '../main';
import { link } from '../router';

const SHELL = `
<div class="v21-shell" id="v21-shell">
  <section class="stage-rail card" aria-label="큰 단계">
    <div class="wz-title-row"><div class="design-title-wrap">
      <input class="design-title" id="design-title" type="text" maxlength="200" placeholder="설계서 제목" aria-label="설계서 제목 (고치면 자동 저장됩니다)"></div>
      <div class="wz-pct" aria-live="polite"><span id="core-pct">0%</span>
        <div class="wz-bar" role="progressbar" aria-label="전체 진행률" aria-valuemin="0" aria-valuemax="100" id="core-bar"><span id="core-bar-fill"></span></div></div></div>
    <ol class="wz-stepper" id="core-phases"></ol>
  </section>
  <div class="core-wrap v21-layout" id="core-layout">
    <main class="card core-main" aria-labelledby="core-step-title">
      <p class="wz-kicker" id="core-kicker"></p>
      <div class="step-title-row"><h2 id="core-step-title" tabindex="-1"></h2>
        <button type="button" class="btn btn-ghost info-btn" id="core-step-info" hidden data-info-key="" data-info-title="이 단계" aria-label="이 단계 설명 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></div>
      <p class="lede core-step-help-sr" id="core-step-help" hidden></p>
      <div id="core-rule" class="core-rule"></div>
      <section class="wz-ai" id="core-ai" aria-label="Alter 추천">
        <div class="wz-ai-head"><span class="wz-tag ai">Alter 추천</span>
          <button type="button" id="core-suggest" class="btn btn-ai">Alter 추천 받기</button>
          <button type="button" id="core-draft" class="btn btn-secondary" hidden>✍ 초안 미리보기</button></div>
        <div id="core-options"></div>
      </section>
      <section class="wz-manual" aria-label="직접 입력">
        <div class="wz-ai-head"><span class="wz-tag me">✎ 입력</span>
          <button type="button" class="btn btn-ghost info-btn" data-info-key="field.privacy" data-info-title="개인정보" aria-label="개인정보 안내 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button></div>
        <p class="pii-note" id="core-pii">🔒 학생 개인정보는 쓰지 마세요.</p>
        <div id="core-form"></div>
        <div id="core-warn" class="wz-warn" role="status" aria-live="polite"></div>
      </section>
      <p class="error" id="core-error" role="alert"></p>
      <div class="core-actions wz-actions">
        <button type="button" id="core-prev" class="btn btn-secondary btn-lg">← 이전</button>
        <span class="wz-pos muted" id="core-pos"></span>
        <span class="muted save-state" id="core-saved" role="status" aria-live="polite"></span>
        <button type="button" id="core-next" class="btn btn-primary btn-lg">저장하고 다음 →</button>
      </div>
    </main>
    <aside class="card core-nav" aria-label="설계 요약">
      <details class="sum-fold" open><summary>설계 요약</summary><dl id="core-summary" class="wz-summary"></dl></details>
      <details class="wz-all" open><summary>전체 단계 목록</summary><ol id="core-steps"></ol></details>
      <p><a class="btn btn-secondary" id="print-link" target="_blank" rel="noopener">🖨 설계서 미리보기·인쇄</a></p>
    </aside>
  </div>
</div>
<button type="button" class="btn btn-primary chat-fab" id="chat-open" aria-controls="core-chat" aria-expanded="false">Alter 도움</button>
<aside class="chat-drawer" id="core-chat" aria-label="Alter 도움" hidden>
  <div class="chat-head"><b id="chat-title" class="label-with-info">Alter 도움</b>
    <button type="button" class="btn btn-ghost info-btn" data-info-key="field.alter" data-info-title="Alter 도움" aria-label="Alter 안내 보기" aria-expanded="false" aria-haspopup="dialog">ⓘ</button>
    <button type="button" class="btn btn-ghost btn-sm" id="chat-close" aria-label="닫기">✕</button></div>
  <p class="pii-note chat-pii">🔒 학생 개인정보는 쓰지 마세요.</p>
  <div id="chat-propose" class="chat-propose" hidden></div>
  <div class="chat-log" id="chat-log" role="log" aria-live="polite"></div>
  <form class="chat-form" id="chat-form"><textarea id="chat-input" rows="2" maxlength="1000" placeholder="예: 이 아이디어로 어떤 가치를 고르면 좋을까요?" aria-label="질문"></textarea>
    <div class="chat-actions"><button type="button" class="btn btn-ghost btn-sm" id="chat-clear">기록 지우기</button><span class="muted" id="chat-count">0/1000</span><button class="btn btn-primary" id="chat-send">보내기</button></div></form>
</aside>
<div class="chat-backdrop" id="chat-backdrop" hidden></div>`;

export async function render(a: HTMLElement, _me: Me, id: number) {
  let D: any;
  try { D = await core('view', { id }); }
  catch (e: any) { a.append(h('section', { class: 'card narrow' }, h('h1', { text: e.status === 403 ? '권한이 없습니다' : '설계안이 없습니다' }), h('p', { class: 'err', text: e.message }), h('p', {}, h('a', { href: link(''), text: '내 설계안으로' })))); return; }
  document.title = D.title + ' · 별무리 수업 디자이너';
  const fm = takeFlash(); if (fm) a.append(h('p', { class: 'flash card', role: 'status', text: fm }));
  const copy = async () => { try { const r = await core('copy', { id }); go(link('designs/' + r.id), r.msg); } catch (e: any) { alert(e.message); } };
  const share = async () => { try { const r = await core('share', { id, shared: !D.shared }); go(location.pathname + location.search, r.msg); } catch (e: any) { alert(e.message); } };
  if (!D.canEdit) a.append(h('div', { class: 'readonly-note card', role: 'note' },
    h('span', {}, '👀 ', h('b', { text: D.owner }), ` 선생님의 ${D.shared ? '공유된' : ''} 설계입니다. `, h('b', { text: '읽기 전용' }), '이라 고칠 수 없습니다.'),
    h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'copy-own', text: '📄 내 것으로 복사해 고치기', onclick: copy })));
  else a.append(h('div', { class: 'share-bar' }, h('span', { class: 'muted', text: D.shared ? '🔗 공유 중: 다른 선생님이 읽기 전용으로 볼 수 있음' : '🔒 나만 보기' }), ' ',
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'share-toggle', text: D.shared ? '공유 끄기' : '공유하기', onclick: share })));
  a.append(tpl(SHELL));
  const titleIn = $('design-title') as HTMLInputElement;
  titleIn.value = D.title; titleIn.disabled = !D.canEdit;
  if (!D.canEdit) titleIn.title = '읽기 전용입니다.';
  ($('print-link') as HTMLAnchorElement).href = link(`designs/${id}/print`);
  if (!D.canEdit) { $('chat-clear').remove(); a.append(h('p', { class: 'muted', text: '읽기 전용입니다.' })); }
  a.querySelectorAll('textarea.autogrow').forEach((t: any) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; });
  mountCore(D, (act: string, body: any) => core(act, body));
}
