type AnyRec = Record<string, any>;

/** Brand palette (matches web UI) */
const C = {
  accent: [0.302, 0.443, 0.984] as RGB, // #4D71FB
  cyan: [0.141, 0.835, 0.965] as RGB, // #24D5F6
  purple: [0.522, 0.396, 0.988] as RGB, // #8565FC
  ink: [0.11, 0.11, 0.11] as RGB, // #1c1c1c
  muted: [0.42, 0.447, 0.502] as RGB, // #6b7280
  line: [0.91, 0.91, 0.91] as RGB, // #e8e8e8
  canvas: [0.965, 0.965, 0.965] as RGB, // #f6f6f6
  panel: [1, 1, 1] as RGB,
  ok: [0.016, 0.471, 0.341] as RGB, // #047857
  warn: [0.706, 0.325, 0.035] as RGB, // #b45309
  danger: [0.745, 0.071, 0.235] as RGB, // #be123c
  soft: [0.933, 0.949, 1] as RGB, // #eef2ff
  headerBg: [0.18, 0.22, 0.45] as RGB,
};

type RGB = [number, number, number];

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
  const latin = String(s ?? '').replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
    if (ch === '–' || ch === '—' || ch === '−') return '-';
    if (ch === '×') return 'x';
    if (ch === '·') return '|';
    if (ch === '★') return '*';
    return '?';
  });
  return latin.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function healthRgb(health?: string | null): RGB {
  const key = String(health || '').toUpperCase();
  if (key === 'GREEN') return C.ok;
  if (key === 'YELLOW') return C.warn;
  if (key === 'RED') return C.danger;
  return C.muted;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '...';
}

class PdfDoc {
  readonly pageW = 612;
  readonly pageH = 792;
  readonly margin = 36;
  private pages: string[][] = [];
  private content: string[] = [];
  y = 0;

  constructor() {
    this.startPage();
  }

  get contentW() {
    return this.pageW - this.margin * 2;
  }

  private startPage() {
    this.content = [];
    this.y = this.pageH - this.margin;
    // Soft page background
    this.fillRect(0, 0, this.pageW, this.pageH, C.canvas);
  }

  private flushPage() {
    this.pages.push(this.content);
  }

  ensureSpace(needed: number) {
    if (this.y - needed < this.margin + 28) {
      this.drawFooter();
      this.flushPage();
      this.startPage();
      this.y = this.pageH - this.margin - 8;
    }
  }

