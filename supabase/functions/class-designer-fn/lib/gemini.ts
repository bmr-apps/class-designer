// Gemini 호출 (서버 함수 전용). 키는 함수 비밀값 CLASS_DESIGNER_GEMINI_API_KEY 에서만 읽는다.
// deno-lint-ignore-file no-explicit-any
import { AiKeyMissing, type AiPort, type Prompt } from './actions.ts';

const key = () => Deno.env.get('CLASS_DESIGNER_GEMINI_API_KEY') ?? '';
async function post(model: string, body: unknown, timeout: number): Promise<any> {
  const k = key(); if (!k) throw new AiKeyMissing('Gemini API 키가 설정되지 않았습니다.');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout),
  });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`AI 공급자 오류 (HTTP ${r.status}) ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return {}; }
}
const sys = (p: Prompt) => (p.system.trim() !== '' ? { systemInstruction: { parts: [{ text: p.system }] } } : {});
const text = (c: any) => (c?.content?.parts ?? []).map((x: any) => x.text ?? '').join('');

export const gemini: AiPort = {
  hasKey: () => key() !== '',
  async generate(model, p) {
    const j = await post(model, { contents: [{ role: 'user', parts: [{ text: p.user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }, ...sys(p) }, 120000);
    return [text(j.candidates?.[0]), j.usageMetadata?.promptTokenCount ?? 0, j.usageMetadata?.candidatesTokenCount ?? 0];
  },
  /** google_search 그라운딩 (성취기준 인터넷 검색) */
  async grounded(model, p) {
    const j = await post(model, { contents: [{ role: 'user', parts: [{ text: p.user }] }], tools: [{ google_search: {} }], ...sys(p) }, 90000);
    const c = j.candidates?.[0] ?? {};
    return [text(c), j.usageMetadata?.promptTokenCount ?? 0, j.usageMetadata?.candidatesTokenCount ?? 0, c.groundingMetadata ?? {}];
  },
};
