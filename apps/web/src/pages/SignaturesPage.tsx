import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, ImagePlus, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SignatureCard } from '../components/SignatureCard';
import {
  EMPTY_SIGNATURE,
  copyEmailSignatureHtml,
  readImageFile,
  type SavedSignature,
  type SignatureForm,
} from '../lib/signatures';

function formFromRow(row: SavedSignature): SignatureForm {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    photoUrl: row.photoUrl || '',
    logoUrl: row.logoUrl || '',
    directLine: row.directLine,
    cellPhone: row.cellPhone,
    email: row.email,
    facebook: row.facebook,
    instagram: row.instagram,
    linkedin: row.linkedin,
    youtube: row.youtube,
    twitter: row.twitter,
    website2: row.website2 || '',
    customLinkLabel: row.customLinkLabel || 'Join our Facebook Group',
    customLinkUrl: row.customLinkUrl || '',
    companyName: row.companyName,
    companyUrl: row.companyUrl,
    companyStreet: row.companyStreet,
    companyCity: row.companyCity,
    companyRegion: row.companyRegion,
    companyPostal: row.companyPostal,
    tagline: row.tagline,
  };
}

function ImageField({
  label,
  value,
  onChange,
  onClear,
  variant = 'photo',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  variant?: 'photo' | 'logo';
}) {
  const isLogo = variant === 'logo';

  return (
    <div className="space-y-2 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={
            isLogo
              ? 'relative h-16 w-16 shrink-0'
              : 'h-16 w-16 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] grid place-items-center'
          }
        >
          {isLogo ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(from 210deg, #16a34a 0%, #4ade80 24%, #2437ff 55%, #93c5fd 78%, #16a34a 100%)',
                }}
              />
              <div className="absolute inset-[3px] rounded-full bg-white grid place-items-center overflow-hidden p-1.5">
                {value ? (
                  <img src={value} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus size={18} className="text-[#2437ff]" />
                )}
              </div>
            </>
          ) : value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={18} className="text-[var(--color-muted)]" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="input"
            placeholder="Image URL (https://...)"
            value={value.startsWith('data:') ? '' : value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex gap-2">
            <label className="btn btn-ghost cursor-pointer">
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    onChange(await readImageFile(file));
                  } catch (err: any) {
                    alert(err?.message || 'Upload failed');
                  }
                }}
              />
            </label>
            {value ? (
              <button type="button" className="btn btn-ghost" onClick={onClear}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignaturesPage() {
  const { token } = useAuth();
  const [form, setForm] = useState<SignatureForm>(EMPTY_SIGNATURE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [html, setHtml] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareSlug, setShareSlug] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  async function load() {
    const rows = await api<SavedSignature[]>('/signatures', { token });
    setSaved(rows);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [token]);

  const previewShare = useMemo(() => (shareUrl ? shareUrl : undefined), [shareUrl]);

  // Keep email HTML in sync with the form so Copy matches what you see
  useEffect(() => {
    if (!token || !form.firstName || !form.lastName || !form.jobTitle) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchSignatureHtml({ ...form, shareSlug: shareSlug || undefined })
        .then((preview) => {
          if (cancelled) return;
          setHtml(preview.html);
          if (preview.shareUrl) setShareUrl(preview.shareUrl);
        })
        .catch(() => {
          /* ignore preview errors while typing */
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, form, shareSlug]);

  function update<K extends keyof SignatureForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(row: SavedSignature) {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setShareUrl(`${window.location.origin}${row.sharePath}`);
    setShareSlug(row.shareSlug);
    setHtml('');
    setMessage('');
    setCopyState('idle');
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_SIGNATURE);
    setHtml('');
    setShareUrl('');
    setShareSlug('');
    setMessage('');
    setCopyState('idle');
  }

  async function fetchSignatureHtml(payload: SignatureForm & { shareSlug?: string }) {
    return api<{ html: string; shareUrl: string }>('/signatures/preview', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    });
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const path = editingId ? `/signatures/${editingId}` : '/signatures';
      const method = editingId ? 'PUT' : 'POST';
      const result = await api<SavedSignature & { html: string; shareUrl: string }>(path, {
        method,
        token,
        body: JSON.stringify(form),
      });
      setHtml(result.html || '');
      setShareUrl(result.shareUrl || `${window.location.origin}${result.sharePath}`);
      setShareSlug(result.shareSlug);
      setEditingId(result.id);
      setMessage(editingId ? 'Signature updated and saved.' : 'Signature saved. Share link ready.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save signature');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this signature?')) return;
    await api(`/signatures/${id}`, { method: 'DELETE', token });
    if (editingId === id) resetForm();
    await load();
  }

  async function copyForEmail(fromForm = true, row?: SavedSignature) {
    setBusy(true);
    setMessage('');
    try {
      let nextHtml = html;
      if (fromForm || !nextHtml) {
        const payload = row
          ? { ...formFromRow(row), shareSlug: row.shareSlug }
          : { ...form, shareSlug: shareSlug || undefined };
        const preview = await fetchSignatureHtml(payload);
        nextHtml = preview.html;
        setHtml(preview.html);
        if (!row) setShareUrl(preview.shareUrl);
      }
      const mode = await copyEmailSignatureHtml(nextHtml);
      setCopyState('copied');
      setMessage(
        mode === 'rich'
          ? 'Copied the email signature preview — paste with Cmd/Ctrl+V into a rich-text compose window.'
          : 'Copied as plain text. Try Copy for email again, or use Copy HTML code.',
      );
      window.setTimeout(() => setCopyState('idle'), 2500);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to copy email signature');
    } finally {
      setBusy(false);
    }
  }

  async function copyHtmlCode() {
    try {
      let nextHtml = html;
      if (!nextHtml) {
        const preview = await fetchSignatureHtml({ ...form, shareSlug: shareSlug || undefined });
        nextHtml = preview.html;
        setHtml(preview.html);
      }
      await navigator.clipboard.writeText(nextHtml);
      setMessage('HTML source copied.');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to copy HTML');
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setMessage('Share link copied.');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">E-Signature</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Add photo + logo, preview a HiHello-style card, save to DB, and share.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={resetForm}>
          <Plus size={14} /> New
        </button>
      </div>

      <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-4 items-start">
        <form onSubmit={onSave} className="card p-4 space-y-5">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Media
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <ImageField
                label="Profile photo"
                value={form.photoUrl}
                onChange={(v) => update('photoUrl', v)}
                onClear={() => update('photoUrl', '')}
              />
              <ImageField
                label="Company logo"
                variant="logo"
                value={form.logoUrl}
                onChange={(v) => update('logoUrl', v)}
                onClear={() => update('logoUrl', '')}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Profile
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['firstName', 'First name'],
                  ['lastName', 'Last name'],
                  ['jobTitle', 'Job title'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span className="text-[var(--color-muted)]">{label}</span>
                  <input
                    className="input"
                    required
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Contact
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['directLine', 'Direct line / office'],
                  ['cellPhone', 'Cell phone / mobile'],
                  ['email', 'Email'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span className="text-[var(--color-muted)]">{label}</span>
                  <input
                    className="input"
                    type={key === 'email' ? 'email' : 'text'}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Links (shown on card)
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-[var(--color-muted)]">Website 1</span>
                <input
                  className="input"
                  value={form.companyUrl}
                  onChange={(e) => update('companyUrl', e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--color-muted)]">Website 2</span>
                <input
                  className="input"
                  placeholder="kungfu.kids"
                  value={form.website2}
                  onChange={(e) => update('website2', e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--color-muted)]">Custom link label</span>
                <input
                  className="input"
                  placeholder="Join our Facebook Group"
                  value={form.customLinkLabel}
                  onChange={(e) => update('customLinkLabel', e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--color-muted)]">Custom link URL</span>
                <input
                  className="input"
                  placeholder="https://facebook.com/groups/..."
                  value={form.customLinkUrl}
                  onChange={(e) => update('customLinkUrl', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Social icons
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['facebook', 'Facebook'],
                  ['instagram', 'Instagram'],
                  ['linkedin', 'LinkedIn'],
                  ['youtube', 'YouTube'],
                  ['twitter', 'Twitter / X'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span className="text-[var(--color-muted)]">{label}</span>
                  <input
                    className="input"
                    placeholder="URL or username"
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Company / address
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['companyName', 'Company name'],
                  ['companyStreet', 'Street'],
                  ['companyCity', 'City'],
                  ['companyRegion', 'Region'],
                  ['companyPostal', 'Postal'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span className="text-[var(--color-muted)]">{label}</span>
                  <input
                    className="input"
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-[var(--color-muted)]">Tagline</span>
                <input
                  className="input"
                  value={form.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Update & save' : 'Save signature'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || !form.firstName || !form.lastName || !form.jobTitle}
              onClick={() => copyForEmail(true)}
            >
              {copyState === 'copied' ? <Check size={14} /> : <Mail size={14} />}
              {copyState === 'copied' ? 'Copied!' : 'Copy for email signature'}
            </button>
            {shareUrl ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={copyShare}>
                  <Copy size={14} /> Copy share link
                </button>
                <a className="btn btn-ghost" href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open card
                </a>
              </>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || !form.firstName || !form.lastName || !form.jobTitle}
              onClick={copyHtmlCode}
            >
              <Copy size={14} /> Copy HTML code
            </button>
          </div>
          {message ? <p className="text-sm text-[var(--color-accent)]">{message}</p> : null}
          {shareUrl ? (
            <p className="text-xs text-[var(--color-muted)] break-all">Share URL: {shareUrl}</p>
          ) : null}
        </form>

        <div className="space-y-4 xl:sticky xl:top-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Preview</h2>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !form.firstName || !form.lastName || !form.jobTitle}
                onClick={() => copyForEmail(true)}
              >
                {copyState === 'copied' ? <Check size={14} /> : <Mail size={14} />}
                {copyState === 'copied' ? 'Copied!' : 'Copy for email'}
              </button>
            </div>
            {/* Email HTML — same markup that Copy for email pastes */}
            {html ? (
              <div
                className="overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <SignatureCard data={form} saveHref={previewShare} compact />
            )}
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Copy for email pastes this preview into Gmail, Outlook, or Apple Mail.
            </p>
          </div>
        </div>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Saved signatures</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No signatures saved yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                  <th className="py-2 pr-3 font-medium">Card</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Share</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {saved.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-line)]">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {row.photoUrl ? (
                          <img
                            src={row.photoUrl}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-[#2437ff] text-white grid place-items-center text-[10px] font-bold">
                            {(row.firstName[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <span>
                          {row.firstName} {row.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">{row.jobTitle}</td>
                    <td className="py-2.5 pr-3">
                      <Link className="text-[var(--color-accent)] hover:underline" to={row.sharePath}>
                        /s/{row.shareSlug}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title="Copy for email signature"
                          onClick={() => copyForEmail(true, row)}
                        >
                          <Mail size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => startEdit(row)}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDelete(row.id)}>
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
      </section>
    </div>
  );
}
