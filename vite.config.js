import { defineConfig, loadEnv } from 'vite';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 이 앱 주소: https://apps.bmrschool.net/class-designer/  (GitHub Pages)
const BASE = '/class-designer/';

// GitHub Pages 는 응답 헤더를 못 바꾸므로 보안 정책(CSP)을 meta 태그로 넣는다 (빌드할 때만).
// 다른 외부 주소(이미지, API 등)를 쓰려면 아래 목록에 그 주소를 더하세요.
const cspFor = (SB) => [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", `img-src 'self' data: blob: ${SB}`, "font-src 'self' data:",
  `connect-src 'self' ${SB} ${SB.replace('https://', 'wss://')}`, "base-uri 'self'", "form-action 'self'", "object-src 'none'", "frame-src 'none'",
].join('; ');
const csp = (CSP) => ({
  name: 'csp-meta', apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`),
});
// 한 페이지 앱(SPA): 없는 경로로 들어오면 GitHub Pages 가 404.html 을 주므로 index.html 을 복사해 둔다
const spa404 = () => ({ name: 'spa-404', apply: 'build', closeBundle() { copyFileSync(resolve('dist/index.html'), resolve('dist/404.html')); } });

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const SB = String(env.VITE_SUPABASE_URL || 'https://psupfmarnyxontorftio.supabase.co').replace(/\/$/, '');
  if (command === 'build' && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SB)) throw new Error('VITE_SUPABASE_URL 형식이 다릅니다');
  return {
    base: BASE,
    plugins: [csp(cspFor(SB)), spa404()],
    // 성취기준 3천여 건(미리보기 전용, 필요할 때만 불러오는 조각)이 커서 경고 기준만 올린다
    build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 2000 },
    server: { port: 5173 }, preview: { port: 4173 },
  };
});
