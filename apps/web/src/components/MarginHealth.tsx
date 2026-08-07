import clsx from 'clsx';

type Health = 'GREEN' | 'YELLOW' | 'RED' | string | null | undefined;

const STYLES: Record<string, { box: string; label: string; hint: string }> = {
  GREEN: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200',
    label: 'Healthy',
    hint: '≥ 50% margin',
  },
  YELLOW: {
    box: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200',
    label: 'Watch',
    hint: '40–50% margin',
  },
  RED: {
    box: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200',
    label: 'At risk',
    hint: '< 40% margin',
  },
};

export function marginHealthStyle(health?: Health) {
  return STYLES[String(health || '').toUpperCase()] || {
    box: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
    label: 'Unknown',
    hint: 'No calculation yet',
  };
}

/** Compact badge for tables */
export function MarginHealthBadge({ health }: { health?: Health }) {
  const style = marginHealthStyle(health);
  return (
    <span className={clsx('badge border', style.box)}>
      {String(health || '—').replaceAll('_', ' ')}
    </span>
  );
}

/** Larger status card for dashboards / estimate headers */
export function MarginHealthBox({
  health,
  marginPct,
  count,
  className,
}: {
  health?: Health;
  marginPct?: number | string | null;
  count?: number;
  className?: string;
}) {
  const style = marginHealthStyle(health);
  const key = String(health || '').toUpperCase();

  return (
    <div className={clsx('rounded-xl border-2 p-4 transition-colors', style.box, className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Margin Health
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight">
            {key || '—'} · {style.label}
          </div>
        </div>
        <span
          className={clsx(
            'mt-0.5 h-3 w-3 rounded-full shrink-0',
            key === 'GREEN' && 'bg-emerald-500',
            key === 'YELLOW' && 'bg-amber-500',
            key === 'RED' && 'bg-rose-500',
            !['GREEN', 'YELLOW', 'RED'].includes(key) && 'bg-slate-400',
          )}
        />
      </div>
      <div className="mt-2 text-sm opacity-90">
        {marginPct != null && marginPct !== '' ? (
          <span className="font-semibold">{Number(marginPct).toFixed(1)}% margin</span>
        ) : null}
        {count != null ? <span>{count} estimate{count === 1 ? '' : 's'}</span> : null}
        {marginPct == null && count == null ? style.hint : null}
        {marginPct != null || count != null ? (
          <span className="opacity-70"> · {style.hint}</span>
        ) : null}
      </div>
    </div>
  );
}

export function MarginHealthLegend({
  distribution,
}: {
  distribution: { green: number; yellow: number; red: number };
}) {
  const items = [
    { key: 'GREEN' as const, count: distribution.green },
    { key: 'YELLOW' as const, count: distribution.yellow },
    { key: 'RED' as const, count: distribution.red },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <MarginHealthBox key={item.key} health={item.key} count={item.count} />
      ))}
    </div>
  );
}
