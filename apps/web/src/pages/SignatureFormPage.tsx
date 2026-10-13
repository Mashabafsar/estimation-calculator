import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ExternalLink, ImagePlus, Loader2, Mail, Trash2, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loader';
import { SignatureCard } from '../components/SignatureCard';
import {
  EMPTY_SIGNATURE,
  copyEmailSignatureHtml,
  formFromSavedSignature,
  uploadSignatureImage,
  type SavedSignature,
  type SignatureForm,
} from '../lib/signatures';

function ImageField({
  label,
  value,
  onChange,
  onClear,
  token,
  variant = 'photo',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  token: string;
  variant?: 'photo' | 'logo';
}) {
  const isLogo = variant === 'logo';
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setUploading(true);
      onChange(await uploadSignatureImage(file, token));
    } catch (err: any) {
      alert(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <div className="flex items-end gap-2.5">
        <label
          className={[
            'group relative block cursor-pointer overflow-hidden border border-[var(--color-line)] bg-[var(--color-canvas)] transition',
            'hover:border-[var(--color-accent)] hover:shadow-[0_0_0_3px_var(--color-accent-soft)]',
            uploading || !token ? 'pointer-events-none opacity-70' : '',
            isLogo ? 'h-20 w-20 rounded-full' : 'h-20 w-20 rounded-2xl',
          ].join(' ')}
          title={value ? 'Replace image' : 'Upload image'}
        >
          {isLogo ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'conic-gradient(from 210deg, #16a34a 0%, #4ade80 24%, #2437ff 55%, #93c5fd 78%, #16a34a 100%)',
                }}
              />
              <div className="absolute inset-[3px] overflow-hidden rounded-full bg-white grid place-items-center p-1.5">
                {value ? (
                  <img src={value} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus size={20} className="text-[#2437ff]" />
                )}
              </div>
            </>
          ) : value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--color-muted)]">
              <ImagePlus size={22} />
              <span className="text-[10px] font-medium">Add</span>
            </div>
          )}

          <div className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
            {uploading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Upload size={18} className="text-white" />
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading || !token}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              await handleFile(file);
            }}
          />
        </label>

        <div className="flex flex-col gap-1.5 pb-0.5">
          <label
            className={[
              'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] transition',
              'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer',
              uploading || !token ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
            title="Upload"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || !token}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                await handleFile(file);
              }}
            />
          </label>
          {value ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              title="Remove"
              onClick={onClear}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SignatureFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { token } = useAuth();

  const [form, setForm] = useState<SignatureForm>(EMPTY_SIGNATURE);
  const [editingId, setEditingId] = useState<string | null>(id || null);
  const [html, setHtml] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareSlug, setShareSlug] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    if (!isEdit || !id || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<SavedSignature>(`/signatures/${id}`, { token })
      .then((row) => {
        if (cancelled) return;
        setEditingId(row.id);
        setForm(formFromSavedSignature(row));
        setShareUrl(`${window.location.origin}${row.sharePath}`);
        setShareSlug(row.shareSlug);
        setHtml('');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setMessage(err?.message || 'Failed to load signature');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, token]);

  const previewShare = useMemo(() => (shareUrl ? shareUrl : undefined), [shareUrl]);

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
      setMessage(editingId ? 'Signature updated.' : 'Signature created.');
      if (!isEdit) {
        navigate(`/signatures/${result.id}/edit`, { replace: true });
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save signature');
    } finally {
      setBusy(false);
    }
  }

  async function copyForEmail() {
    setBusy(true);
    setMessage('');
    try {
      let nextHtml = html;
      if (!nextHtml) {
        const preview = await fetchSignatureHtml({
          ...form,
          shareSlug: shareSlug || undefined,
        });
        nextHtml = preview.html;
        setHtml(preview.html);
        setShareUrl(preview.shareUrl);
      }
      const mode = await copyEmailSignatureHtml(nextHtml);
      setCopyState('copied');
      setMessage(
        mode === 'rich'
          ? 'Copied one card. Paste it into Gmail, Outlook, or Apple Mail.'
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
        const preview = await fetchSignatureHtml({
          ...form,
          shareSlug: shareSlug || undefined,
        });
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

  if (loading) {
    return <PageLoader label="Loading signature…" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Link
            to="/signatures"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={14} /> Back to signatures
          </Link>
          <div>
            <h1 className="page-title">{isEdit ? 'Edit signature' : 'New signature'}</h1>
            <p className="page-subtitle">
              Add photo + logo, preview the card, save, and copy for email.
            </p>
          </div>
        </div>
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
                token={token || ''}
              />
              <ImageField
                label="Company logo"
                variant="logo"
                value={form.logoUrl}
                onChange={(v) => update('logoUrl', v)}
                onClear={() => update('logoUrl', '')}
                token={token || ''}
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
                  ['cellPhone', 'Cell phone / mobile'],
                  ['reportsTo', 'Direct Line'],
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
              onClick={copyForEmail}
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
                onClick={copyForEmail}
              >
                {copyState === 'copied' ? <Check size={14} /> : <Mail size={14} />}
                {copyState === 'copied' ? 'Copied!' : 'Copy for email'}
              </button>
            </div>
            {html ? (
              <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <SignatureCard data={form} saveHref={previewShare} compact />
            )}
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Copy for email puts one card on the clipboard for Gmail, Outlook, or Apple Mail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
