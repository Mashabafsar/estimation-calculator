export type SignatureForm = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string;
  logoUrl: string;
  directLine: string;
  cellPhone: string;
  email: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  twitter: string;
  website2: string;
  customLinkLabel: string;
  customLinkUrl: string;
  companyName: string;
  companyUrl: string;
  companyStreet: string;
  companyCity: string;
  companyRegion: string;
  companyPostal: string;
  tagline: string;
};

export type SavedSignature = SignatureForm & {
  id: string;
  shareSlug: string;
  sharePath: string;
  shareUrl?: string;
  html?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_SIGNATURE: SignatureForm = {
  firstName: '',
  lastName: '',
  jobTitle: '',
  photoUrl: '',
  logoUrl: '',
  directLine: '',
  cellPhone: '',
  email: '',
  facebook: '',
  instagram: '',
  linkedin: '',
  youtube: '',
  twitter: '',
  website2: '',
  customLinkLabel: 'Join our Facebook Group',
  customLinkUrl: '',
  companyName: 'Agency Partner Interactive',
  companyUrl: 'https://agencypartner.com',
  companyStreet: '5830 Granite Pkwy STE 100 - 253',
  companyCity: 'Plano',
  companyRegion: 'TX',
  companyPostal: '75024',
  tagline: 'Be the catalyst to unlock growth and value for every business.',
};

const SOCIAL_BASES = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  linkedin: 'https://www.linkedin.com/in/',
  youtube: 'https://www.youtube.com/@',
  twitter: 'https://x.com/',
} as const;

export function normalizeSocial(
  network: keyof typeof SOCIAL_BASES,
  value: string,
) {
  const raw = value.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (!handle) return '';
  if (network === 'linkedin' && /^(in|company)\//i.test(handle)) {
    return `https://www.linkedin.com/${handle}`;
  }
  return `${SOCIAL_BASES[network]}${handle}`;
}

