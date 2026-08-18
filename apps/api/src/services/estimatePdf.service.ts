type AnyRec = Record<string, any>;

function n(v: unknown) {
  return Number(v ?? 0);
}

function money(v: unknown) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n(v));
}

function pct(v: unknown, digits = 1) {
  return `${n(v).toFixed(digits)}%`;
}

function pdfEscape(s: string) {
  const latin = s.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
    if (ch === '–' || ch === '—' || ch === '−') return '-';
    if (ch === '×') return 'x';
    if (ch === '·') return '|';
    return '?';
  });
  return latin.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildEstimatePdf(estimate: AnyRec): Buffer {
  const calc = estimate.calculation ?? {};
  const depts: AnyRec[] = Array.isArray(calc.departmentTotals) ? calc.departmentTotals : [];
  const sprints: AnyRec[] = Array.isArray(calc.sprintBreakdown) ? calc.sprintBreakdown : [];
  const resources: AnyRec[] = Array.isArray(estimate.resources) ? estimate.resources : [];
  const raw = (calc.rawBreakdown ?? {}) as AnyRec;
  const sprintCount = estimate.sprintCount ?? raw.sprintCount ?? calc.sprintCount ?? 0;
  const sprintWeeks = estimate.sprintWeeks ?? raw.sprintWeeks ?? calc.sprintWeeks ?? 2;
  const warrantyDays = estimate.warrantyPeriodDays ?? raw.warrantyPeriodDays ?? 0;
  const feeSource =
    n(estimate.negotiatedPrice) > 0 || raw.engagementFeeSource === 'negotiated_price'
      ? 'Negotiated Price'
      : 'Labour Revenue';
  const totalHours = n(calc.totalHours);
  const labourCost = n(calc.labourCost);
  const labourRevenue = n(calc.labourRevenue);
  const avgCost = totalHours > 0 ? labourCost / totalHours : 0;
  const avgBill = totalHours > 0 ? labourRevenue / totalHours : 0;
  const sprintPct = sprints.reduce((s, r) => s + n(r.percentage), 0);
  const sprintAmt = sprints.reduce((s, r) => s + n(r.amount), 0);
  const sprintHrs = sprints.reduce((s, r) => s + n(r.hours), 0);
  const targetProfit = n(calc.targetMarginAmount) || n(calc.engagementFee) * 0.5;

  const lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number; mono?: boolean }> = [];
  const add = (text: string, opts: { size?: number; bold?: boolean; gap?: number; mono?: boolean } = {}) => {
    lines.push({ text, ...opts });
  };

  add('Project Estimation Report', { size: 18, bold: true, gap: 6 });
  add(String(estimate.projectName || 'Untitled project'), { size: 14, bold: true, gap: 4 });
  add(
    `${estimate.estimateNumber ?? ''}  ·  ${estimate.client?.name ?? 'No client'}  ·  ${String(estimate.status || '').replaceAll('_', ' ')}  ·  v${estimate.currentVersion ?? 1}`,
    { size: 10, gap: 14 },
  );

  add('Financial Results', { size: 13, bold: true, gap: 8 });
  add(
    `Margin Health: ${String(calc.marginHealth || '—')}  ·  ${pct(calc.grossMarginPct)} margin (target 50%)`,
    { gap: 6 },
  );
  add(`Engagement Fee: ${money(calc.engagementFee)}    vs    Recommended @ 50%: ${money(calc.recommendedPrice)}`);
  add(`Current Margin: ${pct(calc.grossMarginPct)}    vs    Target Margin: 50%`);
  add(`Labour Revenue: ${money(labourRevenue)}    vs    Labour Cost: ${money(labourCost)}`);
  add(`Fee − Direct Costs: ${money(calc.directMargin)}    vs    Target Profit $: ${money(targetProfit)}`);
  add(`Direct Costs: ${money(calc.directCosts)}    ·    Excess / Deficit: ${money(calc.excessDeficit)}`);
  add(`Total Hours: ${totalHours}    ·    Auto Sprints: ${sprintCount} × ${sprintWeeks}w`);
  add(
    `Payment Terms: ${calc.paymentTerms ?? '-'}  |  Fee source: ${feeSource}  |  Warranty: ${warrantyDays} days`,
    { gap: 10 },
  );
  for (const rec of calc.recommendations ?? []) {
    if (rec?.message) add(`- ${rec.message}`, { size: 9, gap: 3 });
  }
  add('', { gap: 8 });

  add('Department Hours Totals', { size: 13, bold: true, gap: 8 });
  add(
    pad('Department', 22) +
      pad('Hours', 10, true) +
      pad('% Hours', 10, true) +
      pad('Rate Cost', 12, true) +
      pad('Rate Bill', 12, true) +
      pad('Revenue', 14, true) +
      pad('Cost', 12, true),
    { size: 8, bold: true, mono: true },
  );
  for (const d of depts) {
    add(
      pad(String(d.department || ''), 22) +
        pad(String(n(d.hours)), 10, true) +
        pad(pct(d.pctOfHours), 10, true) +
        pad(`$${n(d.hourlyCost).toFixed(2)}`, 12, true) +
        pad(`$${n(d.hourlyBilling).toFixed(2)}`, 12, true) +
        pad(money(d.totalRevenue), 14, true) +
        pad(money(d.totalCost), 12, true),
      { size: 8, mono: true },
    );
  }
  add(
    pad('Total', 22) +
      pad(String(totalHours), 10, true) +
      pad('100%', 10, true) +
      pad(`$${avgCost.toFixed(2)}`, 12, true) +
      pad(`$${avgBill.toFixed(2)}`, 12, true) +
      pad(money(labourRevenue), 14, true) +
      pad(money(labourCost), 12, true),
    { size: 8, bold: true, gap: 6, mono: true },
  );
  add(
    `Commission ${money(calc.salesCommission)}   |   COGS ${money(calc.cogs)}   |   API Rate $${n(calc.apiRate).toFixed(0)}/hr   |   Market $${n(calc.marketRate).toFixed(0)}/hr`,
    { size: 9, gap: 12 },
  );

  add('Resources', { size: 13, bold: true, gap: 8 });
  add(
    pad('Role', 28) + pad('Loc', 12) + pad('Hours', 10, true) + pad('Revenue', 14, true) + pad('Cost', 12, true),
    { size: 8, bold: true, mono: true },
  );
  for (const r of resources) {
    add(
      pad(String(r.roleName || ''), 28) +
        pad(String(r.location || ''), 12) +
        pad(String(n(r.hours)), 10, true) +
        pad(money(r.totalRevenue), 14, true) +
        pad(money(r.totalCost), 12, true),
      { size: 8, mono: true },
    );
  }
  add('', { gap: 10 });

  add(`Sprint / Milestone Breakdown (${sprintCount} sprints × ${sprintWeeks} weeks)`, {
    size: 13,
    bold: true,
    gap: 8,
  });
  add(pad('Milestone', 48) + pad('%', 10, true) + pad('Amount', 14, true) + pad('Hours', 10, true), {
    size: 8,
    bold: true,
    mono: true,
  });
  for (const s of sprints) {
    add(
      pad(String(s.name || ''), 48) +
        pad(pct(n(s.percentage) * 100), 10, true) +
        pad(money(s.amount), 14, true) +
        pad(String(n(s.hours)), 10, true),
      { size: 8, mono: true },
    );
  }
  add(
    pad('Total', 48) +
      pad(pct(sprintPct * 100), 10, true) +
      pad(money(sprintAmt), 14, true) +
      pad(String(Math.round(sprintHrs * 100) / 100), 10, true),
    { size: 8, bold: true, gap: 16, mono: true },
  );

  add(`Generated ${new Date().toLocaleString()}`, { size: 8 });

  return renderPdf(lines);
}

