// Alter 답용 최소 마크다운 → DOM 노드. HTML 문자열을 만들지 않으므로(텍스트 노드만) 태그는 그대로 글자로 보인다.
// 지원: **굵게**, *기울임*, `코드`, 줄바꿈, 빈 줄 문단, "- "/"* "/"• " 목록, "1. " 번호 목록, "#" 제목(굵게)
function inline(parent: Node, s: string) {
  const re = /(\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|`([^`\n]+?)`|\*([^*\s][^*\n]*?)\*)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
    const tag = m[2] !== undefined || m[3] !== undefined ? 'strong' : m[4] !== undefined ? 'code' : 'em';
    const e = document.createElement(tag); e.textContent = m[2] ?? m[3] ?? m[4] ?? m[5] ?? ''; parent.appendChild(e);
    last = m.index + m[0].length;
  }
  if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
}
export function mdNodes(text: string): DocumentFragment {
  const f = document.createDocumentFragment();
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  let p: HTMLElement | null = null, list: HTMLElement | null = null, listType = '';
  const close = () => { p = null; list = null; listType = ''; };
  for (const raw of lines) {
    const ln = raw.trimEnd();
    if (ln.trim() === '') { close(); continue; }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(ln), ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(ln), hd = /^\s*#{1,6}\s+(.*)$/.exec(ln);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      if (!list || listType !== t) { list = document.createElement(t); listType = t; f.appendChild(list); p = null; }
      const li = document.createElement('li'); inline(li, ul ? ul[1] : ol![2]); list.appendChild(li); continue;
    }
    list = null; listType = '';
    if (hd) { const e = document.createElement('p'); const b = document.createElement('strong'); inline(b, hd[1]); e.appendChild(b); f.appendChild(e); p = null; continue; }
    if (!p) { p = document.createElement('p'); f.appendChild(p); } else p.appendChild(document.createElement('br'));
    inline(p, ln);
  }
  return f;
}
export function mdInto(el: HTMLElement, text: string) { el.replaceChildren(mdNodes(text)); el.classList.add('md'); }
