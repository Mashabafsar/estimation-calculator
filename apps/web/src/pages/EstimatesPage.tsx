import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { api, money, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MarginHealthBadge } from '../components/MarginHealth';

interface EstimateRow {
  id: string;
  estimateNumber: string;
  projectName: string;
  status: string;
  client?: { name: string } | null;
  template?: { name: string } | null;
  calculation?: {
    engagementFee: string;
    grossMarginPct: string;
    marginHealth: string;
  } | null;
  updatedAt: string;
}

const helper = createColumnHelper<EstimateRow>();

export function EstimatesPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId') || undefined;
  const [rows, setRows] = useState<EstimateRow[]>([]);

  useEffect(() => {
    const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    api<EstimateRow[]>(`/estimates${qs}`, { token }).then(setRows).catch(console.error);
  }, [token, clientId]);

  const columns = useMemo(
    () => [
      helper.accessor('estimateNumber', {
        header: 'ID',
        cell: (info) => (
          <Link className="text-[var(--color-accent)] font-medium" to={`/estimates/${info.row.original.id}`}>
            {info.getValue()}
          </Link>
        ),
      }),
      helper.accessor('projectName', { header: 'Project' }),
      helper.accessor((r) => r.client?.name ?? '—', { id: 'client', header: 'Client' }),
      helper.accessor((r) => r.template?.name ?? '—', { id: 'template', header: 'Type' }),
      helper.accessor('status', {
        header: 'Status',
        cell: (info) => <span className="badge bg-slate-100 dark:bg-slate-800">{info.getValue().replaceAll('_', ' ')}</span>,
      }),
      helper.accessor((r) => Number(r.calculation?.engagementFee ?? 0), {
        id: 'fee',
        header: 'Fee',
        cell: (info) => money(info.getValue()),
      }),
      helper.accessor((r) => Number(r.calculation?.grossMarginPct ?? 0), {
        id: 'margin',
        header: 'Margin',
        cell: (info) => (
          <span className="inline-flex items-center gap-2">
            <MarginHealthBadge health={info.row.original.calculation?.marginHealth} />
            <span className="text-xs text-[var(--color-muted)]">{pct(info.getValue())}</span>
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estimates</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {clientId
              ? 'Filtered by client — create, review, and approve project estimates.'
              : 'Create, review, and approve project estimates.'}
          </p>
        </div>
        <Link to="/estimates/new" className="btn btn-primary">
          <Plus size={16} /> New Estimate
        </Link>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-canvas)] text-left text-[var(--color-muted)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 font-medium">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-line)]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  No estimates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
