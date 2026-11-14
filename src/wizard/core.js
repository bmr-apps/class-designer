// 중핵 수업 설계서 마법사 (Alpine 없이 동작). 모든 텍스트는 textContent/value 로만 넣는다(HTML 문자열 삽입 금지).
// Supabase 판: 서버 호출은 call(action, body) 로 바뀌었고 나머지 동작은 v22 원본과 같다.
import { mdNodes } from '../md.ts';
export function mountCore(D, call) {
  const S = D.seed, c = D.core; const base = import.meta.env.BASE_URL;
  const $ = id => document.getElementById(id);
  const steps = D.steps; let idx = Math.max(0, steps.findIndex(s => s.key === c.step));
  const HELP = {
    start: '주제나 과목을 먼저 고르지 않아도 됩니다. 떠오른 수업 장면을 한두 문장으로 적어 주세요. 나중에 정체성·주제·교과·질문으로 다듬습니다.',
    identity: '핵심 가치 1–2개를 고르고, 교사관·학생관을 짧게 쓰세요. 가치는 평가하지 않으며, 뒤에서 주제·교과와 함께 핵심 질문으로 이어집니다. Alter는 제안만 하고 자동으로 채우지 않습니다.',
    question: '앞에서 정한 핵심 주제·핵심 교과·핵심 가치(정체성)를 하나로 잇는 열린 질문 하나. 주제·교과·가치가 바뀌면 연결을 다시 검토하세요(자동으로 덮어쓰지 않습니다).',
    topic: '학년별 핵심 주제 중 하나. 직접 입력도 됩니다.', prereq: '해설서의 주제 연계표로 자동 제안됩니다. 고칠 수 있습니다.',
    subject: '주제를 다룰 핵심 교과 하나.',
    competencies: '하위 역량은 1학점당 2개(2학점 = 3–4개 권장, 최소 2개). 역량마다 권장 평가 도구가 있어 루브릭에서 자동으로 추천됩니다.',
    standards: '인터넷 검색(출처 포함)이나 학교 시드 목록에서 고르세요. NCIC 원문과 꼭 대조하세요.',
    goals: '"나는 ~할 수 있다"로 끝나는 관찰 가능한 학습목표. 최대 8개까지 추가할 수 있습니다.', task: '역할·청중·산출물이 드러나는 수행과제.',
    rubric: '목표(G) 하나당 한 행. 각 R 옆에서 평가 도구와 교수법을 고르면 자동으로 모입니다.',
    flow: '4MAT 구간을 하나씩 펼쳐 활동을 쓰고, 옆에 교수법 태그를 붙이세요. 차시 구간은 전체 차시에 맞춰 조정됩니다.',
    whereto: '7요소를 점검하세요. Alter 점검은 근거와 보완 제안을 보여 줍니다.', output: '설계서를 미리보고 인쇄하세요.'
  };
  const TITLES = {
    start: '어떤 수업을 해 보고 싶으세요?',
    identity: '이 수업을 어떤 방향으로 이끌까요?',
    question: '주제 · 교과 · 가치를 하나의 질문으로',
    topic: '핵심 주제 하나', prereq: '선수과목', subject: '핵심 교과 하나',
    competencies: '핵심 역량', standards: '성취기준', goals: '학습목표 G', task: '수행과제',
    rubric: '루브릭 · 평가 도구 · 교수법', flow: '4MAT 수업 흐름', whereto: 'WHERETO 점검', output: '설계서 출력'
  };
  // 속성 넣기: 값이 바뀌는 DOM 속성(value·checked·disabled·className 등)은 대입하고,
  // 읽기 전용 속성(list·form 등, setter 가 없음)과 일반 HTML 속성(role·aria-*)은 setAttribute 로 넣는다.
  // input.list = 'dl-topic' 처럼 대입하면 TypeError(속성에 getter 만 있음)가 나므로 꼭 구분한다.
  const setProp = (e, k, v) => { let d = null, o = e; while (o && !(d = Object.getOwnPropertyDescriptor(o, k))) o = Object.getPrototypeOf(o);
    if (d && (d.set || d.writable)) e[k] = v; else e.setAttribute(k, v); };
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else setProp(e, k, v); } kids.flat().forEach(k => k && e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k)); return e; };
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); };
  const infoBtn = (key, title) => (window.SDInfo ? window.SDInfo.button(key, { title }) : el('span'));
  const labelInfo = (text, key) => (window.SDInfo ? window.SDInfo.labelWithInfo(text, key, { title: text }) : text);

  // 서버가 JSON이 아닌 응답을 줄 때 상태 코드별로 알기 쉬운 메시지
  const httpMsg = s => s === 401 || s === 0 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : s === 403 ? '보안 토큰이 만료되었거나 권한이 없습니다. 페이지를 새로고침해 주세요.' : s === 404 ? '설계안을 찾을 수 없습니다.' : s === 429 ? '요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.' : s >= 500 ? '서버에 일시적인 문제가 있습니다. 잠시 뒤 다시 시도하세요.' : '서버 응답을 읽지 못했습니다.';
  const readJson = async r => { const j = await r.json().catch(() => null); if (r.redirected && /\/login/.test(r.url)) throw new Error(httpMsg(401));
    if (!j) throw new Error(httpMsg(r.status) + ' (HTTP ' + r.status + ')'); if (!r.ok || j.error) throw new Error(j.error || (httpMsg(r.status) + ' (HTTP ' + r.status + ')')); return j; };
  const api = async (path, body) => { const m = /^\/(suggest|rule)\/(.+)$/.exec(path); const act = path === '' ? 'save' : path === '/draft' ? 'draft' : path === '/standards/search' ? 'std_search' : m ? m[1] : path;
    return call(act, Object.assign({ id: D.id }, body, m ? { step: m[2] } : {})); };
  const src = (k, v) => { c.sources = c.sources || {}; c.sources[k] = v; };

  // 입력 위젯
  // 여러 줄 입력은 내용만큼 자동으로 늘어난다(안쪽 스크롤 없음)
  const grow = t => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };
  const text = (label, get, set, rows = 1, cls = '') => { const i = el(rows > 1 ? 'textarea' : 'input', { rows, value: get() ?? '', disabled: !D.canEdit, class: rows > 1 ? 'autogrow' : '', oninput: e => { set(e.target.value); if (rows > 1) grow(e.target); } }); if (rows > 1) requestAnimationFrame(() => grow(i)); return el('label', { class: 'block' + (cls ? ' ' + cls : '') }, label, i); };
  window.addEventListener('resize', () => document.querySelectorAll('.core-main textarea.autogrow').forEach(grow));
  const checks = (items, arr, max, key) => el('div', { class: 'chips' }, items.map(it => { const v = it.code ?? it; const lab = it.text ?? it.def ? (it.code + ' · ' + (it.text ?? it.def)) : it; const cb = el('input', { type: 'checkbox', checked: arr.includes(v), disabled: !D.canEdit, onchange: e => { if (e.target.checked) { if (arr.length >= max) { e.target.checked = false; return err(`최대 ${max}개까지 고를 수 있습니다.`); } arr.push(v); } else arr.splice(arr.indexOf(v), 1); src(key, 'teacher'); } }); return el('label', { class: 'chip' }, cb, ' ' + lab); }));
  const datalist = (id, items) => el('datalist', { id }, items.map(v => el('option', { value: v })));
  const err = m => { $('core-error').textContent = m || ''; };

  const MAXG = 8, MAXR = 8;
  // v19: 역량별 권장 평가 도구, 칩 선택기(버튼 aria-pressed), 4MAT 구간 비례 재계산, 자동 모음
  const recTools = comp => { const x = (S.comp_info || []).find(y => y.name === comp); return x ? (x.tools || []).filter(t => S.tools.includes(t)) : []; };
  const chipPicker = (items, arr, max, rec, key) => el('div', { class: 'chips', role: 'group' }, items.map(v => el('button', { type: 'button', class: 'btn chip' + (rec.includes(v) ? ' rec' : ''), 'aria-pressed': String(arr.includes(v)), disabled: !D.canEdit, text: v,
    onclick: e => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else { if (arr.length >= max) return err(`최대 ${max}개까지 고를 수 있습니다.`); arr.push(v); } err(''); e.currentTarget.setAttribute('aria-pressed', String(arr.includes(v))); src(key, 'teacher'); collect(); refreshSummary(); } })));
  function rescale() { const fm = S.fourmat || [], base = Math.max(1, +(fm[fm.length - 1] || {}).to || 36), n = fm.length, T = Math.max(n, c.sessions); let prev = 0;
    fm.forEach((f, i) => { let to = i === n - 1 ? T : Math.round(+f.to * T / base); to = Math.max(prev + 1, Math.min(to, T - (n - 1 - i))); const row = c.flow.find(x => x.k === f.k); if (row) row.sessions = prev + 1 === to ? String(to) : (prev + 1) + '–' + to; prev = to; }); }
  // 루브릭 R의 평가 도구, 4MAT·R의 교수법을 모아 c.tools / c.methods 로 (서버도 같은 규칙으로 다시 계산)
  function collect() { const t = [], m = [];
    c.rubric.forEach(r => { (r.tools || []).forEach(x => { if (!t.includes(x)) t.push(x); }); (r.methods || []).forEach(x => { if (!m.includes(x)) m.push(x); }); });
    c.flow.forEach(x => (x.methods || []).forEach(y => { if (!m.includes(y)) m.push(y); })); c.tools = t; c.methods = m; }
  function autoSummary() { collect(); const tm = {}, mm = {};
    c.rubric.forEach(r => { (r.tools || []).forEach(x => (tm[x] = tm[x] || []).push(r.key)); (r.methods || []).forEach(x => (mm[x] = mm[x] || []).push(r.key)); });
    c.flow.forEach(x => (x.methods || []).forEach(y => (mm[y] = mm[y] || []).push(x.k)));
    const rec = []; c.competencies.forEach(cp => recTools(cp).forEach(t => { if (!rec.includes(t)) rec.push(t); }));
    return el('section', { class: 'auto-sum', id: 'auto-sum', 'aria-label': '자동 모음' },
      el('h4', { class: 'label-with-info' }, el('span', { text: '📋 자동 모음' }), infoBtn('field.autoSum', '자동 모음')),
      el('p', {}, el('b', { text: '평가 도구: ' }), Object.keys(tm).length ? Object.entries(tm).map(([k, v]) => `${k} ← ${v.join(', ')}`).join(' · ') : '아직 없음'),
      el('p', {}, el('b', { text: '교수법: ' }), Object.keys(mm).length ? Object.entries(mm).map(([k, v]) => `${k} ← ${v.join(', ')}`).join(' · ') : '아직 없음')); }
  function refreshSummary() { const old = $('auto-sum'); if (old) old.replaceWith(autoSummary()); drawStepper(); }
  const valueCards = (arr, key) => {
    const wrap = el('div', { class: 'value-grid', role: 'group', 'aria-label': '핵심 가치' });
    (S.values || []).forEach(v => {
      const on = arr.includes(v.code);
      const card = el('button', { type: 'button', class: 'btn value-card' + (on ? ' is-selected' : ''), disabled: !D.canEdit, 'aria-pressed': String(on),
        onclick: () => { const i = arr.indexOf(v.code); if (i >= 0) arr.splice(i, 1); else { if (arr.length >= 2) return err('핵심 가치는 1–2개입니다.'); arr.push(v.code); } err(''); src(key, 'teacher'); draw(false); } });
      card.append(el('span', { class: 'value-check', 'aria-hidden': 'true', text: on ? '✓' : '' }), el('span', {}, el('b', { text: v.code }), el('small', { text: v.def || '' })));
      wrap.append(card);
    });
    return wrap;
  };
  const FORMS = {
    start: f => {
      const ex = (S.idea_examples || [])[0] || '';
      f.append(el('div', { class: 'field' },
        el('div', { class: 'field-label' }, labelInfo('수업 아이디어', 'step.start')),
        el('textarea', { class: 'input-lg autogrow', rows: 4, value: c.intent || '', placeholder: '한두 문장으로 적어 보세요', disabled: !D.canEdit, oninput: e => { c.intent = e.target.value; src('start', 'teacher'); grow(e.target); } })),
        ex ? el('div', { class: 'example-inline' }, el('span', { class: 'chip-example', text: '예시' }), el('span', { text: ex })) : null);
      const setBox = el('section', { class: 'start-settings', 'aria-label': '설정' },
        el('p', { class: 'start-settings-head label-with-info' }, el('span', { text: '설정 · 학년 · 학기 · 학점 · 차시 · 과목명' }), infoBtn('field.sessions', '차시·학점')),
        el('div', { class: 'settings-grid' },
          el('label', {}, el('span', { class: 'label-mini', text: '학년' }), el('select', { disabled: !D.canEdit, onchange: e => { c.grade = +e.target.value; } }, [10, 11, 12].map(g => el('option', { value: g, selected: c.grade === g, text: g + '학년' })))),
          el('label', {}, el('span', { class: 'label-mini', text: '학기' }), el('input', { value: c.semester || '', maxLength: 10, disabled: !D.canEdit, oninput: e => { c.semester = e.target.value.trim(); } })),
          el('label', {}, el('span', { class: 'label-mini', text: '학점' }), el('input', { type: 'number', min: 1, max: 8, value: c.credits, disabled: !D.canEdit, onchange: e => { const old = c.credits; c.credits = Math.max(1, Math.min(8, +e.target.value || 1)); if (c.sessions === old * 18) { c.sessions = c.credits * 18; rescale(); } } })),
          el('label', {}, el('span', { class: 'label-mini', text: '차시' }), el('input', { type: 'number', min: 4, max: 200, value: c.sessions, disabled: !D.canEdit, onchange: e => { c.sessions = Math.max(4, Math.min(200, +e.target.value || c.credits * 18)); rescale(); } }))),
        text('과목명 (선택)', () => c.course, v => { c.course = v; src('start', 'teacher'); }));
      // 학점×18 안내·빈 아이디어 안내는 ⓘ (field.sessions / field.intentEmpty)
      if (!c.intent) setBox.querySelector('.start-settings-head')?.append(infoBtn('field.intentEmpty', '아이디어가 없을 때'));
      f.append(setBox);
      requestAnimationFrame(() => f.querySelectorAll('textarea.autogrow').forEach(grow));
    },
    identity: f => {
      if (S.purpose) f.append(el('div', { class: 'readonly-box' }, el('small', { text: '학교 교육목적' }), el('p', { text: S.purpose })));
      f.append(el('details', { class: 'help-fold' }, el('summary', { text: '교육목표 (1–3개)' }), checks(S.goals, c.identity.goals, 3, 'identity')));
      f.append(el('h4', { class: 'section-title label-with-info' }, el('span', { text: '핵심 가치 1–2개' }), infoBtn('field.values', '핵심 가치')));
      if (c.intent) f.append(el('div', { class: 'example-inline' }, el('span', { class: 'chip-example', text: '아이디어 참고' }), el('span', { text: c.intent })));
      f.append(valueCards(c.values, 'identity'));
      const tv = text('교사관 (나는 어떤 교사인가)', () => c.identity.teacher_view, v => { c.identity.teacher_view = v; src('identity', 'ai_edited'); }, 3);
      const sv = text('학생관 (학생을 어떻게 보는가)', () => c.identity.student_view, v => { c.identity.student_view = v; src('identity', 'ai_edited'); }, 3);
      f.append(el('div', { class: 'view-pair' }, tv, sv));
      const viewsHead = el('p', { class: 'section-title label-with-info' }, el('span', { text: '교사관 · 학생관' }), infoBtn('field.views', '교사관·학생관'));
      // 제목은 view-pair 위에 — 이미 라벨이 있으므로 info만 가치 옆에; views info는 가치 섹션 다음에 작게
      f.insertBefore(viewsHead, f.querySelector('.view-pair'));
    },
    question: f => {
      f.append(el('div', { class: 'q-link card', role: 'note', 'aria-label': '핵심 질문 연결 요약' },
        el('span', { class: 'q-chip', text: '주제 ' + (c.topic || '미정') }), ' · ', el('span', { class: 'q-chip', text: '교과 ' + (c.subject || '미정') }), ' · ',
        el('span', { class: 'q-chip', text: '가치 ' + (c.values.join('·') || '미정') }), el('b', { text: ' → 질문' })));
      const needs = (() => { const b = c.question_basis || {}; const va = (b.values || []).slice().sort().join(); const vb = (c.values || []).slice().sort().join();
        return c.question && ((b.topic || '') !== (c.topic || '') || (b.subject || '') !== (c.subject || '') || va !== vb); })();
      if (needs) f.append(el('div', { class: 'warn-note', role: 'status', text: '주제·교과·가치가 질문과 맞지 않을 수 있습니다. 질문을 다시 검토하세요. (자동으로 덮어쓰지 않습니다)' }));
      f.append(text('핵심 질문', () => c.question, v => { c.question = v; c.question_basis = { topic: c.topic, subject: c.subject, values: c.values.slice() }; src('question', 'teacher'); }, 2));
      f.append(el('details', { class: 'help-fold' }, el('summary', { text: '가치 살짝 고치기 (정체성에서 고른 값)' }), valueCards(c.values, 'identity')));
    },
    topic: f => { const i = el('input', { value: c.topic, list: 'dl-topic', oninput: e => { c.topic = e.target.value; src('topic', 'teacher'); } }); f.append(el('label', { class: 'block' }, '핵심 주제 (직접 입력 가능)', i)); },
    prereq: f => { f.append(text('선수과목 (쉼표로 구분)', () => c.prereq.join(', '), v => { c.prereq = v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4); src('prereq', 'teacher'); })); },
    subject: f => f.append(el('label', { class: 'block' }, '핵심 교과', el('input', { value: c.subject, list: 'dl-subj', oninput: e => { c.subject = e.target.value; src('subject', 'teacher'); } })), datalist('dl-subj', S.subjects)),
    competencies: f => { f.append(checks(S.competencies, c.competencies, Math.max(3, (c.credits || 2) * 2), 'competencies')); stageGuide(f, true); },
    standards: f => { stdSearch(f); listEditor(f, c.standards, 8, () => ({ code: '[코드 확인]', text: '', status: 'teacher', sources: [] }), [['code', '코드', 1, null, 'f-code'], ['text', '성취기준', 3, null, 'f-wide']], 'standards'); },
    goals: f => { stageGuide(f, true); listEditor(f, c.goals, MAXG, () => ({ key: 'G' + (c.goals.length + 1), text: '', tt: '', target: '', std: '', extra: [] }), [['text', '학습목표', 2], ['target', '평가 대상 (1개만)', 'target']], 'goals'); addOne(f, 'goal_add', c.goals.length < MAXG); },
    task: f => { [['text', '수행과제', 3], ['role', '역할', 1], ['audience', '청중', 1], ['product', '산출물', 1]].forEach(([k, l, r]) => f.append(text(l, () => c.task[k], v => { c.task[k] = v; src('task', 'teacher'); }, r))); },
    rubric: f => { stageGuide(f, true); listEditor(f, c.rubric, MAXR, () => ({ key: 'R' + (c.rubric.length + 1), goal: (c.goals.find(g => !c.rubric.some(r => r.goal === g.key)) || c.goals[0] || { key: '' }).key, competency: c.competencies[0] || '', element: '', criterion: '', A: '', B: '', C: '', tools: recTools(c.competencies[0] || '').slice(0, 1), methods: [] }),
      [['goal', '연결 목표 G', 0, () => c.goals.map(g => g.key)], ['_target', '평가 대상', 'derived'], ['criterion', '평가 항목', 2, null, 'f-wide'], ['A', '우수(A)', 3, null, 'f-lvl lv-a'], ['B', '보통(B)', 3, null, 'f-lvl lv-b'], ['C', '미흡(C)', 3, null, 'f-lvl lv-c'], ['_tags', '', 'rtags']], 'rubric');
      f.append(autoSummary());
      const miss = c.goals.filter(g => !c.rubric.some(r => r.goal === g.key)).map(g => g.key); if (miss.length) f.append(el('p', { class: 'muted', text: '루브릭이 없는 목표: ' + miss.join(', ') }));
      addOne(f, 'rubric_add', c.rubric.length < MAXR && c.goals.length > 0); },
    flow: f => { c.flow.forEach((x, i) => { x.methods = x.methods || [];
        const body = el('div', { class: 'flow-body' },
          el('label', { class: 'block f-code' }, '차시 구간 ', el('input', { value: x.sessions, size: 8, placeholder: '예: 1–4', disabled: !D.canEdit, onchange: e => { x.sessions = e.target.value.trim().replace(/[-~—]/g, '–'); } })),
          text('활동', () => x.activity, v => { x.activity = v; src('flow', 'teacher'); }, 3),
          el('div', { class: 'row-tags' }, el('small', { text: '교수법 (최대 ' + (S.max_methods || 2) + '개)' }), chipPicker(S.methods, x.methods, S.max_methods || 2, [], 'flow')),
          text('연결 R (예: R1, R2)', () => x.r.join(', '), v => x.r = v.split(',').map(s => s.trim()).filter(Boolean)));
        f.append(el('details', { class: 'flow-fold', open: i === 0 || !!x.activity }, el('summary', { text: `${x.k} · ${x.sessions}차시` + (x.activity ? ' · 작성됨' : '') }), body)); });
      f.append(autoSummary()); },
    whereto: f => f.append(el('div', { class: 'chips' }, S.whereto.map(([k, q]) => el('label', { class: 'chip' }, el('input', { type: 'checkbox', checked: c.whereto.includes(k), onchange: e => { if (e.target.checked) c.whereto.push(k); else c.whereto.splice(c.whereto.indexOf(k), 1); } }), ` ${k} · ${q}`)))),
    output: f => f.append(el('a', { href: base + 'designs/' + D.id + '/print', target: '_blank', rel: 'noopener', text: '설계서 미리보기·인쇄 열기' }))
  };
  const STATUS = { ncic: 'NCIC 원문', grounded: '검색 근거 확인', seed: '학교 시드 (NCIC 대조 필요)', unverified: '미확인 · 원문 대조 필요', teacher: '직접 입력' };
  const srcLinks = list => el('span', { class: 'src' }, (list || []).filter(x => /^https?:\/\//i.test(x.uri)).map(x => el('a', { href: x.uri, target: '_blank', rel: 'noopener noreferrer', text: '[' + (x.title || '출처') + '] ' })));
  // 행 추가·삭제 가능한 목록. G/R 키는 순서대로 다시 매긴다(서버도 같은 규칙). 필드 r=0 이면 선택 상자
  function renumber(key) { if (key === 'goals') { const map = {}; c.goals.forEach((g, i) => { map[g.key] = 'G' + (i + 1); g.key = 'G' + (i + 1); }); c.rubric.forEach(r => { r.goal = map[r.goal] || ''; }); }
    if (key === 'rubric') { const map = {}; c.rubric.forEach((r, i) => { map[r.key] = 'R' + (i + 1); r.key = 'R' + (i + 1); }); c.flow.forEach(x => { x.r = x.r.map(k => map[k]).filter(Boolean); }); } }
  function listEditor(f, arr, max, blank, fields, key) {
    arr.forEach((row, i) => { const box = el('fieldset', { class: 'row' + (row.status ? ' st-' + row.status : '') }, el('legend', {}, (row.key || '#' + (i + 1)) + (row.element ? ' · ' + row.element : '') + ' ', row.status ? el('span', { class: 'src-badge sb-' + row.status, text: '출처: ' + (STATUS[row.status] || '') }) : null));
      let lv = null; // 루브릭 우수/보통/미흡은 한 묶음(넓은 화면 3열, 좁으면 세로로 쌓임)
      fields.forEach(([k, l, r, opts, cls]) => {
        if (r === 'target') { box.append(targetField(row, l)); return; }
        if (r === 'rtags') { row.tools = row.tools || []; row.methods = row.methods || []; const rec = recTools(row.competency);
          box.append(el('div', { class: 'row-tags' }, el('small', { text: `평가 도구 (최대 ${S.max_tools || 3}개 · ★ ${row.competency || '역량'} 권장${rec.length ? ': ' + rec.join(', ') : ''})` }), chipPicker(S.tools, row.tools, S.max_tools || 3, rec, 'rubric'),
            el('small', { text: '교수법 (선택, 최대 ' + (S.max_methods || 2) + '개)' }), chipPicker(S.methods, row.methods, S.max_methods || 2, [], 'rubric'))); return; }
        if (r === 'derived') { const g = c.goals.find(x => x.key === row.goal); box.append(el('p', { class: 'muted g-derived', text: l + ': ' + (g ? targetLabel(g) + ' (' + row.goal + '에서 자동)' : 'G를 먼저 고르세요') + ' · 척도 우수/보통/미흡' })); return; }
        if (r === 0 && opts) { const o = opts(); box.append(el('label', { class: 'block' }, l, el('select', { disabled: !D.canEdit, onchange: e => { row[k] = e.target.value; src(key, 'ai_edited'); } }, el('option', { value: '', text: '—' }), o.map(v => el('option', { value: v, text: v, selected: row[k] === v }))))); }
        else { const t = text(l, () => row[k], v => { row[k] = v; if (key === 'standards' && k === 'code') row.status = 'teacher'; src(key, 'ai_edited'); }, r, cls || '');
          if ((cls || '').includes('f-lvl')) { if (!lv) { lv = el('div', { class: 'rb-levels', role: 'group', 'aria-label': '수준별 기준' }); box.append(lv); } lv.append(t); } else box.append(t); if (opts) { const id = 'dl-' + key + k; box.append(datalist(id, opts())); box.lastChild.previousSibling.querySelector('input,textarea').setAttribute('list', id); } }
      });
      if (row.sources && row.sources.length) box.append(el('p', { class: 'muted row-src' }, '출처: ', srcLinks(row.sources)));
      if (D.canEdit) box.append(el('button', { type: 'button', class: 'btn btn-danger btn-sm row-del', text: '삭제', onclick: () => { arr.splice(i, 1); renumber(key); draw(false); } })); f.append(box); });
    if (arr.length < max && D.canEdit) f.append(el('button', { type: 'button', class: 'btn btn-secondary', text: '+ 직접 추가', onclick: () => { arr.push(blank()); renumber(key); src(key, 'teacher'); draw(false); } }));
    else if (arr.length >= max) f.append(el('p', { class: 'muted', text: `최대 ${max}개입니다.` }));
  }
  // G 평가 대상: 역량 또는 성취기준 중 1개 (라디오 + 단일 선택). 대상 목록은 1단계에서 고른 항목
  // 단계 정의(블룸 초점) + 선택한 역량의 요소 예시·권장 평가 도구. 모든 텍스트는 textContent로만 넣는다
  const STAGE_OF = { 10: '기초', 11: '발전', 12: '심화' };
  function stageGuide(f, withComps) {
    const SD = S.stage_defs || {}; if (!Object.keys(SD).length) return;
    const cur = STAGE_OF[c.grade] || '기초';
    const tb = el('table', { class: 'stage-defs' }, el('thead', {}, el('tr', {}, ['단계', '블룸 초점', '정의', '대표 동사', '적용 범위'].map(h => el('th', { text: h })))),
      el('tbody', {}, Object.entries(SD).map(([k, d]) => el('tr', { class: k === cur ? 'cur' : '' }, [k + ' (' + (d.grade || '') + ')' + (k === cur ? ' · 이 과목' : ''), d.bloom || '', d.focus || '', (d.verbs || []).join(', '), d.scope || ''].map(t => el('td', { text: t }))))));
    const box = el('details', { class: 'stage-guide card', open: true }, el('summary', { text: '루브릭 단계 정의 · 수준 ' + (S.levels || []).join('·') }), tb,
      infoBtn('step.competencies', '역량 단계'));
    if (withComps) {
      const info = (S.comp_info || []).filter(x => c.competencies.includes(x.name));
      if (info.length) box.append(el('ul', { class: 'comp-tools' }, info.map(x => { const e = (x.elements || []).find(y => y.stage === cur);
        return el('li', {}, el('b', { text: x.name }), ' — ' + cur + ' 요소 예시: ', el('i', { text: e ? e.element : '-' }), ' (예시이므로 수업에 맞게 바꿔 쓸 수 있습니다) · 권장 평가 도구: ' + (x.tools || []).join(', ')); })));
      if (S.tool_codes) box.append(el('p', { class: 'muted', text: S.tool_codes }));
    }
    f.append(box);
  }
  const targetLabel = g => !g.target ? '대상 없음' : (g.tt === 'competency' ? '하위역량 · ' : '성취기준 · ') + g.target;
  function targetField(row, label) {
    const wrap = el('div', { class: 'g-tt', role: 'group', 'aria-label': label }, el('span', { class: 'g-tt-l', text: label }));
    const opts = tt => tt === 'competency' ? c.competencies : c.standards.map(x => x.code);
    const sel = el('select', { disabled: !D.canEdit || !row.tt, 'aria-label': '평가 대상 선택', onchange: e => { row.target = e.target.value; row.std = row.tt === 'standard' ? row.target : ''; src('goals', 'ai_edited'); } });
    const fill = () => { sel.replaceChildren(el('option', { value: '', text: row.tt ? '— 고르세요 —' : '먼저 유형을 고르세요' }), ...(row.tt ? opts(row.tt) : []).map(v => el('option', { value: v, text: v, selected: row.target === v })));
      if (row.target && row.tt && !opts(row.tt).includes(row.target)) sel.append(el('option', { value: row.target, text: row.target + ' (1단계 목록에 없음)', selected: true })); sel.disabled = !D.canEdit || !row.tt; };
    const name = 'tt-' + row.key + '-' + Math.random().toString(36).slice(2, 6);
    [['competency', '하위역량'], ['standard', '성취기준']].forEach(([v, t]) => wrap.append(el('label', { class: 'chip' }, el('input', { type: 'radio', name, value: v, checked: row.tt === v, disabled: !D.canEdit || !opts(v).length,
      onchange: () => { row.tt = v; row.target = opts(v).length === 1 ? opts(v)[0] : ''; row.std = v === 'standard' ? row.target : ''; fill(); src('goals', 'ai_edited'); } }), ' ' + t + (opts(v).length ? '' : ' (1단계에서 고르지 않음)'))));
    fill(); wrap.append(sel);
    if (row.extra && row.extra.length) wrap.append(el('p', { class: 'warn g-extra', role: 'alert' }, '⚠ 대상은 1개만 됩니다. 첫 번째만 유지했고 다음은 보존 중입니다: ' + row.extra.join(', ') + ' ',
      D.canEdit ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '확인했어요 · 지우기', onclick: () => { row.extra = []; src('goals', 'ai_edited'); draw(false); } }) : null));
    return wrap;
  }
  // AI로 한 행 추가 제안 (goal_add / rubric_add)
  function addOne(f, kind, enabled) {
    if (!D.canEdit) return; const box = el('div', { class: 'core-addone' });
    f.append(el('button', { type: 'button', class: 'btn btn-secondary', text: kind === 'goal_add' ? 'Alter로 학습목표 1개 추가 제안' : 'Alter로 루브릭 1행 추가 제안', disabled: !enabled, onclick: async () => {
      err(''); clear(box); box.append(el('p', { class: 'muted wz-loading', text: 'Alter가 추천을 만드는 중…' })); $('core-ai').hidden = false;
      try { const j = await api('/suggest/' + kind, { core: c }); clear(box);
        if (!j.options.length) box.append(el('p', { text: '쓸 수 있는 추천이 없습니다.' }));
        j.options.forEach((o, i) => box.append(el('div', { class: 'opt ai-opt' }, el('b', { text: `Alter 추천 ${i + 1}` }), el('pre', { text: kind === 'goal_add' ? o.value.text + ' [' + targetLabel(o.value) + ']' : summary('rubric', [o.value]) }), el('p', { class: 'muted', text: o.why }),
          el('button', { type: 'button', class: 'btn btn-ai btn-sm', text: '추가', onclick: () => { const v = JSON.parse(JSON.stringify(o.value)); if (kind === 'goal_add') { c.goals.push(v); renumber('goals'); src('goals', 'ai'); } else { c.rubric.push(v); renumber('rubric'); src('rubric', 'ai'); } draw(false); } }))));
      } catch (e) { clear(box); err(e.message); } } }), box);
  }
  // 원문 DB 목록에서 직접 고르기 (과목·영역·출처 표시, 필터)
  function stdBrowse(r, list) {
    const q = el('input', { placeholder: '목록 거르기 (예: 매체, 01-03)' }), box = el('div', { class: 'core-std' });
    const show = () => { clear(box); const k = q.value.trim();
      list.filter(x => !k || (x.code + ' ' + x.subject + ' ' + x.domain + ' ' + x.text).includes(k)).forEach(x => { const has = c.standards.some(s => s.code === x.code);
        box.append(el('div', { class: 'opt st-' + x.status }, el('b', { class: 'code', text: x.code }), el('span', { class: 'badge st-' + x.status, text: STATUS[x.status] || '' }),
          el('span', { class: 'muted', text: ' ' + [x.subject, x.course_type, x.domain].filter(Boolean).join(' · ') }), el('p', { text: x.text }),
          x.sources && x.sources.length ? el('p', { class: 'muted' }, '출처: ', srcLinks(x.sources)) : el('p', { class: 'muted', text: '출처: ' + (x.source || '없음') }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: has ? '추가됨' : '추가', disabled: has || !D.canEdit || c.standards.length >= 8, onclick: () => { c.standards.push({ code: x.code, text: x.text, status: x.status, sources: x.sources || [] }); src('standards', 'teacher'); draw(false); } }))); }); };
    q.addEventListener('input', show); show();
    r.append(el('details', {}, el('summary', { text: `원문 DB에서 직접 고르기 (${list.length}개)` }), q, box));
  }
  // 성취기준 인터넷 검색 (출처 링크 포함)
  function stdSearch(f) {
    const q = el('input', { value: [c.topic, c.question].filter(Boolean).join(' '), placeholder: '검색어 (예: 생성형 AI 윤리)' }), out = el('div', { class: 'core-std' });
    const run = async refresh => { err(''); clear(out); out.append(el('p', { class: 'muted', text: '교육과정 원문을 검색하는 중… (10–30초)' }));
      try { const j = await api('/standards/search', { core: c, query: q.value, refresh }); clear(out);
        if (j.warning) out.append(el('p', { class: 'muted', text: j.warning }));
        out.append(el('p', { class: 'muted', text: (j.cached ? '저장된 검색 결과 · ' : '') + (j.fallback ? '원문 DB 목록' : '인터넷 검색 결과 (원문 DB에 있는 코드만 확인 표시)') + (j.queries && j.queries.length ? ' · 검색어: ' + j.queries.join(' / ') : '') }));
        (j.items || []).forEach(x => { const has = c.standards.some(s => s.code === x.code && s.text === x.text);
          out.append(el('div', { class: 'opt st-' + x.status }, el('b', { class: 'code', text: x.code }), el('span', { class: 'badge st-' + x.status, text: STATUS[x.status] || '' }), el('p', { text: x.text }), x.why ? el('p', { class: 'muted', text: x.why }) : null,
            x.sources && x.sources.length ? el('p', { class: 'muted' }, '출처: ', srcLinks(x.sources)) : el('p', { class: 'muted', text: x.status === 'seed' ? '출처: 학교 시드 데이터' : '출처: 근거 링크 없음 · 원문 대조 필요' }),
            el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: has ? '추가됨' : '추가', disabled: has || !D.canEdit || c.standards.length >= 8, onclick: () => { c.standards.push({ code: x.code, text: x.text, status: x.status, sources: x.sources || [] }); src('standards', 'ai'); draw(false); } }))); });
        if (j.sources && j.sources.length) out.append(el('details', {}, el('summary', { text: `검색에 쓰인 출처 ${j.sources.length}개` }), srcLinks(j.sources)));
      } catch (e) { clear(out); err(e.message); } };
    f.append(el('div', { class: 'core-std-search' }, el('label', { class: 'block' }, '인터넷에서 성취기준 찾기', q),
      el('button', { type: 'button', class: 'btn btn-secondary', disabled: !D.canEdit, text: '🔎 검색해서 추천', onclick: () => run(false) }), ' ',
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: !D.canEdit, text: '다시 검색', onclick: () => run(true) })), out);
  }

  // AI 추천 → 선택 시 반영
  const APPLY = {
    identity: v => { c.identity = { goals: v.goals || [], teacher_view: v.teacher_view || '', student_view: v.student_view || '' }; if (v.values) c.values = v.values; }, question: v => { c.question = v; c.question_basis = { topic: c.topic, subject: c.subject, values: c.values.slice() }; },
    topic: v => { c.topic = v; }, subject: v => { c.subject = v; }, values: v => { c.values = v; }, competencies: v => { c.competencies = v; },
    standards: v => { c.standards = v; }, goals: v => { c.goals = v.map((g, i) => ({ key: 'G' + (i + 1), ...g })); }, task: v => { c.task = v; },
    rubric: v => { c.rubric = v.map((r, i) => ({ key: 'R' + (i + 1), ...r, tools: (r.tools || (r.tool ? [r.tool] : [])).filter(t => S.tools.includes(t)).slice(0, S.max_tools || 3), methods: (r.methods || []).filter(m => S.methods.includes(m)).slice(0, S.max_methods || 2) })); collect(); },
    flow: v => { c.flow = c.flow.map(x => { const n = v.find(y => y.k === x.k) || {}; return { ...x, activity: n.activity || '', r: n.r || [], methods: (n.methods || []).filter(m => S.methods.includes(m)).slice(0, S.max_methods || 2) }; }); collect(); }
  };
  const summary = (step, v) => {
    if (typeof v === 'string') return v; if (step === 'identity') { const gn = Object.fromEntries(S.goals.map(g => [g.code, g.text])); return `교육목표: ${(v.goals||[]).map(g => g + ' ' + (gn[g] || '')).join(' / ')}\n가치: ${(v.values||[]).join(', ') || '-'}\n교사관: ${v.teacher_view}\n학생관: ${v.student_view}`; }
    if (step === 'task') return `${v.text} (역할 ${v.role} · 청중 ${v.audience} · 산출물 ${v.product})`;
    if (step === 'standards') return v.map(x => x.code + ' ' + x.text).join('\n'); if (step === 'goals') return v.map((g, i) => `G${i + 1} ${g.text} [${targetLabel(g)}]`).join('\n');
    if (step === 'standards') return v.map(x => `${x.code} ${x.text}`).join('\n');
    if (step === 'rubric') return v.map((r, i) => `${r.key || 'R' + (i + 1)} [${r.goal}·${r.element}] ${r.criterion}\n  A ${r.A} / B ${r.B} / C ${r.C}\n  평가 도구: ${(r.tools || []).join(', ') || '-'} · 교수법: ${(r.methods || []).join(', ') || '-'}`).join('\n');
    if (step === 'flow') return v.map(x => `${x.k}: ${x.activity} [${(x.r || []).join(',')}] · 교수법: ${(x.methods || []).join(', ') || '-'}`).join('\n'); return v.join(', ');
  };
  async function suggest() {
    const step = steps[idx].key; err(''); const box = $('core-options'); clear(box); box.append(el('p', { class: 'muted wz-loading', text: 'Alter가 추천을 만드는 중…' })); $('core-ai').hidden = false;
    try { const j = await api('/suggest/' + step, { core: c }); clear(box);
      if (step === 'whereto') { (j.checks || []).forEach(x => box.append(el('div', { class: 'opt' }, el('b', { text: `${x.k} ${x.ok ? '✓' : '△'}` }), el('p', { text: x.evidence }), el('p', { class: 'muted', text: x.suggestion })))); c.whereto = (j.checks || []).filter(x => x.ok).map(x => x.k); draw(false); return; }
      if (!j.options.length) box.append(el('p', { text: '쓸 수 있는 추천이 없습니다. 직접 입력하세요.' }));
      j.options.forEach((o, i) => box.append(el('div', { class: 'opt ai-opt' }, el('b', { text: `Alter 추천 ${i + 1}` }), el('pre', { text: summary(step, o.value) }), el('p', { class: 'muted', text: o.why }),
        el('button', { type: 'button', class: 'btn btn-ai btn-sm', text: '이걸로 선택', disabled: !D.canEdit, onclick: () => { APPLY[step](JSON.parse(JSON.stringify(o.value))); src(step, 'ai'); draw(false); } }))));
    } catch (e) { clear(box); err(e.message); }
  }
  async function rule() {
    const step = steps[idx].key, r = $('core-rule'); clear(r);
    if (!['topic', 'prereq', 'identity', 'standards', 'rubric'].includes(step)) return;
    try { const j = (await api('/rule/' + step, { core: c })).rule;
      if (step === 'topic') r.append(datalist('dl-topic', j.candidates), el('p', { class: 'muted', text: `${c.grade}학년 주제: ` + j.candidates.join(', ') }));
      if (step === 'prereq') { if (!j.known) r.append(el('p', { text: '직접 입력한 주제라 연계표에 없습니다. 선수과목을 직접 적어 주세요.' })); else { r.append(el('p', { text: `연계표: 선수 ${j.prereq.join(', ') || '없음'} → 이 주제 → 다음 ${j.next || '없음'}` })); if (!c.prereq.length && j.prereq.length) { c.prereq = j.prereq.slice(); src('prereq', 'rule'); draw(false); } } }
      if (step === 'identity' && j.recommended_values) r.append(el('p', { class: 'muted', text: '주제 연계 권장 가치(참고): ' + (j.recommended_values.join(', ') || '없음') }));
      if (step === 'standards') { r.append(el('p', { class: 'muted', text: j.candidates.length ? `원문 DB 성취기준 ${j.candidates.length}개 중에서 Alter가 고릅니다. (${j.note || ''})` : '이 교과는 성취기준 데이터가 없어 Alter 제안 문장에 [코드 확인]이 붙습니다.' }));
        if (j.candidates.length) stdBrowse(r, j.candidates); }
      if (step === 'rubric') j.elements.forEach(e => r.append(el('p', { class: 'muted', text: `${e.competency} · ${e.stage}·${e.element} — 우수: ${e['우수']}` })));
    } catch (e) { err(e.message); }
  }
  // 큰 단계(0 정체성 → 1 목표 → 2 평가 → 3 수업)로 세부 단계를 묶어 보여 준다. 데이터·저장 구조는 그대로.
  const PHASES = [
    { n: 1, name: '시작', hint: '아이디어', keys: ['start'] },
    { n: 2, name: '정체성', hint: '가치 · 관점', keys: ['identity'] },
    { n: 3, name: '목표', hint: '주제 · 교과 · 질문 · 역량', keys: ['topic', 'prereq', 'subject', 'question', 'competencies', 'standards'] },
    { n: 4, name: '평가 · 수업', hint: '루브릭 · 4MAT', keys: ['goals', 'task', 'rubric', 'flow', 'whereto', 'output'] }];
  const phaseOf = k => PHASES.find(p => p.keys.includes(k)) || PHASES[PHASES.length - 1];
  // 채워짐 판정은 실제 저장된 데이터만 본다(단계를 눌러 두기만 해도 채워진 것으로 보이던 문제 수정).
  // 서버(lib/core.ts 의 Core.filled)와 같은 규칙 — 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.
  const filled = k => { const s = v => (v === null || v === undefined ? '' : String(v).trim());
    switch (k) {
      case 'start': return s(c.intent) !== '' || s(c.course) !== '';
      case 'identity': return (c.values || []).length > 0 || (c.identity && c.identity.goals || []).length > 0 || s(c.identity && c.identity.teacher_view) !== '' || s(c.identity && c.identity.student_view) !== '';
      case 'topic': return s(c.topic) !== '';
      case 'prereq': return (c.prereq || []).length > 0;
      case 'subject': return s(c.subject) !== '';
      case 'question': return s(c.question) !== '';
      case 'competencies': return (c.competencies || []).length > 0;
      case 'standards': return (c.standards || []).length > 0;
      case 'goals': return (c.goals || []).length > 0;
      case 'task': return s(c.task && c.task.text) !== '';
      case 'rubric': return (c.rubric || []).length > 0;
      case 'flow': return (c.flow || []).some(x => x && s(x.activity) !== '');
      case 'whereto': return (c.whereto || []).length > 0;
      default: return false;
    } };
  const shortLabel = l => l.replace(/^\d단계 · /, '').replace(/ \(.*\)$/, '');
  function drawStepper() {
    const cur = phaseOf(steps[idx].key), done = steps.filter(x => x.key !== 'output' && filled(x.key)).length, pct = Math.round(done / (steps.length - 1) * 100);
    $('core-pct').textContent = pct + '%'; $('core-bar').setAttribute('aria-valuenow', pct); $('core-bar-fill').style.width = pct + '%';
    const ph = $('core-phases'); clear(ph);
    PHASES.forEach(p => {
      const first = steps.findIndex(x => p.keys.includes(x.key));
      const n = p.keys.filter(filled).length;
      const total = p.keys.filter(k => k !== 'output').length;
      const st = p === cur ? 'current' : n >= total ? 'done' : p.n < cur.n ? 'partial' : 'pending';
      const hint = st === 'current' ? ('지금 · ' + (p.hint || '')) : (st === 'done' ? '완료' : (p.hint || ''));
      const btn = el('button', { type: 'button', 'aria-current': st === 'current' ? 'step' : 'false', onclick: () => go(first, { free: true }) },
        el('span', { class: 'wz-dot', 'aria-hidden': 'true', text: st === 'done' ? '✓' : String(p.n) }),
        el('span', { class: 'wz-ph-txt' }, el('b', { text: p.name }), el('small', { text: hint })));
      ph.append(el('li', { class: 'wz-ph ' + st }, btn));
    });
    const sub = $('core-substeps'); if (sub) { clear(sub); /* v21: 세부 단계 필 과다 노출 제거 */ }
    $('core-kicker').textContent = `지금 정할 것 · ${cur.name}`; $('core-pos').textContent = `${idx + 1} / ${steps.length}`;
    const sm = $('core-summary'); clear(sm);
    collect();
    [['아이디어', c.intent], ['설정', `${c.grade}학년 ${c.semester || ''}학기 · ${c.credits}학점 ${c.sessions}차시` + (c.course ? ' · ' + c.course : '')], ['주제 / 교과', [c.topic, c.subject].filter(Boolean).join(' / ')], ['가치', c.values.join(', ')], ['핵심 질문', c.question], ['역량', c.competencies.join(', ')],
     ['성취기준', c.standards.map(x => x.code).join(', ')], ['학습목표', c.goals.length ? c.goals.length + '개' : ''], ['루브릭', c.rubric.length ? c.rubric.length + '행' : ''], ['평가 도구 (자동)', c.tools.join(', ')], ['교수법 (자동)', c.methods.join(', ')]]
      .forEach(([k, v]) => sm.append(el('dt', { text: k }), el('dd', { class: v ? '' : 'empty', text: v || '아직 없음' })));
  }
  function draw(withRule = true) {
    const s = steps[idx]; c.step = s.key; $('core-step-title').textContent = TITLES[s.key] || s.label;
    const helpTxt = HELP[s.key] || '';
    const infoEl = $('core-step-info');
    if (infoEl) {
      if (helpTxt) { infoEl.hidden = false; infoEl.setAttribute('data-info-key', 'step.' + s.key); infoEl.setAttribute('data-info-title', TITLES[s.key] || s.label); infoEl.setAttribute('aria-label', (TITLES[s.key] || s.label) + ' 설명 보기'); }
      else { infoEl.hidden = true; }
    }
    const helpP = $('core-step-help'); if (helpP) { helpP.textContent = ''; helpP.hidden = true; }
    const nav = $('core-steps'); clear(nav); steps.forEach((x, i) => nav.append(el('li', { class: i === idx ? 'on' : '' }, el('a', { href: '#', text: x.label + (filled(x.key) ? ' ✓' : ''), onclick: ev => { ev.preventDefault(); go(i, { free: true }); } }))));
    const f = $('core-form'); clear(f); FORMS[s.key](f);
    $('core-suggest').hidden = !(s.kind === 'ai' || s.key === 'whereto') || !D.canEdit;
    $('core-draft').hidden = !D.canEdit || idx < steps.findIndex(x => x.key === 'topic'); $('core-prev').disabled = idx === 0; $('core-next').hidden = idx === steps.length - 1;
    $('core-ai').hidden = $('core-suggest').hidden && $('core-draft').hidden && !$('core-options').firstChild;
    $('core-next').textContent = idx === steps.length - 2 ? '저장하고 출력으로 →' : (phaseOf(steps[idx + 1]?.key || '') !== phaseOf(s.key) ? `저장하고 ${phaseOf(steps[idx + 1].key).n}단계로 →` : '저장하고 다음 →');
    drawStepper();
    warn(); if (withRule) { clear($('core-options')); rule(); }
  }
  function valid() {
    const k = steps[idx].key;
    if (k === 'start' && !(c.intent || '').trim() && !(c.course || '').trim()) return '수업 아이디어를 한두 문장으로 적어 주세요. (과목명만 적어도 됩니다)';
    if (k === 'identity' && !c.values.length) return '핵심 가치를 1–2개 고르세요.';
    if (k === 'identity' && c.values.length > 2) return '핵심 가치는 1–2개입니다.';
    if (k === 'question' && !c.question.trim()) return '핵심 질문을 입력하세요.';
    if (k === 'competencies' && c.competencies.length && c.competencies.length < 2) return '하위 역량은 2개 이상 고르세요 (1학점당 2개 권장).';
    if (k === 'start' && !(c.sessions >= 4)) return '전체 차시를 4 이상으로 입력하세요.';
    return '';
  }
  // 자동 저장: 입력이 멈추고 1.5초 뒤, 바뀐 경우에만. 저장 상태는 aria-live 로 알림 (제목 변경도 같은 경로로 저장)
  let chk = D.checks || [], lastJSON = JSON.stringify(c), timer = 0, saving = null;
  const stateEl = $('core-saved'), setState = (cls, t) => { stateEl.className = 'muted save-state ' + cls; stateEl.textContent = t; };
  // 위쪽 제목 칸(#design-title)에서 제목을 바로 고칠 수 있게 한다. 고치면 자동 저장되고 탭 제목도 따라간다.
  const titleEl = $('design-title'); let lastTitle = D.title;
  const syncTitle = () => { if (titleEl && titleEl.value !== D.title) titleEl.value = D.title; document.title = (D.title || '설계서') + ' · 별무리 수업 디자이너'; };
  if (titleEl && D.canEdit) titleEl.addEventListener('input', () => { D.title = titleEl.value; document.title = (titleEl.value || '설계서') + ' · 별무리 수업 디자이너'; schedule(); });
  syncTitle();
  const dirty = () => D.canEdit && (JSON.stringify(c) !== lastJSON || D.title !== lastTitle);
  function schedule() { if (!D.canEdit) return; clearTimeout(timer); if (!dirty()) return; setState('dirty', '저장 안 된 변경 있음…'); timer = setTimeout(() => save(), 1500); }
  async function save() {
    if (!D.canEdit) return true; clearTimeout(timer);
    if (saving) await saving.catch(() => {});
    if (!dirty()) return true;
    const snap = JSON.stringify(c), snapTitle = D.title; setState('', '저장 중…');
    saving = api('', { title: D.title, core: c });
    try { const j = await saving; lastJSON = snap; if (JSON.stringify(c) === snap) { Object.assign(c, j.core); lastJSON = JSON.stringify(c); }
      if (j.title && j.title !== snapTitle) { D.title = j.title; if (document.activeElement !== titleEl) syncTitle(); else document.title = (j.title || '설계서') + ' · 별무리 수업 디자이너'; }
      lastTitle = D.title;
      chk = j.checks || chk; setState('ok', '저장됨 ' + j.saved_at); warn(); if (dirty()) schedule(); return true; }
    catch (e) { setState('err', '저장 실패: ' + e.message + ' (자동으로 다시 시도합니다)'); timer = setTimeout(() => save(), 10000); err(e.message); return false; }
    finally { saving = null; }
  }
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest('.core-main')) schedule(); }));
  document.addEventListener('click', e => { if (e.target.closest('.core-main button')) setTimeout(schedule, 0); });
  window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
  // 점검: 경고만(저장·이동은 막지 않음). 현재 단계 경고 + 출력 단계에서 전체 체크리스트
  // extra: 단계를 자유롭게 건너뛸 때 '확인해 보세요' 안내 한 줄 (이동을 막지 않는다)
  function warn(extra = '') {
    const box = $('core-warn'); clear(box); const k = steps[idx].key, list = k === 'output' ? chk : chk.filter(w => w.step === k);
    const hint = extra ? el('p', { class: 'muted', text: '확인: ' + extra }) : null;
    if (k === 'output' && !list.length) { box.className = 'wz-warn ok'; if (hint) box.append(hint); box.append(el('p', { text: '✓ 설계 규칙 점검을 모두 통과했습니다.' })); return; }
    if (!list.length && !hint) { box.className = 'wz-warn'; return; }
    box.className = 'wz-warn'; if (hint) box.append(hint);
    if (!list.length) return;
    box.append(el('p', { class: 'muted', text: k === 'output' ? `설계 점검 ${list.length}건 (저장·인쇄는 가능합니다)` : '확인해 주세요 (저장은 됩니다)' }),
      el('ul', {}, list.map(w => el('li', {}, w.msg, k === 'output' ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '이동', onclick: () => go(steps.findIndex(x => x.key === w.step), { free: true }) }) : null))));
  }
  // 이동: 큰 단계·단계 목록으로는 어디든 바로 건너뛸 수 있다(막지 않고 안내만). '저장하고 다음'만 현재 단계를 확인한다.
  async function go(i, opts) {
    if (i < 0 || i >= steps.length) return;
    const free = !!(opts && opts.free), from = idx, m = valid();
    if (!free && i > from && m) return err(m);
    err('');
    if (await save()) { idx = i; draw(); window.scrollTo(0, 0); $('core-step-title').focus({ preventScroll: true }); if (free && i > from && m) warn(m); }
  }
  $('core-prev').addEventListener('click', () => go(idx - 1)); $('core-next').addEventListener('click', () => go(idx + 1)); $('core-suggest').addEventListener('click', suggest);
  // 초안 전체 작성: 비어 있는 단계만 AI가 채우고 저장 전에 교사가 검토
  $('core-draft').addEventListener('click', async () => {
    err(''); const box = $('core-options'); clear(box); box.append(el('p', { class: 'muted wz-loading', text: 'Alter가 초안을 쓰는 중… (미리보기만, 바로 넣지 않습니다)' }));
    try { const j = await api('/draft', { core: c }); clear(box);
      if (!j.filled.length) { box.append(el('p', { text: '채울 수 있는 초안이 없습니다.' })); return; }
      const preview = j.core; const picks = new Set(j.filled);
      const list = el('div', { class: 'draft-preview' });
      j.filled.forEach(k => { const lab = (steps.find(s => s.key === k) || { label: k }).label;
        list.append(el('label', { class: 'chip' }, el('input', { type: 'checkbox', checked: true, onchange: e => { if (e.target.checked) picks.add(k); else picks.delete(k); } }), ' ' + lab)); });
      box.append(el('div', { class: 'opt' }, el('b', { text: '초안 미리보기 · 적용할 단계만 고르세요' }), list,
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'btn btn-primary', text: '선택한 단계만 적용', onclick: () => {
            const keep = { step: c.step, sources: Object.assign({}, c.sources) };
            picks.forEach(k => { if (k in preview) c[k] = JSON.parse(JSON.stringify(preview[k])); if (preview.sources && preview.sources[k]) keep.sources[k] = preview.sources[k]; });
            if (picks.has('prereq') || picks.has('topic')) c.prereq = preview.prereq || c.prereq;
            Object.assign(c, { step: keep.step, sources: keep.sources });
            clear(box); box.append(el('p', { text: '선택한 초안을 넣었습니다 (아직 저장 전). 각 단계를 검토하세요.' })); draw(false); schedule();
          } }),
          el('button', { type: 'button', class: 'btn btn-secondary', text: '취소', onclick: () => clear(box) }))));
    } catch (e) { clear(box); err(e.message); }
  });
  // ---------- AI 논의 챗봇 (설계별 기록, 제안은 미리보기 후 적용, Escape) ----------
  const chat = $('core-chat');
  let undoCore = null;
  if (chat) {
    const log = $('chat-log'), inp = $('chat-input'), openB = $('chat-open'), prop = $('chat-propose'), backdrop = $('chat-backdrop');
    let loaded = false, busy = false, lastFocus = null;
    const chatApi = async (path, body) => call(path === '/clear' ? 'chat_clear' : body === undefined ? 'chat_get' : 'chat_post', Object.assign({ id: D.id }, body || {}));
    const applyApi = async (field, value) => call('apply', { id: D.id, core: c, field, value });
    // Alter 답은 최소 마크다운(텍스트 노드만), 나머지는 그대로. 메시지가 생기면 '대화 없음' 안내는 지운다
    const msgNode = (role, role0, t0, extra) => el('div', { class: 'chat-msg ' + role + (extra ? ' ' + extra : '') }, el('span', { class: 'chat-who', text: role === 'user' ? '나' : role === 'assistant' ? 'Alter' : (role === 'sys' ? '안내' : '') }),
      role0 === 'assistant' && !extra ? el('div', { class: 'chat-md md' }, mdNodes(t0)) : el('p', { text: t0 }));
    const bubble = (role, t0, extra = '') => { const em0 = log.querySelector('.chat-empty'); if (em0) em0.remove(); const b = msgNode(role, role, t0, extra); log.append(b); log.scrollTop = log.scrollHeight; return b; };
    const empty = () => { if (!log.firstChild) log.append(el('p', { class: 'muted chat-empty', text: '아직 대화가 없습니다.' })); };
    const showPropose = p => {
      if (!prop) return; clear(prop); if (!p || !D.canEdit) { prop.hidden = true; return; }
      prop.hidden = false;
      const preview = typeof p.value === 'string' ? p.value : JSON.stringify(p.value);
      prop.append(el('div', { class: 'propose-card' }, el('b', { text: '제안 미리보기 · ' + (p.label || p.field) }), el('pre', { text: preview }),
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '선택한 칸에 적용', onclick: async () => {
            try { undoCore = JSON.parse(JSON.stringify(c)); const j = await applyApi(p.field, p.value); Object.assign(c, j.core); prop.hidden = true; clear(prop); draw(false); schedule(); }
            catch (e) { bubble('sys', e.message, 'err'); }
          } }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: '취소', onclick: () => { prop.hidden = true; clear(prop); } }),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '되돌리기', disabled: !undoCore, onclick: () => { if (!undoCore) return; Object.assign(c, undoCore); undoCore = null; draw(false); schedule(); prop.hidden = true; clear(prop); } }))));
    };
    const isNarrow = () => window.matchMedia('(max-width: 1099px)').matches;
    const setOpen = (o, quiet = false) => {
      if (o && !quiet) lastFocus = document.activeElement;
      chat.hidden = !o;
      const narrow = isNarrow();
      // PC wide: side workspace, no dimming. Mobile: modal sheet + backdrop.
      if (backdrop) backdrop.hidden = !(o && narrow);
      openB.setAttribute('aria-expanded', String(o));
      document.body.classList.toggle('chat-on', o);
      document.body.classList.toggle('chat-sheet', o && narrow);
      // Move drawer into shell grid on wide PC so sticky side column works
      const shell = document.getElementById('v21-shell');
      if (shell && o && !narrow && chat.parentElement !== shell) shell.appendChild(chat);
      if (o) { if (!quiet) inp.focus(); if (!loaded) { loaded = true; chatApi('').then(j => { const em0 = log.querySelector('.chat-empty'); if (em0) em0.remove(); const first = log.firstChild; j.messages.forEach(m => log.insertBefore(msgNode(m.role, m.role, m.content, ''), first)); log.scrollTop = log.scrollHeight; empty(); }).catch(e => bubble('sys', e.message, 'err')); } }
      else if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (_) {}
    };
    // 넓은 화면(PC)에서는 Alter 를 처음부터 오른쪽 패널로 펼쳐 둔다. 자동으로 연 패널은 화면이 좁아지면 접는다(입력란을 가리지 않게).
    let autoOpen = false;
    window.addEventListener('resize', () => { if (chat.hidden) return; if (autoOpen && isNarrow()) { autoOpen = false; setOpen(false, true); } else setOpen(true, true); });
    if (!isNarrow()) { autoOpen = true; setOpen(true, true); }
    openB.addEventListener('click', () => { autoOpen = false; setOpen(chat.hidden); }); $('chat-close').addEventListener('click', () => setOpen(false));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !chat.hidden) { e.preventDefault(); setOpen(false); } });
    inp.addEventListener('input', () => { $('chat-count').textContent = inp.value.length + '/1000'; grow(inp); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('chat-form').requestSubmit(); } });
    $('chat-form').addEventListener('submit', async e => { e.preventDefault(); const q = inp.value.trim(); if (!q || busy) return; busy = true; $('chat-send').disabled = true;
      const em = log.querySelector('.chat-empty'); if (em) em.remove(); bubble('user', q); const kept = q; inp.value = ''; grow(inp); $('chat-count').textContent = '0/1000';
      const wait = bubble('assistant', 'Alter가 생각 중…', 'wz-loading');
      try { const j = await chatApi('', { message: kept, core: c, stage: steps[idx].key }); wait.remove(); bubble('assistant', j.reply); if (j.propose) showPropose(j.propose); }
      catch (x) { wait.remove(); bubble('sys', x instanceof TypeError ? '네트워크 연결을 확인한 뒤 다시 보내 주세요.' : x.message, 'err'); inp.value = kept; }
      finally { busy = false; $('chat-send').disabled = false; inp.focus(); } });
    const clr = $('chat-clear'); if (clr) clr.addEventListener('click', async () => { if (!confirm('이 설계의 Alter 대화 기록을 모두 지울까요?')) return; try { await chatApi('/clear', {}); clear(log); empty(); showPropose(null); } catch (x) { bubble('sys', x.message, 'err'); } });
  }
  draw();
}
