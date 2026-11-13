// 별무리 연결 통계 (원본 views/core_stats.php) — 연구소·관리자
import { core } from '../api';
import { h } from '../dom';
import type { Me } from '../main';
import { link } from '../router';

const KN: Record<string, string> = { value: '가치', competency: '역량', goal: '교육목표', topic: '주제', subject: '교과' };
export async function render(a: HTMLElement, me: Me) {
  if (me.role !== 'admin' && me.role !== 'researcher') { a.append(h('section', { class: 'card narrow' }, h('p', { class: 'err', text: '권한이 없습니다.' }))); return; }
  const j = await core('stats');
  a.append(h('section', { class: 'card' }, h('h2', { text: '별무리 연결 통계' }),
    h('p', { class: 'muted', text: "핵심 가치는 평가하지 않으므로 '설계 반영'만 셉니다. 역량은 루브릭(평가)·수업 흐름(TAUGHT) 연결까지 셉니다." }),
    h('div', { class: 'wz-table' }, h('table', {}, h('thead', {}, h('tr', {}, ['구분', '이름', '설계 반영', '평가 연결', '수업 흐름에서 다룸', '전체 중핵 설계'].map((t) => h('th', { text: t })))),
      h('tbody', {}, (j.rows ?? []).map((r: any) => h('tr', {}, h('td', { text: KN[r.kind] ?? r.kind }), h('td', { text: r.name }), h('td', { text: String(r.designs ?? 0) }),
        h('td', { text: r.kind === 'value' ? '—' : String(r.assessed_designs ?? 0) }), h('td', { text: r.kind === 'value' ? '—' : String(r.taught_designs ?? 0) }), h('td', { text: String(r.total_designs ?? 0) })))))),
    h('h3', { text: '평가(루브릭)와 연결되지 않은 학습목표' }),
    j.uncovered?.length ? h('ul', {}, j.uncovered.map((u: any) => h('li', {}, h('a', { href: link(`designs/${u.design_id}`), text: u.title }), ` · ${u.target_key} ${u.text}`))) : h('p', { text: '없음' })));
}
