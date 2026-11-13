/* 설명 ⓘ 팝오버 — script-src 'self' 전용. window.SDInfo */
(function () {
  const CATALOG = {
    'home.workflow': '아이디어로 시작한 뒤 정체성(핵심 가치) → 주제·교과 → 핵심 질문 → 역량·평가·4MAT 순서로 이어집니다. 저장 전에도 Alter와 이야기할 수 있습니다.',
    'home.idea': '주제나 과목을 먼저 고르지 않아도 됩니다. 떠오른 수업 장면을 몇 문장으로 적어 주세요. 학생 실명·학번·연락처는 적지 마세요.',
    'home.settings': '제목·학년·학기·학점·차시는 나중에 시작 단계에서도 바꿀 수 있습니다. 차시를 비우면 학점×18(예: 2학점 = 36차시)로 정합니다.',
    'home.alter': '새 설계를 만들기 전에도 아이디어를 이야기할 수 있습니다. 설계를 시작하면 이 대화가 그 설계로 옮겨집니다. 학생 개인정보는 쓰지 마세요.',
    'home.shared': '다른 선생님이 공유한 설계입니다. 읽기 전용이며, ‘내 것으로 복사’하면 고쳐 쓸 수 있습니다.',
    'step.start': '주제나 과목을 먼저 고르지 않아도 됩니다. 떠오른 수업 장면을 한두 문장으로 적어 주세요. 나중에 정체성·주제·교과·질문으로 다듬습니다.',
    'step.identity': '핵심 가치 1–2개를 고르고, 교사관·학생관을 짧게 쓰세요. 가치는 평가하지 않으며, 뒤에서 주제·교과와 함께 핵심 질문으로 이어집니다. Alter는 제안만 하고 자동으로 채우지 않습니다.',
    'step.question': '앞에서 정한 핵심 주제·핵심 교과·핵심 가치(정체성)를 하나로 잇는 열린 질문 하나. 주제·교과·가치가 바뀌면 연결을 다시 검토하세요(자동으로 덮어쓰지 않습니다).',
    'step.topic': '학년별 핵심 주제 중 하나. 직접 입력도 됩니다.',
    'step.prereq': '해설서의 주제 연계표로 자동 제안됩니다. 고칠 수 있습니다.',
    'step.subject': '주제를 다룰 핵심 교과 하나.',
    'step.competencies': '하위 역량은 1학점당 2개(2학점 = 3–4개 권장, 최소 2개). 역량마다 권장 평가 도구가 있어 루브릭에서 자동으로 추천됩니다.',
    'step.standards': '인터넷 검색(출처 포함)이나 학교 시드 목록에서 고르세요. NCIC 원문과 꼭 대조하세요.',
    'step.goals': '"나는 ~할 수 있다"로 끝나는 관찰 가능한 학습목표. 최대 8개까지 추가할 수 있습니다.',
    'step.task': '역할·청중·산출물이 드러나는 수행과제.',
    'step.rubric': '목표(G) 하나당 한 행. 각 R 옆에서 평가 도구와 교수법을 고르면 자동으로 모입니다.',
    'step.flow': '4MAT 구간을 하나씩 펼쳐 활동을 쓰고, 옆에 교수법 태그를 붙이세요. 차시 구간은 전체 차시에 맞춰 조정됩니다.',
    'step.whereto': '7요소를 점검하세요. Alter 점검은 근거와 보완 제안을 보여 줍니다.',
    'step.output': '설계서를 미리보고 인쇄하세요.',
    'field.values': '핵심 가치는 평가 요소가 아닙니다. 수업의 방향이며, 주제·교과와 함께 핵심 질문으로 이어집니다. 1–2개만 고르세요.',
    'field.views': '빈칸에 직접 쓰세요. Alter는 “Alter 추천 받기” 또는 옆 패널에서만 제안하며 자동으로 채우지 않습니다.',
    'field.sessions': '비워 두어도 됩니다. 기본 차시는 학점×18입니다.',
    'field.privacy': '학생 이름·학번·연락처 등 개인정보는 쓰지 마세요. 개인정보가 보이면 AI로 보내지 않습니다.',
    'field.alter': '지금 단계와 설계를 바탕으로 답합니다. 칸을 바꿀 제안은 미리보기 후 적용하세요. 학생 개인정보는 쓰지 마세요.',
    'field.autoSum': '루브릭 R의 평가 도구와 4MAT·R의 교수법을 자동으로 모읍니다. 권장 역량 수는 1학점당 2개입니다.',
    'field.intentEmpty': '아이디어가 아직 없으면 Alter에게 “어떤 수업을 해 볼까?”라고 물어 보세요.'
  };

  let pop = null, titleEl = null, bodyEl = null, closeBtn = null, openBtn = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'sd-info-pop';
    pop.className = 'info-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-labelledby', 'sd-info-pop-title');
    titleEl = document.createElement('div');
    titleEl.id = 'sd-info-pop-title';
    titleEl.className = 'info-pop-title';
    titleEl.textContent = '안내';
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost btn-sm info-pop-close';
    closeBtn.setAttribute('aria-label', '설명 닫기');
    closeBtn.textContent = '✕';
    bodyEl = document.createElement('div');
    bodyEl.className = 'info-pop-body';
    const head = document.createElement('div');
    head.className = 'info-pop-head';
    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    pop.appendChild(head);
    pop.appendChild(bodyEl);
    document.body.appendChild(pop);
    closeBtn.addEventListener('click', close);
    return pop;
  }

  function textFor(btn) {
    const key = btn.getAttribute('data-info-key');
    if (key && CATALOG[key]) return CATALOG[key];
    return btn.getAttribute('data-info') || '';
  }

  function position(btn) {
    ensurePop();
    const r = btn.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth, vh = window.innerHeight;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    pop.style.left = '0'; pop.style.top = '0';
    const pw = pop.offsetWidth || 280, ph = pop.offsetHeight || 120;
    let left = r.left;
    let top = r.bottom + margin;
    if (left + pw > vw - margin) left = Math.max(margin, vw - pw - margin);
    if (left < margin) left = margin;
    if (top + ph > vh - margin) top = Math.max(margin, r.top - ph - margin);
    if (top < margin) top = margin;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.visibility = 'visible';
  }

  function close() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.focus();
      openBtn = null;
    }
  }

  function open(btn) {
    const t = textFor(btn);
    if (!t) return;
    ensurePop();
    if (openBtn && openBtn !== btn) openBtn.setAttribute('aria-expanded', 'false');
    bodyEl.textContent = t;
    const lab = btn.getAttribute('data-info-title') || btn.getAttribute('aria-label') || '안내';
    titleEl.textContent = lab.replace(/\s*설명\s*$/, '') || '안내';
    openBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', 'sd-info-pop');
    position(btn);
    closeBtn.focus();
  }

  function toggle(btn) {
    if (openBtn === btn && pop && !pop.hidden) close();
    else open(btn);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (btn) { e.preventDefault(); e.stopPropagation(); toggle(btn); return; }
    if (pop && !pop.hidden && !pop.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop && !pop.hidden) { e.preventDefault(); close(); return; }
    const btn = e.target.closest && e.target.closest('.info-btn');
    if (btn && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(btn); }
  });
  window.addEventListener('resize', () => { if (openBtn && pop && !pop.hidden) position(openBtn); });
  window.addEventListener('scroll', () => { if (openBtn && pop && !pop.hidden) position(openBtn); }, true);

  function button(key, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost info-btn';
    b.setAttribute('data-info-key', key);
    if (opts.title) b.setAttribute('data-info-title', opts.title);
    b.setAttribute('aria-label', (opts.label || opts.title || '설명') + ' 보기');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-haspopup', 'dialog');
    b.textContent = 'ⓘ';
    return b;
  }

  function labelWithInfo(labelText, key, opts = {}) {
    const wrap = document.createElement('span');
    wrap.className = 'label-with-info';
    const lab = document.createElement('span');
    lab.textContent = labelText;
    wrap.appendChild(lab);
    wrap.appendChild(button(key, Object.assign({ title: labelText }, opts)));
    return wrap;
  }

  window.SDInfo = { CATALOG, button, labelWithInfo, open, close, textFor };
})();