  fillRect(x: number, y: number, w: number, h: number, rgb: RGB) {
    const [r, g, b] = rgb;
    this.content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    this.content.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  strokeRect(x: number, y: number, w: number, h: number, rgb: RGB, width = 1) {
    const [r, g, b] = rgb;
    this.content.push(`${width.toFixed(2)} w`);
    this.content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    this.content.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  /** Rounded-ish card via fill + border (true curves omitted for Type1 simplicity). */
  card(x: number, y: number, w: number, h: number, fill: RGB = C.panel) {
    this.fillRect(x, y, w, h, fill);
    this.strokeRect(x, y, w, h, C.line, 0.8);
  }

  text(
    str: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {},
  ) {
    const size = opts.size ?? 10;
    const bold = opts.bold ?? false;
    const color = opts.color ?? C.ink;
    const font = bold ? 'F2' : 'F1';
    let t = String(str ?? '');
    if (opts.maxWidth) {
      const avg = size * (opts.align === 'right' ? 0.55 : 0.5);
      const maxChars = Math.floor(opts.maxWidth / avg);
      t = truncate(t, Math.max(4, maxChars));
    }
    let drawX = x;
    const avgChar = size * (/\d/.test(t) ? 0.55 : 0.5);
    const approxW = t.length * avgChar;
    if (opts.align === 'right') drawX = x - approxW;
    if (opts.align === 'center') drawX = x - approxW / 2;
    const [r, g, b] = color;
    this.content.push(
      `BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(t)}) Tj ET`,
    );
  }

  /** Measure-ish right-aligned text that uses end-x as the right edge. */
  textRight(str: string, rightX: number, y: number, opts: { size?: number; bold?: boolean; color?: RGB } = {}) {
    this.text(str, rightX, y, { ...opts, align: 'right' });
  }

  forceNewPage() {
    this.drawFooter();
    this.flushPage();
    this.startPage();
    this.y = this.pageH - this.margin - 8;
  }

  drawFooter() {
    const y = 18;
    this.fillRect(0, 0, this.pageW, 28, C.panel);
    this.fillRect(0, 28, this.pageW, 2, C.accent);
    this.text('Agency Partner | Project Estimation', this.margin, y, {
      size: 7,
      color: C.muted,
    });
    this.textRight(`Page ${this.pages.length + 1}`, this.pageW - this.margin, y, {
      size: 7,
      color: C.muted,
    });
  }

  finish(): Buffer {
    this.drawFooter();
    this.flushPage();

    const pageCount = this.pages.length;
    const kidsStart = 3;
    const font1Id = kidsStart + pageCount * 2;
    const font2Id = font1Id + 1;

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
      const stream = this.pages[i].join('\n');
      bodyObjs.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageW} ${this.pageH}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> /Contents ${contentObjIds[i]} 0 R >>`,
      );
      bodyObjs.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    }
    bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    bodyObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

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
}

type Col = { key: string; label: string; width: number; align?: 'left' | 'right'; bold?: boolean };

function drawTable(
  doc: PdfDoc,
  x: number,
  title: string,
  columns: Col[],
  rows: Array<Record<string, string>>,
  opts?: { footer?: Record<string, string>; subtitle?: string },
) {
  const rowH = 18;
  const headerH = 22;
  const titleH = opts?.subtitle ? 40 : 28;
  const tableW = columns.reduce((s, c) => s + c.width, 0);

  const drawHeaderBlock = (top: number, includeTitle: boolean) => {
    const h = includeTitle ? titleH + headerH : headerH;
    doc.fillRect(x, top - h, tableW, h, C.panel);
    if (includeTitle) {
      doc.fillRect(x, top - 3, tableW, 3, C.accent);
      doc.text(title, x + 12, top - 18, { size: 11, bold: true, color: C.ink });
      if (opts?.subtitle) {
        doc.text(opts.subtitle, x + 12, top - 32, {
          size: 8,
          color: C.muted,
          maxWidth: tableW - 24,
        });
      }
    }
    const hy = includeTitle ? top - titleH : top;
    doc.fillRect(x, hy - headerH, tableW, headerH, C.canvas);
    let cx = x;
    for (const col of columns) {
      const tx = col.align === 'right' ? cx + col.width - 8 : cx + 8;
      doc.text(col.label, tx, hy - 14, {
        size: 7.5,
        bold: true,
        color: C.muted,
        align: col.align === 'right' ? 'right' : 'left',
        maxWidth: col.width - 12,
      });
      cx += col.width;
    }
    doc.strokeRect(x, top - h, tableW, h + 0.01, C.line, 0.8);
    return hy - headerH;
  };

  const drawRow = (y: number, row: Record<string, string>, alt: boolean, bold = false) => {
    if (alt) doc.fillRect(x, y - rowH, tableW, rowH, C.soft);
    else doc.fillRect(x, y - rowH, tableW, rowH, C.panel);
    doc.fillRect(x, y - 0.5, tableW, 0.5, C.line);
    let cx = x;
    for (const col of columns) {
      const val = row[col.key] ?? '';
      const tx = col.align === 'right' ? cx + col.width - 8 : cx + 8;
      doc.text(val, tx, y - 12, {
        size: 8,
        bold: bold || Boolean(col.bold),
        color: C.ink,
        align: col.align === 'right' ? 'right' : 'left',
        maxWidth: col.width - 12,
      });
      cx += col.width;
    }
    doc.strokeRect(x, y - rowH, tableW, rowH, C.line, 0.5);
    return y - rowH;
  };

  doc.ensureSpace(titleH + headerH + rowH * 2);
  let y = drawHeaderBlock(doc.y, true);

  rows.forEach((row, i) => {
    if (y - rowH < doc.margin + 40) {
      doc.forceNewPage();
      y = drawHeaderBlock(doc.y, false);
    }
    y = drawRow(y, row, i % 2 === 1);
  });

  if (opts?.footer) {
    if (y - rowH < doc.margin + 40) {
      doc.forceNewPage();
      y = drawHeaderBlock(doc.y, false);
    }
    y = drawRow(y, opts.footer, false, true);
  }

  doc.y = y - 14;
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
  const health = String(calc.marginHealth || '');
  const hColor = healthRgb(health);

  const doc = new PdfDoc();
  const x = doc.margin;
  const w = doc.contentW;

  // ── Hero header ──────────────────────────────────────────────
  const headerH = 86;
  doc.fillRect(0, doc.pageH - headerH, doc.pageW, headerH, C.headerBg);
  doc.fillRect(0, doc.pageH - 6, doc.pageW, 6, C.accent);
  doc.fillRect(0, doc.pageH - headerH, 6, headerH, C.cyan);

  // Brand mark (two overlapping triangles approximated as rects/triangles via paths)
  // Simple diamond mark
  const mx = x + 8;
  const my = doc.pageH - 48;
  doc.fillRect(mx, my, 14, 14, C.accent);
  doc.fillRect(mx + 10, my - 8, 14, 14, C.cyan);

  doc.text('AGENCY PARTNER', x + 40, doc.pageH - 28, {
    size: 8,
    bold: true,
    color: C.cyan,
  });
  doc.text(String(estimate.projectName || 'Untitled project'), x + 40, doc.pageH - 48, {
    size: 18,
    bold: true,
    color: C.panel,
    maxWidth: w - 160,
  });
  doc.text(
    `${estimate.estimateNumber ?? ''}  |  ${estimate.client?.name ?? 'No client'}  |  v${estimate.currentVersion ?? 1}`,
    x + 40,
    doc.pageH - 66,
    { size: 9, color: [0.75, 0.8, 0.95] },
  );

  // Status pill on the right
  const status = String(estimate.status || '').replaceAll('_', ' ');
  doc.fillRect(doc.pageW - doc.margin - 110, doc.pageH - 52, 110, 24, C.accent);
  doc.text(status || 'DRAFT', doc.pageW - doc.margin - 55, doc.pageH - 44, {
    size: 8,
    bold: true,
    color: C.panel,
    align: 'center',
  });

  doc.y = doc.pageH - headerH - 16;

  // ── KPI cards ────────────────────────────────────────────────
  const kpiH = 54;
  const gap = 10;
  const kpiW = (w - gap * 2) / 3;
  doc.ensureSpace(kpiH + 20);
  const kpiY = doc.y - kpiH;
  const kpis = [
    { label: 'Status', value: status || '—', accent: C.accent },
    { label: 'Negotiated Price', value: money(estimate.negotiatedPrice), accent: C.purple },
    { label: 'Warranty Period', value: `${warrantyDays} days`, accent: C.cyan },
  ];
  kpis.forEach((k, i) => {
    const kx = x + i * (kpiW + gap);
    doc.card(kx, kpiY, kpiW, kpiH);
    doc.fillRect(kx, kpiY + kpiH - 3, kpiW, 3, k.accent);
    doc.text(k.label, kx + 12, kpiY + kpiH - 18, { size: 8, color: C.muted });
    doc.text(k.value, kx + 12, kpiY + 14, { size: 13, bold: true, color: C.ink, maxWidth: kpiW - 20 });
  });
  doc.y = kpiY - 16;

  // ── Financial Results ────────────────────────────────────────
  const fee = n(calc.engagementFee);
  const comparisons: Array<{ leftLabel: string; left: string; rightLabel: string; right: string; leftColor?: RGB }> = [
    {
      leftLabel: 'Engagement Fee',
      left: money(fee),
      rightLabel: 'Recommended @ 50%',
      right: money(calc.recommendedPrice),
    },
    {
      leftLabel: 'Current Margin',
      left: pct(calc.grossMarginPct),
      rightLabel: 'Target Margin',
      right: '50%',
      leftColor: hColor,
    },
    {
      leftLabel: 'Labour Revenue',
      left: money(labourRevenue),
      rightLabel: 'Labour Cost',
      right: money(labourCost),
    },
    {
      leftLabel: 'Fee - Direct Costs',
      left: money(calc.directMargin),
      rightLabel: 'Target Profit $',
      right: money(targetProfit),
      leftColor: hColor,
    },
  ];

  const finH =
    28 + // title
    36 + // health
    18 + // comparison header
    comparisons.length * 36 +
    70 + // metrics grid
    28; // footer meta

  doc.ensureSpace(finH);
  const finTop = doc.y;
  const finBottom = finTop - finH;
  doc.card(x, finBottom, w, finH);
  doc.fillRect(x, finTop - 3, w, 3, C.purple);
  doc.text('Financial Results', x + 14, finTop - 20, { size: 12, bold: true });

  // Margin health badge
  const badgeW = 200;
  doc.fillRect(x + 14, finTop - 58, badgeW, 28, C.soft);
  doc.fillRect(x + 14, finTop - 58, 4, 28, hColor);
  doc.text(`Margin Health: ${health || '—'}`, x + 26, finTop - 40, {
    size: 10,
    bold: true,
    color: hColor,
  });
  doc.text(`${pct(calc.grossMarginPct)} margin (target 50%)`, x + 26 + badgeW + 8, finTop - 40, {
    size: 9,
    color: C.muted,
  });

  let cy = finTop - 72;
  doc.fillRect(x + 14, cy - 14, w - 28, 18, C.canvas);
  doc.text('COMPARISON', x + 22, cy - 8, { size: 7.5, bold: true, color: C.muted });
  cy -= 20;

  for (const row of comparisons) {
    doc.fillRect(x + 14, cy - 32, w - 28, 0.6, C.line);
    doc.text(row.leftLabel, x + 22, cy - 8, { size: 7.5, color: C.muted });
    doc.text(row.left, x + 22, cy - 22, { size: 11, bold: true, color: row.leftColor ?? C.ink });
    doc.text('vs', x + w / 2, cy - 16, { size: 8, color: C.muted, align: 'center' });
    doc.text(row.rightLabel, x + w - 22, cy - 8, {
      size: 7.5,
      color: C.muted,
      align: 'right',
    });
    doc.text(row.right, x + w - 22, cy - 22, { size: 11, bold: true, align: 'right' });
    cy -= 36;
  }

  // Metric tiles
  const metrics = [
    { label: 'Direct Costs', value: money(calc.directCosts) },
    { label: 'Excess / Deficit', value: money(calc.excessDeficit) },
    { label: 'Total Hours', value: String(totalHours) },
    { label: 'Auto Sprints', value: `${sprintCount} x ${sprintWeeks}w` },
  ];
  const mw = (w - 28 - 9 * 3) / 4;
  metrics.forEach((m, i) => {
    const mx = x + 14 + i * (mw + 9);
    doc.fillRect(mx, cy - 48, mw, 44, C.canvas);
    doc.text(m.label, mx + 8, cy - 14, { size: 7, color: C.muted, maxWidth: mw - 12 });
    doc.text(m.value, mx + 8, cy - 34, { size: 11, bold: true, maxWidth: mw - 12 });
  });
  cy -= 58;

  doc.text(
    `Payment Terms: ${calc.paymentTerms ?? '-'}  |  Fee source: ${feeSource}  |  Warranty: ${warrantyDays} days`,
    x + 14,
    cy - 4,
    { size: 8, color: C.muted, maxWidth: w - 28 },
  );

  doc.y = finBottom - 12;

  // Recommendations
  const recs = (calc.recommendations ?? []).filter((r: AnyRec) => r?.message);
  if (recs.length) {
    const rh = 28 + recs.length * 24;
    doc.ensureSpace(rh);
    const rt = doc.y;
    doc.card(x, rt - rh, w, rh);
    doc.fillRect(x, rt - 3, w, 3, C.cyan);
    doc.text('Recommendations', x + 14, rt - 18, { size: 11, bold: true });
    recs.forEach((r: AnyRec, i: number) => {
      doc.fillRect(x + 12, rt - 42 - i * 24, w - 24, 20, C.soft);
      doc.fillRect(x + 12, rt - 42 - i * 24, 3, 20, C.accent);
      doc.text(String(r.message), x + 22, rt - 35 - i * 24, {
        size: 8,
        color: C.ink,
        maxWidth: w - 44,
      });
    });
    doc.y = rt - rh - 12;
  }

  // ── Resources ────────────────────────────────────────────────
  drawTable(
    doc,
    x,
    'Resources',
    [
      { key: 'role', label: 'Role', width: 170 },
      { key: 'loc', label: 'Loc', width: 70 },
      { key: 'hrs', label: 'Hrs', width: 55, align: 'right' },
      { key: 'people', label: 'People', width: 55, align: 'right' },
      { key: 'rev', label: 'Revenue', width: 95, align: 'right' },
      { key: 'cost', label: 'Cost', width: 95, align: 'right' },
    ],
    resources.map((r) => ({
      role: String(r.roleName || ''),
      loc: String(r.location || ''),
      hrs: String(n(r.hours)),
      people: String(n(r.resourceCount ?? 1)),
      rev: money(r.totalRevenue),
      cost: money(r.totalCost),
    })),
  );

  // ── Department totals ────────────────────────────────────────
  if (depts.length) {
    drawTable(
      doc,
      x,
      'Department Hours Totals',
      [
        { key: 'dept', label: 'Department', width: 110 },
        { key: 'hrs', label: 'Hours', width: 48, align: 'right' },
        { key: 'people', label: 'People', width: 42, align: 'right' },
        { key: 'eff', label: 'Eff.', width: 42, align: 'right' },
        { key: 'pct', label: '% Hrs', width: 42, align: 'right' },
        { key: 'rcost', label: 'Rate Cost', width: 58, align: 'right' },
        { key: 'rbill', label: 'Rate Bill', width: 58, align: 'right' },
        { key: 'rev', label: 'Revenue', width: 70, align: 'right' },
        { key: 'cost', label: 'Cost', width: 70, align: 'right' },
      ],
      depts.map((d) => ({
        dept: String(d.department || ''),
        hrs: String(n(d.hours)),
        people: String(n(d.resourceCount ?? 1)),
        eff: String(n(d.effectiveHours ?? d.hours)),
        pct: pct(d.pctOfHours),
        rcost: `$${n(d.hourlyCost).toFixed(2)}`,
        rbill: `$${n(d.hourlyBilling).toFixed(2)}`,
        rev: money(d.totalRevenue),
        cost: money(d.totalCost),
      })),
      {
        footer: {
          dept: 'Total',
          hrs: String(totalHours),
          people: '',
          eff: '',
          pct: '100%',
          rcost: `$${avgCost.toFixed(2)}`,
          rbill: `$${avgBill.toFixed(2)}`,
          rev: money(labourRevenue),
          cost: money(labourCost),
        },
        subtitle: `Commission ${money(calc.salesCommission)}  |  COGS ${money(calc.cogs)}  |  API $${n(calc.apiRate).toFixed(0)}/hr  |  Market $${n(calc.marketRate).toFixed(0)}/hr`,
      },
    );
  }

  // ── Sprint breakdown ─────────────────────────────────────────
  if (sprints.length) {
    const totalOk = Math.abs(sprintPct - 1) < 0.001;
    drawTable(
      doc,
      x,
      'Sprint / Milestone Breakdown',
      [
        { key: 'name', label: 'Milestone', width: 300 },
        { key: 'pct', label: '%', width: 70, align: 'right' },
        { key: 'amt', label: 'Amount', width: 100, align: 'right' },
        { key: 'hrs', label: 'Hours', width: 70, align: 'right' },
      ],
      sprints.map((s) => ({
        name: String(s.name || ''),
        pct: pct(n(s.percentage) * 100),
        amt: money(s.amount),
        hrs: String(n(s.hours)),
      })),
      {
        footer: {
          name: 'Total',
          pct: pct(sprintPct * 100),
          amt: money(sprintAmt),
          hrs: String(Math.round(sprintHrs * 100) / 100),
        },
        subtitle: `${sprintCount} sprints x ${sprintWeeks} weeks  |  Plan total ${pct(sprintPct * 100)}${totalOk ? '' : ' (should be 100%)'}`,
      },
    );
  }

  doc.ensureSpace(24);
  doc.text(`Generated ${new Date().toLocaleString()}`, x, doc.y - 8, {
    size: 8,
    color: C.muted,
  });
  doc.y -= 20;

  return doc.finish();
}