export function normalizeSite(value: string) {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (!parsed.hostname || !parsed.hostname.includes('.')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

export function displayHost(value: string) {
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Shared address lines for SignatureCard + email HTML (HiHello-style) */
export function formatSignatureAddress(data: {
  companyStreet: string;
  companyCity: string;
  companyRegion: string;
  companyPostal: string;
}) {
  const street = data.companyStreet.replace(/\s+/g, ' ').trim();
  const cityLine = `${data.companyCity}, ${data.companyRegion} ${data.companyPostal}`
    .replace(/\s+/g, ' ')
    .trim();
  // "879 Coleman Ave. #40 work" then city — keep suite on the first line
  return {
    lines: [street ? `${street} work` : '', cityLine].filter(Boolean),
  };
}

export function socialLinks(data: SignatureForm) {
  const labels: Record<keyof typeof SOCIAL_BASES, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    twitter: 'X',
  };

  return (Object.keys(SOCIAL_BASES) as Array<keyof typeof SOCIAL_BASES>)
    .map((network) => ({
      network,
      url: normalizeSocial(network, data[network]),
      label: labels[network],
    }))
    .filter((s) => s.url);
}

/** HiHello-style labeled rows for the public digital business card page */
export function socialCardRows(data: SignatureForm) {
  const handle = (value: string) => {
    const raw = value.trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) {
      try {
        const path = new URL(raw).pathname.replace(/\/+$/, '');
        const last = path.split('/').filter(Boolean).pop() || '';
        return last.replace(/^@/, '');
      } catch {
        return '';
      }
    }
    // Plain handles only — skip free-text / placeholder sentences
    if (/\s/.test(raw) || raw.length > 40) return '';
    return raw.replace(/^@/, '').replace(/^\/+/, '');
  };

  const rows: Array<{ network: keyof typeof SOCIAL_BASES; url: string; label: string }> = [];
  const push = (network: keyof typeof SOCIAL_BASES, label: string) => {
    const url = normalizeSocial(network, data[network]);
    if (url) rows.push({ network, url, label });
  };

  const fb = handle(data.facebook);
  push('facebook', fb ? `Follow ${fb} on Facebook` : 'Follow me on Facebook');
  const ig = handle(data.instagram);
  push('instagram', ig ? `Follow @${ig} on Instagram` : 'Follow me on Instagram');
  push('linkedin', 'Connect with me on LinkedIn');
  const yt = handle(data.youtube);
  push('youtube', yt ? `Subscribe to @${yt} on YouTube` : 'Subscribe on YouTube');
  const tw = handle(data.twitter);
  push('twitter', tw ? `Follow @${tw} on X` : 'Follow me on X');
  return rows;
}

export function readImageFile(file: File, maxBytes = 1_800_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error('Image must be under 1.8MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function htmlToPlainSignature(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Bake pt sizes onto every text node so Apple Mail can't inherit the compose font. */
function bakeEmailFonts(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('a, font, span, td, div, b, p').forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (/font-size:\s*0(px|pt)?/i.test(style) || /line-height:\s*0/i.test(style)) return;

    const m = style.match(/font-size:\s*([\d.]+)(px|pt)/i);
    let pt = 7;
    if (m) {
      const n = parseFloat(m[1]);
      pt = m[2].toLowerCase() === 'pt' ? n : Math.max(6, Math.round((n * 3) / 4));
    } else if (/font-weight:\s*700|font-weight:\s*bold/i.test(style)) {
      pt = 10;
    }

    el.style.setProperty('font-size', `${pt}pt`);
    el.style.setProperty('font-family', 'Arial, Helvetica, sans-serif');
    if (!/line-height:\s*0/i.test(style)) {
      el.style.setProperty('line-height', pt <= 7 ? '10pt' : pt <= 8 ? '10pt' : '12pt');
    }
    if (el.tagName === 'FONT') {
      el.setAttribute('size', pt >= 10 ? '2' : '1');
      el.setAttribute('face', 'Arial, Helvetica, sans-serif');
    }
  });
}

function copyViaContentEditable(html: string) {
  const host = document.createElement('div');
  host.setAttribute('contenteditable', 'true');
  // Isolate from app page font (body is often 14–16px — Mail was inheriting that on paste)
  host.style.cssText = [
    'all:initial',
    'position:fixed',
    'left:0',
    'top:0',
    'width:400px',
    'height:1px',
    'opacity:0.01',
    'overflow:hidden',
    'z-index:-1',
    'display:block',
    'font-family:Arial,Helvetica,sans-serif',
    'font-size:7pt',
    'line-height:10pt',
    'color:#111827',
    '-webkit-text-size-adjust:none',
  ].join(';');
  host.innerHTML = html;
  bakeEmailFonts(host);
  document.body.appendChild(host);

  host.focus();
  const range = document.createRange();
  range.selectNodeContents(host);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    selection?.removeAllRanges();
    document.body.removeChild(host);
  }
  return ok;
}

/** Full HTML doc + pt sizes — Mail paste keeps these better than bare fragments with px. */
function emailClipboardHtml(html: string) {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:7pt;line-height:10pt;color:#111827;-webkit-text-size-adjust:none;text-size-adjust:none;">` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:7pt;line-height:10pt;color:#111827;-webkit-text-size-adjust:none;text-size-adjust:none;">${html}</div>` +
    `</body></html>`
  );
}

/** Copy rich HTML so Gmail/Outlook/Apple Mail paste the rendered signature. */
export async function copyEmailSignatureHtml(html: string) {
  const plain = htmlToPlainSignature(html) || 'Email signature';
  const rich = emailClipboardHtml(html);

  // Safari + Apple Mail: DOM selection copy keeps text/html on the clipboard.
  try {
    if (copyViaContentEditable(rich)) return 'rich';
  } catch {
    // fall through
  }

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const htmlBlob = new Blob([rich], { type: 'text/html' });
      const plainBlob = new Blob([plain], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob,
        }),
      ]);
      return 'rich';
    } catch {
      // fall through
    }
  }

  await navigator.clipboard.writeText(plain);
  return 'text';
}
