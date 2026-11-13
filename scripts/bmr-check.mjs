#!/usr/bin/env node
// 공용 주소 점검 (경고만). apps.bmrschool.net/<앱 주소> 를 여러 앱이 함께 쓰므로 서로 방해할 수 있는 코드를 찾아 알려 줍니다.
// - 항상 통과(exit 0). 단 .bmr-check.json 의 "block_dangerous": true 이면 storage-clear·sw-scope 두 규칙은 실패로 막습니다.
// - 예외: 그 줄(또는 바로 윗줄)에 `bmr-allow: 이유` 주석을 달면 건너뜁니다. 예) localStorage.clear(); // bmr-allow: 시험용 초기화 버튼
// - GitHub Actions 에서 main 에 push 하면 결과를 BMR APPS 허브로 보냅니다(GitHub OIDC 1회용 토큰, 비밀값 없음).
// 로컬에서도 실행할 수 있습니다: node scripts/bmr-check.mjs
import { readFileSync, readdirSync, statSync, appendFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const cfg = JSON.parse(readFileSync(join(ROOT, '.bmr-check.json'), 'utf8'));
const SLUG = String(cfg.slug || '').trim();
if (!/^[a-z][a-z0-9-]{1,38}$/.test(SLUG)) { console.log('경고: .bmr-check.json 의 slug 가 비었거나 형식이 다릅니다. 점검을 건너뜁니다.'); process.exit(0); }
const IGNORE = new Set(cfg.ignore ?? ['node_modules', 'dist', '.git']);
const ALLOW_SCRIPTS = (cfg.allowScripts ?? []).map((h) => String(h).toLowerCase());
const BLOCKING = new Set(['storage-clear', 'sw-scope']);
const EXT_CODE = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.html', '.htm']);
const EXT_STYLE = new Set(['.css', '.scss']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SL = esc(SLUG);

const RULES = {
  'storage-clear': { title: '저장소 전체 지우기', fix: `store.js 의 local.clear() 처럼 내 앱 이름표('${SLUG}:')가 붙은 것만 지우거나, removeItem('${SLUG}:이름') 으로 하나씩 지우세요.` },
  'storage-key': { title: '이름표 없는 저장 이름', fix: `이름 앞에 '${SLUG}:' 를 붙이거나(예: '${SLUG}:theme'), src/store.js 의 local.set('theme', 값) 을 쓰세요.` },
  'abs-path': { title: '사이트 맨 앞을 가리키는 경로', fix: `상대 경로('./파일')나 import.meta.env.BASE_URL + '파일' (= '/${SLUG}/파일') 을 쓰세요.` },
  'sw-scope': { title: '범위 없는 서비스 워커', fix: `navigator.serviceWorker.register('/${SLUG}/sw.js', { scope: '/${SLUG}/' }) 처럼 scope 를 꼭 '/${SLUG}/' 로 넣으세요.` },
  'ext-script': { title: '허용 목록 밖 외부 스크립트', fix: 'npm 으로 설치해 함께 빌드하세요. 꼭 필요하면 관리자와 상의한 뒤 .bmr-check.json 의 allowScripts 와 vite.config.js 의 CSP(script-src)에 함께 추가하세요.' },
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name); const rel = relative(ROOT, p).split('\\').join('/');
    if (IGNORE.has(name) || IGNORE.has(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if ((EXT_CODE.has(extname(name)) || EXT_STYLE.has(extname(name))) && st.size < 2_000_000) out.push(rel);
  }
  return out;
}

const warnings = [];
// 예외: 그 줄 끝 주석, 또는 바로 윗줄이 주석만 있는 줄일 때
const ALLOW = /bmr-allow:\s*\S/;
const allowed = (lines, i) => ALLOW.test(lines[i]) || (i > 0 && ALLOW.test(lines[i - 1]) && /^\s*(\/\/|\/\*|\*|<!--|\{\s*\/\*)/.test(lines[i - 1]));
const okKey = (k) => k.startsWith(`${SLUG}:`) || k.startsWith(`${SLUG}-`) || k.startsWith(`${SLUG}_`) || k.startsWith(`${SLUG}.`) || k.startsWith(`bmr-app-${SLUG}`) || k.startsWith('${');
const hostOf = (u) => { try { return new URL(u.startsWith('//') ? 'https:' + u : u).hostname.toLowerCase(); } catch { return ''; } };
const hostAllowed = (h) => ALLOW_SCRIPTS.some((a) => h === a || h.endsWith('.' + a));

function scan(rel) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  const lines = text.split(/\r?\n/);
  const ext = extname(rel);
  const isCode = EXT_CODE.has(ext), isHtml = ext === '.html' || ext === '.htm';
  const inPublic = rel.startsWith('public/');
  const viteHtml = isHtml && !inPublic; // Vite 가 빌드할 때 base 를 붙여 주는 HTML (index.html 등)
  const isStore = rel === 'src/store.js';
  const add = (rule, i, message) => { if (!allowed(lines, i)) warnings.push({ rule, file: rel, line: i + 1, message, fix: RULES[rule].fix, blocking: BLOCKING.has(rule) }); };

  lines.forEach((ln, i) => {
    if (isCode) {
      // 1) localStorage/sessionStorage.clear()
      { const mc = ln.match(/\b(localStorage|sessionStorage)\s*\.\s*clear\s*\(/); if (mc) add('storage-clear', i, `${mc[1]}.clear() 는 같은 주소를 쓰는 다른 앱의 저장값과 로그인 정보까지 모두 지웁니다.`); }
      // 2) 이름표 없는 저장 이름 (글자로 적힌 이름만, 최선 노력)
      if (!isStore) {
        for (const m of ln.matchAll(/\b(localStorage|sessionStorage)\s*\.\s*(setItem|getItem|removeItem)\s*\(\s*(['"`])([^'"`]*)\3/g)) {
          if (!okKey(m[4])) add('storage-key', i, `${m[1]}.${m[2]}('${m[4]}') — 이름에 앱 이름표가 없어 다른 앱과 겹칠 수 있습니다.`);
        }
        for (const m of ln.matchAll(/\b(localStorage|sessionStorage)\s*\[\s*(['"`])([^'"`]*)\2\s*\]/g)) {
          if (!okKey(m[3])) add('storage-key', i, `${m[1]}['${m[3]}'] — 이름에 앱 이름표가 없어 다른 앱과 겹칠 수 있습니다.`);
        }
      }
      // 3) 사이트 맨 앞('/…')을 가리키는 경로 (Vite 가 고쳐 주는 index.html 은 제외)
      if (!viteHtml) {
        const re = new RegExp(`(?:fetch\\(\\s*|\\.open\\(\\s*|\\b(?:src|href|action|to)\\s*[:=]\\s*\\{?\\s*|location(?:\\.href)?\\s*=\\s*|import\\(\\s*|url\\(\\s*)(['"\`])(\\/(?!\\/)(?!${SL}(?:\\/|['"\`?#]))[^'"\`\\s]*)\\1`, 'g');
        for (const m of ln.matchAll(re)) { if (m[2] !== '/') add('abs-path', i, `'${m[2]}' 는 apps.bmrschool.net${m[2]} 을 가리켜 다른 앱이나 허브로 갑니다.`); }
      }
      // 4) 서비스 워커 범위
      if (/serviceWorker\s*\.\s*register\s*\(/.test(ln)) {
        const from = ln.search(/serviceWorker\s*\.\s*register\s*\(/);
        let win = [ln.slice(from), ...lines.slice(i + 1, i + 4)].join('\n');
        const end = win.indexOf(');'); if (end >= 0) win = win.slice(0, end);
        if (!new RegExp(`scope\\s*:\\s*['"\`]\\/${SL}\\/`).test(win)) add('sw-scope', i, `서비스 워커 범위가 '/${SLUG}/' 로 정해져 있지 않아 다른 앱의 요청까지 가로챌 수 있습니다.`);
      }
      // 5) 외부 스크립트
      for (const m of ln.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']((?:https?:)?\/\/[^"']+)["']/gi)) {
        const h = hostOf(m[1]); if (!hostAllowed(h)) add('ext-script', i, `외부 스크립트 ${h} — 같은 주소의 모든 앱 저장값·로그인 정보를 읽을 수 있습니다.`);
      }
      for (const m of ln.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])((?:https?:)?\/\/[^'"]+)\1/g)) {
        const h = hostOf(m[2]); if (!hostAllowed(h)) add('ext-script', i, `외부 주소에서 코드를 가져옴 (${h}) — 같은 주소의 모든 앱 저장값·로그인 정보를 읽을 수 있습니다.`);
      }
      if (/createElement\(\s*['"]script['"]\s*\)/.test(ln)) add('ext-script', i, '스크립트 태그를 코드로 직접 만들고 있습니다. 외부 주소를 넣는다면 허용 목록에 있는지 확인하세요.');
    } else if (inPublic) {
      // public/ 의 CSS 는 빌드 때 경로가 고쳐지지 않음
      const re = new RegExp(`url\\(\\s*(['"]?)(\\/(?!\\/)(?!${SL}\\/)[^)'"\\s]*)\\1\\s*\\)`, 'g');
      for (const m of ln.matchAll(re)) add('abs-path', i, `'${m[2]}' 는 apps.bmrschool.net${m[2]} 을 가리켜 다른 앱이나 허브로 갑니다.`);
    }
  });
}

const files = walk(ROOT);
files.forEach(scan);
const blockOn = cfg.block_dangerous === true;
const blockers = blockOn ? warnings.filter((w) => w.blocking) : [];

// 출력: 콘솔 + GitHub 주석(::warning) + 요약(Job Summary)
console.log(`공용 주소 점검: 파일 ${files.length}개, 경고 ${warnings.length}건${blockOn ? ` (막는 규칙 켜짐: ${blockers.length}건)` : ''}`);
for (const w of warnings) {
  console.log(`- [${w.rule}] ${w.file}:${w.line} ${w.message}\n    고치는 법: ${w.fix}`);
  if (process.env.GITHUB_ACTIONS) {
    const lvl = blockers.includes(w) ? 'error' : 'warning';
    const clean = (s) => s.replace(/%/g, '%25').replace(/\r?\n/g, ' ');
    console.log(`::${lvl} file=${w.file},line=${w.line},title=${clean(RULES[w.rule].title)}::${clean(w.message + ' → ' + w.fix)}`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const sha = process.env.GITHUB_SHA || 'main', repo = process.env.GITHUB_REPOSITORY || '';
  const link = (w) => repo ? `[${w.file}:${w.line}](https://github.com/${repo}/blob/${sha}/${w.file}#L${w.line})` : `${w.file}:${w.line}`;
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  let md = `## 🛡️ 공용 주소 점검 (경고만)\n\n이 앱은 \`apps.bmrschool.net/${SLUG}/\` 에서 다른 앱들과 **한 주소를 함께** 씁니다. 아래는 다른 앱을 방해할 수 있는 코드입니다.\n\n`;
  md += warnings.length ? `경고 **${warnings.length}건**${blockOn ? ` · 막는 규칙 ${blockers.length}건` : ' · 배포는 막지 않습니다'}\n\n| 규칙 | 위치 | 내용 | 고치는 법 |\n|---|---|---|---|\n` + warnings.map((w) => `| ${RULES[w.rule].title} | ${link(w)} | ${cell(w.message)} | ${cell(w.fix)} |`).join('\n') + '\n' : '✅ 경고 없음\n';
  md += `\n예외로 두려면 그 줄이나 바로 윗줄에 \`// bmr-allow: 이유\` 를 다세요. 자세한 규칙: https://apps.bmrschool.net/guide#shared-origin\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

// 허브로 보내기: main 에 push(또는 수동 실행)일 때만, GitHub OIDC 토큰으로 (비밀값 없음). 실패해도 점검은 통과.
async function report() {
  const { ACTIONS_ID_TOKEN_REQUEST_URL: u, ACTIONS_ID_TOKEN_REQUEST_TOKEN: t, GITHUB_REF, GITHUB_EVENT_NAME } = process.env;
  if (!u || !t || !cfg.hub || GITHUB_REF !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(GITHUB_EVENT_NAME)) return;
  try {
    const r1 = await fetch(`${u}&audience=bmr-apps-hub`, { headers: { Authorization: `Bearer ${t}` } });
    const { value } = await r1.json();
    const r2 = await fetch(cfg.hub, { method: 'POST', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, files: files.length, block_dangerous: blockOn, warnings: warnings.slice(0, 200) }) });
    console.log(r2.ok ? '허브에 결과를 보냈습니다.' : `허브에 보내지 못했습니다 (HTTP ${r2.status}) — 점검 결과에는 영향 없음`);
  } catch (e) { console.log('허브에 보내지 못했습니다 — 점검 결과에는 영향 없음:', String(e?.message || e).slice(0, 200)); }
}
await report();
process.exit(blockers.length ? 1 : 0);
