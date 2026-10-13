import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loader';
import {
  copyEmailSignatureHtml,
  formFromSavedSignature,
  type SavedSignature,
} from '../lib/signatures';

export function SignaturesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRows(await api<SavedSignature[]>('/signatures', { token }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [token]);

  async function onDelete(id: string) {
    if (!confirm('Delete this signature?')) return;
    await api(`/signatures/${id}`, { method: 'DELETE', token });
    await load();
  }

  async function copyForEmail(row: SavedSignature) {
    setBusyId(row.id);
    setMessage('');
    try {
      const preview = await api<{ html: string; shareUrl: string }>('/signatures/preview', {
        method: 'POST',
        token,
        body: JSON.stringify({ ...formFromSavedSignature(row), shareSlug: row.shareSlug }),
      });
      const mode = await copyEmailSignatureHtml(preview.html);
      setMessage(
        mode === 'rich'
          ? `Copied ${row.firstName} ${row.lastName} for email.`
          : 'Copied as plain text. Try again, or open Edit and use Copy HTML code.',
      );
    } catch (err: any) {
      setMessage(err?.message || 'Failed to copy email signature');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">E-Signature</h1>
          <p className="page-subtitle">
            Manage HiHello-style email signature cards, share links, and copy for email.
          </p>
        </div>
        <Link to="/signatures/new" className="btn btn-primary">
          <Plus size={16} /> New signature
        </Link>
      </div>

      {message ? <p className="text-sm text-[var(--color-accent)]">{message}</p> : null}

      {loading ? (
        <PageLoader label="Loading signatures…" />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <p className="text-sm text-[var(--color-muted)]">No signatures saved yet.</p>
          <Link to="/signatures/new" className="btn btn-primary inline-flex">
            <Plus size={16} /> Create your first signature
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-canvas)] text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Share</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {row.photoUrl ? (
                        <img
                          src={row.photoUrl}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-[#2437ff] text-white grid place-items-center text-[11px] font-bold">
                          {(row.firstName[0] || 'A').toUpperCase()}
                          {(row.lastName[0] || '').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          className="font-medium text-[var(--color-accent)] hover:underline"
                          to={`/signatures/${row.id}/edit`}
                        >
                          {row.firstName} {row.lastName}
                        </Link>
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {row.companyName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.jobTitle}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{row.email || '—'}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-[var(--color-accent)] hover:underline"
                      to={row.sharePath}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /s/{row.shareSlug}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Copy for email"
                        disabled={busyId === row.id}
                        onClick={() => copyForEmail(row)}
                      >
                        <Mail size={14} />
                      </button>
                      <Link
                        className="btn btn-ghost"
                        to={`/signatures/${row.id}/edit`}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Link>
                      <a
                        className="btn btn-ghost"
                        href={row.sharePath}
                        target="_blank"
                        rel="noreferrer"
                        title="Open card"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Delete"
                        onClick={() => onDelete(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
