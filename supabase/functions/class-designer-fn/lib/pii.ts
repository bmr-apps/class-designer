// Pii.php 포팅: 학생 개인정보로 보이는 패턴
export const PII_PATTERNS: [string, RegExp][] = [
  ['휴대전화 번호', /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/gu],
  ['전화번호', /\b0\d{1,2}-\d{3,4}-\d{4}\b/gu],
  ['주민등록번호', /\d{6}\s?-\s?[1-4]\d{6}/gu],
  ['이메일 주소', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu],
  ['학번+이름', /(?<!\d)\d{5}\s?[가-힣]{2,4}(?![가-힣])/gu],
  ['이름 + 학생', /(?<![가-힣])[김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{1,2}\s?(학생|군|양)(?![가-힣])/gu],
];
export function piiScan(text: string): { type: string; text: string }[] {
  const found: { type: string; text: string }[] = [];
  for (const [label, re] of PII_PATTERNS) for (const m of text.matchAll(re)) found.push({ type: label, text: m[0] });
  return found;
}
