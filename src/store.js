// 브라우저 저장소 도우미 — apps.bmrschool.net 한 주소를 여러 앱이 함께 쓰므로,
// localStorage·sessionStorage 이름 앞에 'class-designer:' 를 자동으로 붙여 다른 앱 값과 섞이지 않게 합니다.
//   import { local, session } from './store.js';
//   local.set('theme', 'dark');          // 실제 이름: 'class-designer:theme'
//   local.get('theme', 'light');         // 없으면 'light'
//   local.remove('theme');
//   local.clear();                       // 내 앱 것만 지움 (다른 앱·로그인 정보는 그대로)
// 값은 JSON 으로 저장되므로 객체·배열도 그대로 넣고 꺼낼 수 있습니다.
export const PREFIX = 'class-designer:';

function make(areaName) {
  const area = () => { try { return globalThis[areaName] ?? null; } catch { return null; } };
  return {
    get(key, fallback = null) {
      const raw = area()?.getItem(PREFIX + key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    },
    set(key, value) { area()?.setItem(PREFIX + key, JSON.stringify(value)); },
    remove(key) { area()?.removeItem(PREFIX + key); },
    keys() {
      const a = area(); if (!a) return [];
      const out = [];
      for (let i = 0; i < a.length; i++) { const k = a.key(i); if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length)); }
      return out;
    },
    clear() { for (const k of this.keys()) this.remove(k); },
  };
}

export const local = make('localStorage');
export const session = make('sessionStorage');
