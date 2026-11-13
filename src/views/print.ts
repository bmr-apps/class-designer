// 설계서 미리보기·인쇄 (원본 views/core_print.php) + Word 다운로드(브라우저에서 생성)
import { core } from '../api';
import { h } from '../dom';
import type { Me } from '../main';
import { link } from '../router';

export const SRC: Record<string, string> = { ncic: 'NCIC 원문', grounded: '검색 근거', seed: '학교 시드', unverified: '미확인', teacher: '직접 입력' };
export const maps = (seed: any) => ({
  vn: Object.fromEntries((seed.values ?? []).map((v: any) => [v.code, v.def ?? ''])) as Record<string, string>,
  gn: Object.fromEntries((seed.goals ?? []).map((g: any) => [g.code, g.text ?? ''])) as Record<string, string>,
  wn: (seed.whereto ?? []).map((w: any) => [w[0], w[1]]) as [string, string][],
});
const lines = (t: string) => String(t ?? '').split(/\r?\n/).flatMap((l, i) => (i ? [h('br'), l] : [l]));

export async function render(a: HTMLElement, _me: Me, id: number) {
  let D: any;
  try { D = await core('view', { id }); } catch (e: any) { a.append(h('p', { class: 'err', text: e.message })); return; }
  document.title = D.title + ' · 설계서';
  const c = D.core, P = D.print, { vn, gn, wn } = maps(D.seed);
  if (D.checks?.length) a.append(h('section', { class: 'card no-print print-checks', 'aria-label': '설계 점검' }, h('h2', { text: `설계 점검 (${D.checks.length}건 · 인쇄되지 않음)` }), h('ul', {}, D.checks.map((w: any) => h('li', { text: w.msg })))));
  const docxBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-lg', id: 'docx-btn', text: '📄 Word 다운로드', onclick: async () => {
    docxBtn.disabled = true; try { const m = await import('../docx'); await m.download(D); } catch (e: any) { alert('Word 파일을 만들지 못했습니다: ' + e.message); } finally { docxBtn.disabled = false; } } });
  a.append(h('div', { class: 'print-toolbar no-print', role: 'toolbar', 'aria-label': '인쇄 도구' }, h('a', { class: 'btn btn-ghost', href: link(`designs/${id}`), text: '← 돌아가기' }),
    h('span', { class: 'print-hint', text: 'A4 세로 · 머리글/바닥글은 인쇄 설정에서 끄세요' }), docxBtn, h('button', { type: 'button', class: 'btn btn-primary btn-lg', 'data-print': '', text: '🖨 인쇄' })));
  const tr = (k: any, v: any) => h('tr', {}, h('th', {}, k), h('td', {}, v));
  a.append(h('article', { class: 'core-print' },
    h('h1', { text: '별무리 고등학교 중핵 수업 설계서' }),
    h('table', {}, h('tr', {}, h('th', { text: '제목' }), h('td', { text: D.title }), h('th', { text: '교사' }), h('td', { text: D.owner })),
      h('tr', {}, h('th', { text: '학년' }), h('td', { text: `${c.grade}학년 ${c.semester}학기` }), h('th', { text: '학점·차시' }), h('td', { text: `${c.credits}학점 · ${c.sessions}차시` }))),
    h('h2', { text: '0단계 · 정체성' }),
    h('p', {}, h('b', { text: '교육목적' }), ' 하나님 나라를 위한 책임 있는 그리스도의 제자'),
    h('p', {}, h('b', { text: '교육목표' }), ' ' + c.identity.goals.map((g: string) => gn[g] ?? g).join(' / ')),
    h('p', {}, h('b', { text: '교사관' }), ' ', lines(c.identity.teacher_view)), h('p', {}, h('b', { text: '학생관' }), ' ', lines(c.identity.student_view)),
    h('h2', { text: '1단계 · 바라는 결과' }),
    h('table', {}, tr('과목명', c.course), tr('핵심 주제', c.topic + (c.prereq.length ? ` (선수과목: ${c.prereq.join(', ')})` : '')), tr('핵심 교과', c.subject),
      tr(['핵심 가치', h('br'), h('small', { text: '(평가하지 않음)' })], c.values.map((v: string) => [`${v} — ${vn[v] ?? ''}`, h('br')])),
      tr('핵심 질문', c.question),
      tr('핵심 역량', [c.competencies.join(', '), P.recommended.length ? [h('br'), h('small', { text: '권장 평가 도구: ' + P.recommended.join(', ') })] : null]),
      tr('성취기준', c.standards.map((s: any) => [h('span', { class: 'badge st-' + (s.status || 'teacher'), text: `[${SRC[s.status || 'teacher'] ?? '직접 입력'}]` }), ` ${s.code} ${s.text}`,
        s.status === 'unverified' ? [' ', h('small', { text: '(원문 대조 필요)' })] : null,
        (s.sources ?? []).filter((u: any) => /^https?:\/\//i.test(String(u.uri ?? ''))).map((u: any) => [' ', h('small', {}, h('a', { href: u.uri, rel: 'noopener noreferrer', target: '_blank', text: `[${u.title || '출처'}]` }))]), h('br')])),
      c.goals.map((g: any, i: number) => tr(g.key, [g.text, h('br'), h('small', { class: 'g-target', text: '평가 대상: ' + (P.goalLabels[i] ?? '') + (g.extra?.length ? ` ⚠ 1개만 유지(보존: ${g.extra.join(', ')})` : '') })]))),
    h('h2', { text: '2단계 · 평가 계획' }),
    h('p', {}, h('b', { text: '수행과제' }), ' ' + c.task.text + ' ', h('small', { text: `(역할: ${c.task.role} · 청중: ${c.task.audience} · 산출물: ${c.task.product})` })),
    h('table', {}, h('thead', {}, h('tr', {}, ['R', '목표', '역량·요소', '평가 항목', '우수(A)', '보통(B)', '미흡(C)', '평가 도구', '교수법'].map((t) => h('th', { text: t })))),
      h('tbody', {}, c.rubric.map((r: any) => h('tr', {}, h('td', { text: r.key }), h('td', { text: r.goal }), h('td', {}, r.competency, h('br'), h('small', { text: r.element })), h('td', { text: r.criterion }),
        h('td', { text: r.A }), h('td', { text: r.B }), h('td', { text: r.C }), h('td', { text: (r.tools ?? []).join(', ') }), h('td', { text: (r.methods ?? []).join(', ') }))))),
    h('p', { class: 'auto-sum' }, h('b', { text: '평가 도구 (루브릭에서 자동 모음)' }), ' ' + (P.toolSummary || '-')),
    h('h2', { text: '3단계 · 수업 계획' }),
    h('table', {}, h('thead', {}, h('tr', {}, ['4MAT', '차시', '활동', '교수법', 'R'].map((t) => h('th', { text: t })))),
      h('tbody', {}, c.flow.map((f: any) => h('tr', {}, h('td', { text: f.k }), h('td', { text: f.sessions }), h('td', {}, lines(f.activity)), h('td', { text: (f.methods ?? []).join(', ') }), h('td', { text: (f.r ?? []).join(', ') }))))),
    h('p', { class: 'auto-sum' }, h('b', { text: '교수법 (4MAT·R에서 자동 모음)' }), ' ' + (P.methodSummary || '-')),
    h('h2', { text: 'WHERETO 점검' }),
    h('ul', {}, wn.map(([k, l]) => h('li', { text: `${c.whereto.includes(k) ? '☑' : '☐'} ${k} · ${l}` })))));
}
