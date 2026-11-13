// 중핵 수업 설계서 → Word(.docx). 원본 CoreDocx.php 와 같은 순서·내용. 인쇄 화면에서만 지연 로드.
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { maps, SRC } from './views/print';

const FONT = '맑은 고딕';
const run = (t: string, o: any = {}) => new TextRun({ text: t, font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color });
const multi = (t: string, o: any = {}) => String(t ?? '').split(/\r?\n/).map((l) => new Paragraph({ children: [run(l, o)] }));
const border = { style: BorderStyle.SINGLE, size: 6, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const cell = (w: number, paras: Paragraph[], th = false) => new TableCell({ width: { size: w, type: WidthType.DXA }, children: paras.length ? paras : [new Paragraph('')],
  shading: th ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEF5' } : undefined, margins: { top: 60, bottom: 60, left: 60, right: 60 } });
const table = (rows: TableRow[]) => new Table({ rows, borders, width: { size: 10200, type: WidthType.DXA } });
const kv = (k: string, v: string, kw = 2200) => new TableRow({ children: [cell(kw, multi(k, { bold: true }), true), cell(10200 - kw, multi(v))] });
const para = (k: string, v: string) => new Paragraph({ children: [run(k + ' ', { bold: true }), run(v)] });
const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: t, font: FONT, size: 32, bold: true, color: '1F3A5F' })] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: t, font: FONT, size: 24, bold: true, color: '1F3A5F' })] });

export function filename(title: string) { const n = title.replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').trim() || '중핵수업설계서'; return [...n].slice(0, 80).join('') + '.docx'; }

export function build(D: any): Document {
  const c = D.core, P = D.print, { vn, gn, wn } = maps(D.seed);
  const head = (cols: [string, number][], sz = 18) => new TableRow({ tableHeader: true, children: cols.map(([t, w]) => cell(w, [new Paragraph({ children: [run(t, { bold: true, size: sz })] })], true)) });
  const rcols: [string, number][] = [['R', 500], ['목표', 600], ['역량·요소', 1300], ['평가 항목', 1400], ['우수(A)', 1500], ['보통(B)', 1500], ['미흡(C)', 1500], ['평가 도구', 1000], ['교수법', 900]];
  const fcols: [string, number][] = [['4MAT', 1300], ['차시', 900], ['활동', 5400], ['교수법', 1500], ['R', 1000]];
  const std = c.standards.map((x: any) => `[${SRC[x.status || 'teacher'] ?? '직접 입력'}] ${x.code} ${x.text}${x.status === 'unverified' ? ' (원문 대조 필요)' : ''}`
    + (x.sources ?? []).filter((u: any) => /^https?:\/\//i.test(String(u.uri ?? ''))).map((u: any) => ` [${u.title || '출처'}: ${u.uri}]`).join('')).join('\n');
  const children: any[] = [
    h1('별무리 고등학교 중핵 수업 설계서'),
    table([new TableRow({ children: [cell(1500, multi('제목', { bold: true }), true), cell(4000, multi(D.title)), cell(1500, multi('교사', { bold: true }), true), cell(3200, multi(D.owner))] }),
      new TableRow({ children: [cell(1500, multi('학년', { bold: true }), true), cell(4000, multi(`${c.grade}학년 ${c.semester}학기`)), cell(1500, multi('학점·차시', { bold: true }), true), cell(3200, multi(`${c.credits}학점 · ${c.sessions}차시`))] })]),
    h2('0단계 · 정체성'), para('교육목적', '하나님 나라를 위한 책임 있는 그리스도의 제자'), para('교육목표', c.identity.goals.map((g: string) => gn[g] ?? g).join(' / ')),
    para('교사관', c.identity.teacher_view), para('학생관', c.identity.student_view),
    h2('1단계 · 바라는 결과'),
    table([kv('과목명', c.course), kv('핵심 주제', c.topic + (c.prereq.length ? ` (선수과목: ${c.prereq.join(', ')})` : '')), kv('핵심 교과', c.subject),
      kv('핵심 가치\n(평가하지 않음)', c.values.map((v: string) => `${v} — ${vn[v] ?? ''}`).join('\n')), kv('핵심 질문', c.question),
      kv('핵심 역량', c.competencies.join(', ') + (P.recommended.length ? '\n권장 평가 도구: ' + P.recommended.join(', ') : '')), kv('성취기준', std),
      ...c.goals.map((g: any, i: number) => kv(g.key, `${g.text}\n평가 대상: ${P.goalLabels[i] ?? ''}${g.extra?.length ? ` ⚠ 1개만 유지(보존: ${g.extra.join(', ')})` : ''}`))]),
    h2('2단계 · 평가 계획'), para('수행과제', `${c.task.text} (역할: ${c.task.role} · 청중: ${c.task.audience} · 산출물: ${c.task.product})`),
    table([head(rcols), ...c.rubric.map((r: any) => new TableRow({ cantSplit: true, children: [r.key, r.goal, null, r.criterion, r.A, r.B, r.C, (r.tools ?? []).join('\n'), (r.methods ?? []).join('\n')]
      .map((v, i) => cell(rcols[i][1], v === null ? [new Paragraph({ children: [run(String(r.competency), { size: 18 })] }), new Paragraph({ children: [run(String(r.element), { size: 16, color: '555555' })] })] : multi(String(v ?? ''), { size: 18 }))) }))]),
    para('평가 도구 (루브릭에서 자동 모음)', P.toolSummary || '-'),
    h2('3단계 · 수업 계획'),
    table([head(fcols, 20), ...c.flow.map((f: any) => new TableRow({ children: [cell(1300, multi(f.k)), cell(900, multi(String(f.sessions))), cell(5400, multi(f.activity)), cell(1500, multi((f.methods ?? []).join('\n'))), cell(1000, multi((f.r ?? []).join(', ')))] }))]),
    para('교수법 (4MAT·R에서 자동 모음)', P.methodSummary || '-'),
    h2('WHERETO 점검'), ...wn.map(([k, l]) => new Paragraph({ children: [run(`${c.whereto.includes(k) ? '☑ ' : '☐ '}${k} · ${l}`)] })),
  ];
  return new Document({ creator: D.owner || '별무리', title: D.title, styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
}
export async function download(D: any) {
  const blob = await Packer.toBlob(build(D));
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = filename(D.title); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
void AlignmentType;
