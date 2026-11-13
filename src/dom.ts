import { session } from './store.js';
// DOM 도우미. 동적 값은 textContent·속성으로만 넣는다(HTML 문자열 삽입 금지).
type Kid = Node | string | null | undefined | false | Kid[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') e.textContent = String(v);
    else if (k === 'class') e.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') (e as any)[k] = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  add(e, kids); return e;
}
function add(e: Node, kids: Kid[]) { for (const k of kids) { if (k === null || k === undefined || k === false) continue; if (Array.isArray(k)) add(e, k); else e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); } }
/** 정적인 마크업(사용자 값 없음)만 파싱한다. */
export function tpl(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  const f = document.createDocumentFragment(); while (doc.body.firstChild) f.appendChild(document.adoptNode(doc.body.firstChild)); return f;
}
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const clear = (n: Node) => { while (n.firstChild) n.removeChild(n.firstChild); };
export const ROLE_KO: Record<string, string> = { teacher: '교사', researcher: '연구소', admin: '관리자' };
export function infoBtn(key: string, title: string): HTMLElement {
  const w = (window as any).SDInfo; return w ? w.button(key, { title }) : h('span');
}
// 한 번만 보여 줄 알림 (이름 앞에 'class-designer:' — 공용 주소 규칙 1)
export function flash(msg?: string) { if (msg) session.set('flash', msg); }
export function takeFlash(): string { const m = String(session.get('flash', '') || ''); session.remove('flash'); return m; }
/** 앱 안 이동 (main.ts 가 cd:go 를 받아 화면만 바꿈) */
export function go(path: string, msg?: string) { window.dispatchEvent(new CustomEvent('cd:go', { detail: { path, msg } })); }
export const kst = (iso: string | null | undefined) => {
  if (!iso) return ''; const d = new Date(Date.parse(iso) + 9 * 3600e3); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
