export type SignatureForm = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string;
  logoUrl: string;
  directLine: string;
  cellPhone: string;
  reportsTo: string;
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
  reportsTo: '',
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

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  // Plain handles only — reject free-text / placeholder sentences
  if (/\s/.test(raw) || raw.length > 64) return '';
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

export function readImageFile(file: File, maxBytes = 10_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error('Image must be under 10MB'));
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

/** Keep a single signature table — strip doc wrappers that Gmail can paste twice. */
function signatureFragment(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return '';

  if (typeof document !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    // Serialize one outer card only. Do not return the original string even when
    // it starts with a table: Safari can preserve a second adjacent fragment in
    // clipboard HTML returned by some API responses.
    const table = doc.body?.querySelector('table');
    if (table) return table.outerHTML;
    return (doc.body?.innerHTML || trimmed).trim();
  }

  const match = trimmed.match(/<table[\s\S]*<\/table>/i);
  return match ? match[0] : trimmed;
}

function preparedSignatureHtml(fragmentHtml: string) {
  const host = document.createElement('div');
  host.innerHTML = fragmentHtml;
  bakeEmailFonts(host);
  const table = host.querySelector('table');
  return (table ? table.outerHTML : host.innerHTML).trim();
}

async function writeHtmlClipboard(payloadHtml: string) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return false;
  }
  const htmlBlob = new Blob([payloadHtml], { type: 'text/html' });
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': htmlBlob,
    }),
  ]);
  return true;
}

/** Copy rich HTML so Gmail/Outlook/Apple Mail paste a single signature card. */
export async function copyEmailSignatureHtml(html: string) {
  const fragment = signatureFragment(html);
  const payload = preparedSignatureHtml(fragment);
  if (!payload) {
    await navigator.clipboard.writeText('Email signature');
    return 'text';
  }
  const plain = htmlToPlainSignature(payload) || 'Email signature';

  try {
    // One ClipboardItem with one representation. In particular, do not use
    // execCommand('copy') here: Safari can append its own selected-page payload
    // to the custom copy-event data, which Gmail then renders as a second card.
    if (await writeHtmlClipboard(payload)) return 'rich';
  } catch {
    // fall through
  }

  await navigator.clipboard.writeText(plain);
  return 'text';
}
