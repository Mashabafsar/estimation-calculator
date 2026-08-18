import { money, pct } from '../lib/api';
import { MarginHealthBox } from './MarginHealth';

export type EstimateStatsCalc = {
  engagementFee?: number | string | null;
  recommendedPrice?: number | string | null;
  grossMarginPct?: number | string | null;
  labourRevenue?: number | string | null;
  labourCost?: number | string | null;
  directMargin?: number | string | null;
  targetMarginAmount?: number | string | null;
  directCosts?: number | string | null;
  excessDeficit?: number | string | null;
  totalHours?: number | string | null;
  sprintCount?: number | string | null;
  sprintWeeks?: number | string | null;
  paymentTerms?: string | null;
  engagementFeeSource?: 'negotiated_price' | 'labour_revenue' | string | null;
  marginHealth?: string | null;
  recommendations?: Array<{ message: string; amount?: number }> | null;
};

function num(n?: number | string | null) {
  return Number(n ?? 0);
}

function healthColor(health?: string | null) {
  const key = String(health || '').toUpperCase();
  if (key === 'GREEN') return 'text-emerald-600';
  if (key === 'YELLOW') return 'text-amber-600';
  if (key === 'RED') return 'text-rose-600';
  return '';
}

export function EstimateFinancialResults({
  calc,
  sticky = false,
}: {
  calc: EstimateStatsCalc;
  sticky?: boolean;
}) {
  const color = healthColor(calc.marginHealth);
  const fee = num(calc.engagementFee);
  const targetProfit = num(calc.targetMarginAmount) || fee * 0.5;

  return (
    <div className={`card p-4 space-y-3 ${sticky ? 'sticky top-4' : ''}`}>
      <h2 className="font-semibold">Financial Results</h2>
      <MarginHealthBox
        health={calc.marginHealth}
        marginPct={calc.grossMarginPct}
        className="mb-1"
      />

      <div className="rounded-lg border border-[var(--color-line)] overflow-hidden text-sm">
        <div className="bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Comparison
        </div>
        <div className="divide-y divide-[var(--color-line)]">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
            <div>
              <div className="text-[11px] text-[var(--color-muted)]">Engagement Fee</div>
              <div className="font-semibold">{money(fee)}</div>
            </div>
            <div className="text-[var(--color-muted)] text-xs">vs</div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--color-muted)]">Recommended @ 50%</div>
              <div className="font-semibold">{money(calc.recommendedPrice)}</div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
            <div>
              <div className="text-[11px] text-[var(--color-muted)]">Current Margin</div>
              <div className={`font-semibold ${color}`}>{pct(calc.grossMarginPct)}</div>
            </div>
            <div className="text-[var(--color-muted)] text-xs">vs</div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--color-muted)]">Target Margin</div>
              <div className="font-semibold">50%</div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
            <div>
              <div className="text-[11px] text-[var(--color-muted)]">Labour Revenue</div>
              <div className="font-semibold">{money(calc.labourRevenue)}</div>
            </div>
            <div className="text-[var(--color-muted)] text-xs">vs</div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--color-muted)]">Labour Cost</div>
              <div className="font-semibold">{money(calc.labourCost)}</div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
            <div>
              <div className="text-[11px] text-[var(--color-muted)]">Fee − Direct Costs</div>
              <div className={`font-semibold ${color}`}>{money(calc.directMargin)}</div>
            </div>
            <div className="text-[var(--color-muted)] text-xs">vs</div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--color-muted)]">Target Profit $</div>
              <div className="font-semibold">{money(targetProfit)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[var(--color-muted)] text-xs">Direct Costs</div>
          <div className="font-semibold text-lg">{money(calc.directCosts)}</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-xs">Excess / Deficit</div>
          <div className="font-semibold text-lg">{money(calc.excessDeficit)}</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-xs">Total Hours</div>
          <div className="font-semibold">{num(calc.totalHours)}</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-xs">Auto Sprints</div>
          <div className="font-semibold">
            {num(calc.sprintCount)} × {num(calc.sprintWeeks) || 2}w
          </div>
        </div>
      </div>
      <div className="text-xs text-[var(--color-muted)] border-t border-[var(--color-line)] pt-3">
        Payment Terms: {calc.paymentTerms ?? '—'} · Fee source:{' '}
        {calc.engagementFeeSource === 'negotiated_price' ? 'Negotiated Price' : 'Labour Revenue'}
      </div>
      <div className="space-y-2">
        {(calc.recommendations ?? []).map((r, i) => (
          <div key={i} className="rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs">
            {r.message}
          </div>
        ))}
      </div>
    </div>
  );
}