function pad(s: string, width: number, right = false) {
  const t = s.length > width ? s.slice(0, width - 1) + '…' : s;
  return right ? t.padStart(width, ' ') : t.padEnd(width, ' ');
}

function renderPdf(lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number; mono?: boolean }>): Buffer {
  const pageW = 612;
  const pageH = 792;
  const margin = 36;
  const pages: string[][] = [];
  let content: string[] = [];
  let y = pageH - margin;

  const startPage = () => {
    content = [];
    y = pageH - margin;
  };

  const flushPage = () => {
    pages.push(content);
  };

  startPage();
  for (const line of lines) {
    const size = line.size ?? 10;
    const gap = line.gap ?? 4;
    const font = line.mono ? (line.bold ? 'F4' : 'F3') : line.bold ? 'F2' : 'F1';
    if (y < margin + 24) {
      flushPage();
      startPage();
    }
    const text = pdfEscape(line.text);
    content.push(`BT /${font} ${size} Tf 1 0 0 1 ${margin} ${y.toFixed(2)} Tm (${text}) Tj ET`);
    y -= size + gap;
  }
  flushPage();

  const pageCount = pages.length;
  const kidsStart = 3;
  const font1Id = kidsStart + pageCount * 2;
  const font2Id = font1Id + 1;
  const font3Id = font1Id + 2;
  const font4Id = font1Id + 3;

  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjIds.push(kidsStart + i * 2);
    contentObjIds.push(kidsStart + i * 2 + 1);
  }

  const bodyObjs: string[] = [];
  bodyObjs.push('<< /Type /Catalog /Pages 2 0 R >>');
  bodyObjs.push(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  );
  for (let i = 0; i < pageCount; i++) {
    const stream = pages[i].join('\n');
    bodyObjs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R /F4 ${font4Id} 0 R >> >> /Contents ${contentObjIds[i]} 0 R >>`,
    );
    bodyObjs.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  }
  bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < bodyObjs.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${bodyObjs[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${bodyObjs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${bodyObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
