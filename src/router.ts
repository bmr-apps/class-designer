// 주소 도우미: 이 앱은 https://apps.bmrschool.net/class-designer/ 아래에서만 움직인다 (공용 주소 규칙 3).
import { flash } from './dom';
export const BASE: string = import.meta.env.BASE_URL; // '/class-designer/'
/** 앱 안 주소 → '/class-designer/...' */
export const link = (p = '') => BASE + String(p).replace(/^\/+/, '');
/** 다시 불러오지 않고 화면만 바꿈 */
export function nav(p: string, msg?: string, replace = false) {
  flash(msg);
  const url = p.startsWith(BASE) ? p : link(p);
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
  window.dispatchEvent(new Event('cd:route'));
}
export type Route = { name: 'home' | 'design' | 'print' | 'admin' | 'stats' | 'notfound'; id?: number };
export function route(path = location.pathname): Route {
  const p = (path.startsWith(BASE) ? path.slice(BASE.length) : path.replace(/^\/+/, '')).replace(/\/+$/, '').replace(/^index\.html$/, '');
  let m: RegExpExecArray | null;
  if (p === '') return { name: 'home' };
  if ((m = /^designs\/(\d+)$/.exec(p))) return { name: 'design', id: +m[1] };
  if ((m = /^designs\/(\d+)\/print$/.exec(p))) return { name: 'print', id: +m[1] };
  if (p === 'admin') return { name: 'admin' };
  if (p === 'stats') return { name: 'stats' };
  return { name: 'notfound' };
}
