import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  SAVE_CONTACT_BTN_DATA_URI,
  SIGNATURE_ICON_DATA_URIS,
  SIGNATURE_ICON_SVGS,
  type SignatureIconName,
} from './signature-icons.js';
import { resolveImageDataUrl } from './signature-media.service.js';

function formatSignatureAddress(data: {
  companyStreet: string;
  companyCity: string;
  companyRegion: string;
  companyPostal: string;
}) {
  const street = data.companyStreet.replace(/\s+/g, ' ').trim();
  const cityLine = `${data.companyCity}, ${data.companyRegion} ${data.companyPostal}`
    .replace(/\s+/g, ' ')
    .trim();
  // HiHello: "879 Coleman Ave. #40 work" / city line
  return [street ? `${street} work` : '', cityLine].filter(Boolean);
}

/** Max data-URL length for photo/logo (~10MB file as base64 + prefix). */
const IMAGE_MAX = 14_000_000;

export type SignatureInput = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl?: string | null;
  logoUrl?: string | null;
  directLine?: string | null;
  cellPhone?: string | null;
  reportsTo?: string | null;
  email?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  twitter?: string | null;
  website2?: string | null;
  customLinkLabel?: string | null;
  customLinkUrl?: string | null;
  companyName?: string | null;
  companyUrl?: string | null;
  companyStreet?: string | null;
  companyCity?: string | null;
  companyRegion?: string | null;
  companyPostal?: string | null;
  tagline?: string | null;
};

const SOCIAL_BASES = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  linkedin: 'https://www.linkedin.com/in/',
  youtube: 'https://www.youtube.com/@',
  twitter: 'https://x.com/',
} as const;

type SocialNetwork = keyof typeof SOCIAL_BASES;

function strip(value?: string | null, max = 200) {
  return (value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function stripMedia(value?: string | null) {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (
    raw.startsWith('data:image/') ||
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('/api/uploads/signatures/')
  ) {
    return raw.slice(0, IMAGE_MAX);
  }
  return '';
}

function socialHostOk(network: SocialNetwork, host: string) {
  const h = host.replace(/^www\./i, '').toLowerCase();
  switch (network) {
    case 'facebook':
      return h.includes('facebook.com') || h.includes('fb.com');
    case 'instagram':
      return h.includes('instagram.com');
    case 'linkedin':
      return h.includes('linkedin.com');
    case 'youtube':
      return h.includes('youtube.com') || h.includes('youtu.be');
    case 'twitter':
      return h.includes('twitter.com') || h === 'x.com';
    default:
      return false;
  }
}

function socialHandle(network: SocialNetwork, value?: string | null) {
  const raw = strip(value, 300);
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!socialHostOk(network, parsed.hostname)) return '';
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (network === 'linkedin') {
        if (parts[0] && /^(in|company)$/i.test(parts[0]) && parts[1]) {
          return `${parts[0].toLowerCase()}/${parts[1]}`;
        }
        return '';
      }
      const last = (parts[parts.length - 1] || '').replace(/^@/, '');
      return last && !/\s/.test(last) ? last : '';
    } catch {
      return '';
    }
  }

  // Plain handles only — reject free-text / placeholder sentences
  if (/\s/.test(raw) || raw.length > 64) return '';
  const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (!handle) return '';
  if (network === 'linkedin' && /^(in|company)\//i.test(handle)) return handle;
  return handle;
}

function normalizeSocial(network: SocialNetwork, value?: string | null) {
  const handle = socialHandle(network, value);
  if (!handle) return '';
  if (network === 'linkedin' && /^(in|company)\//i.test(handle)) {
    return `https://www.linkedin.com/${handle}`;
  }
  if (network === 'youtube') {
    return `https://www.youtube.com/@${handle.replace(/^@/, '')}`;
  }
  return `${SOCIAL_BASES[network]}${handle}`;
}

function normalizeUrl(value?: string | null) {
  const raw = strip(value, 500);
  // Spaces / placeholder phrases become broken [url]text in Apple Mail
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

function displayUrlLabel(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function escapeVcard(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** RFC 2426 line folding — keeps large PHOTO payloads importable. */
function foldVcardLine(line: string) {
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let i = 75;
  while (i < line.length) {
    out += `\r\n ${line.slice(i, i + 74)}`;
    i += 74;
  }
  return out;
}

function vcardPhotoType(mime: string) {
  const m = mime.toLowerCase().replace(/^image\//, '');
  if (m === 'jpg' || m === 'jpeg') return 'JPEG';
  if (m === 'png') return 'PNG';
  if (m === 'gif') return 'GIF';
  if (m === 'webp') return 'WEBP';
  return '';
}

/** Extract a Contacts-compatible PHOTO line (Apple ignores SVG). */
async function buildVcardPhoto(photoUrl?: string | null): Promise<string | null> {
  const raw = (photoUrl ?? '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/uploads/signatures/')) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return foldVcardLine(`PHOTO;VALUE=URI:${raw}`);
    } catch {
      return null;
    }
  }

  const dataUrl = raw.startsWith('data:image/') ? raw : await resolveImageDataUrl(raw);
  const dataMatch = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!dataMatch) return null;

  let mime = dataMatch[1].toLowerCase();
  let b64 = dataMatch[2].replace(/\s+/g, '');

  // Many uploaded avatars are SVG wrappers around a JPEG/PNG — Contacts needs the raster.
  if (mime.includes('svg')) {
    try {
      const svg = Buffer.from(b64, 'base64').toString('utf8');
      const embedded = svg.match(/data:(image\/(?:jpeg|jpg|png|gif|webp));base64,([A-Za-z0-9+/=]+)/i);
      if (!embedded) return null;
      mime = embedded[1].toLowerCase();
      b64 = embedded[2];
    } catch {
      return null;
    }
  }

  const type = vcardPhotoType(mime);
  if (!type || !b64) return null;
  // Cap ~1.5MB base64 so .vcf stays importable
  if (b64.length > 2_000_000) return null;

  return foldVcardLine(`PHOTO;ENCODING=b;TYPE=${type}:${b64}`);
}

function makeSlug() {
  return randomBytes(6).toString('hex');
}

export type SignatureDto = {
  id: string;
  shareSlug: string;
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
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  sharePath: string;
};

function serialize(row: {
  id: string;
  shareSlug: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string | null;
  logoUrl: string | null;
  directLine: string | null;
  cellPhone: string | null;
  reportsTo: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  twitter: string | null;
  website2: string | null;
  customLinkLabel: string | null;
  customLinkUrl: string | null;
  companyName: string;
  companyUrl: string;
  companyStreet: string;
  companyCity: string;
  companyRegion: string;
  companyPostal: string;
  tagline: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): SignatureDto {
  return {
    id: row.id,
    shareSlug: row.shareSlug,
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    photoUrl: row.photoUrl ?? '',
    logoUrl: row.logoUrl ?? '',
    directLine: row.directLine ?? '',
    cellPhone: row.cellPhone ?? '',
    reportsTo: row.reportsTo ?? '',
    email: row.email ?? '',
    facebook: row.facebook ?? '',
    instagram: row.instagram ?? '',
    linkedin: row.linkedin ?? '',
    youtube: row.youtube ?? '',
    twitter: row.twitter ?? '',
    website2: row.website2 ?? '',
    customLinkLabel: row.customLinkLabel ?? '',
    customLinkUrl: row.customLinkUrl ?? '',
    companyName: row.companyName,
    companyUrl: row.companyUrl,
    companyStreet: row.companyStreet,
    companyCity: row.companyCity,
    companyRegion: row.companyRegion,
    companyPostal: row.companyPostal,
    tagline: row.tagline ?? '',
    isActive: row.isActive,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sharePath: `/s/${row.shareSlug}`,
  };
}

function mapInput(input: SignatureInput) {
  return {
    firstName: strip(input.firstName),
    lastName: strip(input.lastName),
    jobTitle: strip(input.jobTitle),
    photoUrl: stripMedia(input.photoUrl) || null,
    logoUrl: stripMedia(input.logoUrl) || null,
    directLine: strip(input.directLine) || null,
    cellPhone: strip(input.cellPhone) || null,
    reportsTo: strip(input.reportsTo) || null,
    email: strip(input.email) || null,
    facebook: strip(input.facebook, 300) || null,
    instagram: strip(input.instagram, 300) || null,
    linkedin: strip(input.linkedin, 300) || null,
    youtube: strip(input.youtube, 300) || null,
    twitter: strip(input.twitter, 300) || null,
    website2: strip(input.website2, 500) || null,
    customLinkLabel: strip(input.customLinkLabel, 120) || null,
    customLinkUrl: strip(input.customLinkUrl, 500) || null,
    companyName: strip(input.companyName) || undefined,
    companyUrl: strip(input.companyUrl, 300) || undefined,
    companyStreet: strip(input.companyStreet) || undefined,
    companyCity: strip(input.companyCity) || undefined,
    companyRegion: strip(input.companyRegion) || undefined,
    companyPostal: strip(input.companyPostal) || undefined,
    tagline: strip(input.tagline, 400) || undefined,
  };
}

export async function listSignatures(userId: string, isAdmin = false) {
  const rows = await prisma.emailSignature.findMany({
    where: isAdmin ? undefined : { createdById: userId },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(serialize);
}

export async function getSignature(id: string, userId: string, isAdmin = false) {
  const row = await prisma.emailSignature.findUnique({ where: { id } });
  if (!row) throw new AppError('Signature not found', 404);
  if (!isAdmin && row.createdById !== userId) throw new AppError('Forbidden', 403);
  return serialize(row);
}

export async function createSignature(userId: string, input: SignatureInput) {
  const row = await prisma.emailSignature.create({
    data: {
      shareSlug: makeSlug(),
      ...mapInput(input),
      createdById: userId,
    },
  });
  return serialize(row);
}

export async function updateSignature(id: string, userId: string, isAdmin: boolean, input: SignatureInput) {
  const existing = await prisma.emailSignature.findUnique({ where: { id } });
  if (!existing) throw new AppError('Signature not found', 404);
  if (!isAdmin && existing.createdById !== userId) throw new AppError('Forbidden', 403);

  const mapped = mapInput(input);
  const row = await prisma.emailSignature.update({
    where: { id },
    data: {
      ...mapped,
      companyName: mapped.companyName || existing.companyName,
      companyUrl: mapped.companyUrl || existing.companyUrl,
      companyStreet: mapped.companyStreet || existing.companyStreet,
      companyCity: mapped.companyCity || existing.companyCity,
      companyRegion: mapped.companyRegion || existing.companyRegion,
      companyPostal: mapped.companyPostal || existing.companyPostal,
      tagline: mapped.tagline || existing.tagline,
    },
  });
  return serialize(row);
}

export async function deleteSignature(id: string, userId: string, isAdmin: boolean) {
  const existing = await prisma.emailSignature.findUnique({ where: { id } });
  if (!existing) throw new AppError('Signature not found', 404);
  if (!isAdmin && existing.createdById !== userId) throw new AppError('Forbidden', 403);
  await prisma.emailSignature.delete({ where: { id } });
  return { ok: true };
}

export async function getByShareSlug(slug: string) {
  const row = await prisma.emailSignature.findFirst({
    where: { shareSlug: slug, isActive: true },
  });
  if (!row) throw new AppError('Signature not found', 404);
  return serialize(row);
}

export async function buildVcard(data: SignatureDto) {
  const socialLabels: Record<SocialNetwork, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    twitter: 'Twitter',
  };

  const socials = (
    [
      ['facebook', data.facebook],
      ['instagram', data.instagram],
      ['linkedin', data.linkedin],
      ['youtube', data.youtube],
      ['twitter', data.twitter],
    ] as const
  )
    .map(([network, value]) => {
      const handle = socialHandle(network, value);
      const url = normalizeSocial(network, value);
      return handle && url ? { network, handle, url, label: socialLabels[network] } : null;
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const companyUrl = normalizeUrl(data.companyUrl);
  const website2 = normalizeUrl(data.website2);
  const customLink = normalizeUrl(data.customLinkUrl);

  // Labeled URLs show the link in Apple Contacts; X-SOCIALPROFILE alone often
  // blanks Instagram/YouTube (especially youtube.com/@ handles).
  let urlItem = 1;
  const labeledUrls: string[] = [];
  const pushLabeledUrl = (label: string, url: string) => {
    const n = urlItem++;
    labeledUrls.push(`item${n}.URL:${escapeVcard(url)}`);
    labeledUrls.push(`item${n}.X-ABLabel:${escapeVcard(label)}`);
  };

  if (companyUrl) pushLabeledUrl('work', companyUrl);
  if (website2) pushLabeledUrl('website', website2);
  if (customLink) pushLabeledUrl(data.customLinkLabel || 'Link', customLink);
  for (const s of socials) pushLabeledUrl(s.label, s.url);

  const photo = await buildVcardPhoto(data.photoUrl);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(data.lastName)};${escapeVcard(data.firstName)};;;`,
    `FN:${escapeVcard(fullName)}`,
    photo,
    `ORG:${escapeVcard(data.companyName)}`,
    data.jobTitle ? `TITLE:${escapeVcard(data.jobTitle)}` : null,
    (data.reportsTo || data.directLine)
      ? `TEL;TYPE=WORK,VOICE:${escapeVcard(data.reportsTo || data.directLine)}`
      : null,
    data.cellPhone ? `TEL;TYPE=CELL,VOICE:${escapeVcard(data.cellPhone)}` : null,
    data.email ? `EMAIL;TYPE=INTERNET,WORK:${escapeVcard(data.email)}` : null,
    `ADR;TYPE=WORK:;;${escapeVcard(data.companyStreet)};${escapeVcard(data.companyCity)};${escapeVcard(data.companyRegion)};${escapeVcard(data.companyPostal)};`,
    ...labeledUrls,
    'END:VCARD',
  ].filter(Boolean);

  return `${lines.join('\r\n')}\r\n`;
}

export function previewFromInput(input: SignatureInput, sharePath = '/s/preview'): SignatureDto {
  const mapped = mapInput(input);
  const now = new Date();
  return {
    id: 'preview',
    shareSlug: 'preview',
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    jobTitle: mapped.jobTitle,
    photoUrl: mapped.photoUrl ?? '',
    logoUrl: mapped.logoUrl ?? '',
    directLine: mapped.directLine ?? '',
    cellPhone: mapped.cellPhone ?? '',
    reportsTo: mapped.reportsTo ?? '',
    email: mapped.email ?? '',
    facebook: mapped.facebook ?? '',
    instagram: mapped.instagram ?? '',
    linkedin: mapped.linkedin ?? '',
    youtube: mapped.youtube ?? '',
    twitter: mapped.twitter ?? '',
    website2: mapped.website2 ?? '',
    customLinkLabel: mapped.customLinkLabel ?? '',
    customLinkUrl: mapped.customLinkUrl ?? '',
    companyName: mapped.companyName || 'Agency Partner Interactive',
    companyUrl: mapped.companyUrl || 'https://agencypartner.com',
    companyStreet: mapped.companyStreet || '5830 Granite Pkwy STE 100 - 253',
    companyCity: mapped.companyCity || 'Plano',
    companyRegion: mapped.companyRegion || 'TX',
    companyPostal: mapped.companyPostal || '75024',
    tagline: mapped.tagline || '',
    isActive: true,
    createdById: '',
    createdAt: now,
    updatedAt: now,
    sharePath,
  };
}

function xml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgImage(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** Keep contact-column text inside its half so long streets don't cover the right icons. */
function fitContactLines(text: string, maxChars: number, maxLines: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [] as string[];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      lines.push(`${word.slice(0, Math.max(1, maxChars - 1))}…`);
      current = '';
    } else {
      current = word;
    }
    if (lines.length >= maxLines) {
      current = '';
      break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    const full = words.join(' ');
    if (used < full.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length >= maxChars
          ? `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
          : `${last.replace(/…$/, '').trimEnd()}…`;
    }
  }
  return lines;
}

/** HiHello-style email signature: one raster image, one card link. */
export async function buildSignatureImageHtml(
  data: SignatureDto,
  opts: { cardUrl: string },
) {
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Name';
  const address = formatSignatureAddress(data);
  const directLine = (data.reportsTo.trim() || data.directLine.trim()).trim();
  const companyUrl = displayUrlLabel(data.companyUrl) || data.companyUrl;
  const customLabel = data.customLinkLabel || displayUrlLabel(data.customLinkUrl);
  const initials = `${data.firstName[0] || 'A'}${data.lastName[0] || 'P'}`.toUpperCase();
  const monoParts = data.companyName.trim().split(/\s+/).filter(Boolean);
  const mono = (monoParts.length > 1
    ? `${monoParts[0][0] || ''}${monoParts[1][0] || ''}`
    : data.companyName.slice(0, 2) || 'CO'
  ).toUpperCase();

  // Keep embeds small — librsvg rejects huge base64 data URLs inside the card SVG.
  const photo = await resolveImageDataUrl(data.photoUrl, { maxEdge: 224 });
  const logo = await resolveImageDataUrl(data.logoUrl, { maxEdge: 160 });
  const iconHref = (name: SignatureIconName) => svgImage(SIGNATURE_ICON_SVGS[name]);
  const icon = (name: SignatureIconName, x: number, y: number, size = 36) =>
    `<image href="${iconHref(name)}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;

  const socials = (
    [
      ['facebook', data.facebook],
      ['instagram', data.instagram],
      ['linkedin', data.linkedin],
      ['youtube', data.youtube],
      ['twitter', data.twitter],
    ] as const
  ).filter(([network, value]) => normalizeSocial(network, value));

  const leftRows: Array<[SignatureIconName, string, string]> = [];
  if (address.length) leftRows.push(['location', address[0], address[1] || '']);
  if (data.cellPhone) leftRows.push(['phone', `${data.cellPhone}  mobile`, '']);
  if (data.email) leftRows.push(['email', data.email, '']);

  const rightRows: Array<[SignatureIconName, string]> = [];
  if (companyUrl) rightRows.push(['web', companyUrl]);
  if (data.website2) rightRows.push(['web', displayUrlLabel(data.website2) || data.website2]);
  if (customLabel) rightRows.push(['link', customLabel]);

  // Left column text ends before right icons (x≈430). ~26 chars @ 22px DejaVu.
  const LEFT_CHARS = 26;
  const RIGHT_CHARS = 28;
  const leftSvg = leftRows
    .map(([name, line1, line2], i) => {
      const y = 202 + i * 58;
      // Address keeps a city line — wrap street to 1 line; other rows can use 2.
      const streetLines = fitContactLines(line1, LEFT_CHARS, line2 ? 1 : 2);
      const body = streetLines
        .map(
          (line, li) =>
            `<text x="82" y="${y + li * 22}" class="body">${xml(line)}</text>`,
        )
        .join('');
      const city =
        line2
          ? `<text x="82" y="${y + streetLines.length * 22}" class="muted">${xml(
              fitContactLines(line2, LEFT_CHARS, 1)[0] || line2,
            )}</text>`
          : '';
      return `${icon(name, 32, y - 25)}${body}${city}`;
    })
    .join('');
  const rightSvg = rightRows
    .map(([name, label], i) => {
      const y = 202 + i * 58;
      const lines = fitContactLines(label, RIGHT_CHARS, 2);
      const body = lines
        .map(
          (line, li) =>
            `<text x="480" y="${y + li * 22}" class="body">${xml(line)}</text>`,
        )
        .join('');
      return `${icon(name, 430, y - 25)}${body}`;
    })
    .join('');
  // Footer band: break line at y=390 → card bottom at y=480 (90px). Icons centered; Save flush to line.
  const footerTop = 390;
  const footerBottom = 480;
  const socialSize = 30;
  const socialY = footerTop + Math.round((footerBottom - footerTop - socialSize) / 2);
  const socialSvg = socials
    .map(([name], i) => icon(name, 34 + i * 52, socialY, socialSize))
    .join('');

  const photoSvg = photo
    ? `<clipPath id="photoClip"><rect x="32" y="28" width="112" height="112" rx="24"/></clipPath><image href="${xml(photo)}" x="32" y="28" width="112" height="112" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    : `<rect x="32" y="28" width="112" height="112" rx="24" fill="#2437ff"/><text x="88" y="97" text-anchor="middle" class="initials">${xml(initials)}</text>`;
  const logoSvg = logo
    ? `<circle cx="710" cy="84" r="58" fill="#16a34a"/><circle cx="710" cy="84" r="50" fill="#fff"/><image href="${xml(logo)}" x="674" y="48" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="710" cy="84" r="58" fill="#16a34a"/><circle cx="710" cy="84" r="50" fill="#fff"/><text x="710" y="94" text-anchor="middle" class="mono">${xml(mono)}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
    <style>.body{font:22px 'DejaVu Sans',Arial,sans-serif;fill:#111827}.muted{font:20px 'DejaVu Sans',Arial,sans-serif;fill:#4b5563}.initials{font:700 32px 'DejaVu Sans',Arial,sans-serif;fill:#fff}.mono{font:800 26px 'DejaVu Sans',Arial,sans-serif;fill:#2437ff}</style>
    <rect x="1" y="1" width="798" height="478" rx="28" fill="#fff" stroke="#d5dae3" stroke-width="2"/>
    ${photoSvg}${logoSvg}
    <text x="176" y="62" style="font:700 30px 'DejaVu Sans',Arial,sans-serif;fill:#0f172a">${xml(fullName)}</text>
    <text x="176" y="94" style="font:24px 'DejaVu Sans',Arial,sans-serif;fill:#1f2937">${xml(data.jobTitle)}</text>
    <text x="176" y="124" style="font:italic 23px 'DejaVu Sans',Arial,sans-serif;fill:#6b7280">${xml(data.companyName)}</text>
    <line x1="1" y1="158" x2="799" y2="158" stroke="#eef1f5" stroke-width="2"/>
    ${leftSvg}${rightSvg}
    <line x1="1" y1="${footerTop}" x2="799" y2="${footerTop}" stroke="#eef1f5" stroke-width="2"/>
    ${socialSvg}
    <path d="M570 ${footerTop}H800V448C800 466 786 480 768 480H540V420C540 403 553 ${footerTop} 570 ${footerTop}Z" fill="#2437ff"/>
    <text x="670" y="445" text-anchor="middle" style="font:700 20px 'DejaVu Sans',Arial,sans-serif;letter-spacing:1.5px;fill:#fff">SAVE CONTACT</text>
  </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const src = `data:image/png;base64,${png.toString('base64')}`;
  const alt = `${fullName}. ${data.jobTitle}. ${data.companyName}. ${data.email}. ${data.cellPhone}. ${directLine}`;
  return `<a href="${xml(opts.cardUrl)}" style="display:inline-block;text-decoration:none;border:0;"><img src="${src}" width="400" height="240" alt="${xml(alt)}" border="0" style="display:block;width:400px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></a>`;
}

export function buildSignatureHtml(
  data: SignatureDto,
  opts: { cardUrl: string; assetBase: string },
) {
  const escape = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Use real text. Gmail strips data: SVG images after an email is sent, which
  // made text-as-SVG labels appear as empty boxes in the received message.
  const text = (
    value: string,
    options: { color?: string; size?: number; weight?: number; italic?: boolean } = {},
  ) => {
    const color = options.color || '#111827';
    const size = options.size || 11;
    const weight = options.weight || 400;
    return `<span style="font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:${size + 3}px;color:${color};font-weight:${weight};${options.italic ? 'font-style:italic;' : ''}">${escape(value)}</span>`;
  };

  const linkedText = (href: string, valueHtml: string) =>
    `<a href="${escape(href)}" style="font-family:Arial,Helvetica,sans-serif;text-decoration:none;color:#111827;border:0;outline:none;">${valueHtml}</a>`;

  const fullNameRaw = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Name';
  const jobTitleRaw = data.jobTitle || 'Job title';
  const companyRaw = data.companyName || 'Company';
  const fullName = escape(fullNameRaw);
  const company = escape(companyRaw);
  const cardUrl = escape(opts.cardUrl);
  const companyUrl = normalizeUrl(data.companyUrl);
  const website2Url = normalizeUrl(data.website2);
  const customUrl = normalizeUrl(data.customLinkUrl);
  const customLabel = data.customLinkLabel || 'Learn more';
  const photo = escape(data.photoUrl);
  const logo = escape(data.logoUrl);
  const initials = `${(data.firstName[0] || 'A').toUpperCase()}${(data.lastName[0] || 'P').toUpperCase()}`;
  const addressLines = formatSignatureAddress(data);
  const directLine = (data.reportsTo.trim() || data.directLine.trim()).trim();

  const socials = (
    [
      ['facebook', data.facebook],
      ['instagram', data.instagram],
      ['linkedin', data.linkedin],
      ['youtube', data.youtube],
      ['twitter', data.twitter],
    ] as const
  )
    .map(([network, value]) => ({ network, url: normalizeSocial(network, value) }))
    .filter((s) => s.url);

  const mono = (() => {
    const parts = data.companyName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return (data.companyName.slice(0, 2) || 'CO').toUpperCase();
  })();

  const contactRow = (iconName: SignatureIconName, content: string) =>
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td width="22" valign="top" style="width:22px;padding:0 8px 8px 0;">
          <img src="${SIGNATURE_ICON_DATA_URIS[iconName]}" width="18" height="18" alt="" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:18px;height:18px;" />
        </td>
        <td valign="top" style="padding:2px 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;color:#111827;">
          ${content}
        </td>
      </tr>
    </table>`;

  const addressHtml = addressLines.length
    ? addressLines
        .map((line, i) => {
          const isLast = i === addressLines.length - 1 && addressLines.length > 1;
          const workIdx = line.lastIndexOf(' work');
          const hasWork = workIdx > 0 && workIdx === line.length - 5;
          const color = isLast ? '#4b5563' : '#111827';
          if (hasWork) {
            return `${text(line.slice(0, workIdx), { color })}${text(' work', { color: '#9ca3af', size: 10 })}`;
          }
          return text(line, { color });
        })
        .join('<br />')
    : '';

  const withMeta = (value: string, meta: string) =>
    `${text(value)}${text(` ${meta}`, { color: '#9ca3af', size: 10 })}`;

  const leftRows = [
    addressHtml ? contactRow('location', addressHtml) : '',
    data.cellPhone
      ? contactRow(
          'phone',
          linkedText(`tel:${data.cellPhone.replace(/[^\d+]/g, '')}`, withMeta(data.cellPhone, 'mobile')),
        )
      : '',
    data.email
      ? contactRow(
          'email',
          linkedText(`mailto:${data.email.trim()}`, text(data.email.trim())),
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const rightRows = [
    data.companyUrl.trim()
      ? contactRow(
          'web',
          companyUrl
            ? linkedText(
                companyUrl,
                text(displayUrlLabel(data.companyUrl) || displayUrlLabel(companyUrl) || 'website'),
              )
            : text(displayUrlLabel(data.companyUrl) || data.companyUrl.trim() || 'website'),
        )
      : '',
    data.website2.trim()
      ? contactRow(
          'web',
          website2Url
            ? linkedText(website2Url, text(displayUrlLabel(data.website2)))
            : text(displayUrlLabel(data.website2)),
        )
      : '',
    data.customLinkLabel.trim() || data.customLinkUrl.trim()
      ? contactRow(
          'link',
          customUrl
            ? linkedText(customUrl, text(customLabel || displayUrlLabel(data.customLinkUrl)))
            : text(
                customLabel || displayUrlLabel(data.customLinkUrl) || data.customLinkUrl.trim(),
              ),
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const nameBlock = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:16px;font-weight:700;color:#0f172a;">${text(fullNameRaw, { color: '#0f172a', size: 13, weight: 700 })}</div>`,
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;color:#1f2937;">${text(jobTitleRaw, { color: '#1f2937' })}</div>`,
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;color:#6b7280;font-style:italic;">${text(companyRaw, { color: '#6b7280', italic: true })}</div>`,
  ].join('');

  const photoCell = photo
    ? `<img src="${photo}" width="56" height="56" alt="" border="0" style="display:block;border:0;width:56px;height:56px;border-radius:12px;" />`
    : `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="#2437ff" style="width:56px;height:56px;background:#2437ff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;">${escape(initials)}</td></tr></table>`;

  const logoCell = logo
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td width="56" height="56" bgcolor="#16a34a" align="center" valign="middle" style="width:56px;height:56px;background-color:#16a34a;border-radius:50%;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="49" height="49" bgcolor="#ffffff" align="center" valign="middle" style="width:49px;height:49px;background-color:#ffffff;border-radius:50%;">
              <img src="${logo}" width="38" height="38" alt="${company}" border="0" style="display:block;border:0;width:38px;height:38px;" />
            </td>
          </tr></table>
        </td>
      </tr></table>`
    : `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="#16a34a" style="width:56px;height:56px;background:#16a34a;border-radius:50%;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="48" height="48" align="center" valign="middle" bgcolor="#ffffff" style="width:48px;height:48px;background:#ffffff;border-radius:50%;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;color:#2437ff;">${escape(mono)}</td></tr></table></td></tr></table>`;

  const socialIcons = socials
    .map(
      (s, i) =>
        `<td align="center" valign="middle" style="padding:0 ${i === socials.length - 1 ? '0' : '14px'} 0 0;font-size:0;line-height:0;border:0;">
          <a href="${escape(s.url)}" style="text-decoration:none;border:0;display:block;line-height:0;font-size:0;">
            <img src="${SIGNATURE_ICON_DATA_URIS[s.network as SignatureIconName]}" width="16" height="16" alt="" border="0" style="display:block;border:0;outline:none;width:16px;height:16px;margin:0;" />
          </a>
        </td>`,
    )
    .join('');

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="400" bgcolor="#ffffff" style="width:400px;max-width:100%;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #d5dae3;border-radius:16px;overflow:hidden;">
  <tr>
    <td width="400" bgcolor="#ffffff" style="width:400px;background-color:#ffffff;border-radius:16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:12px 14px 8px 14px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="56" valign="middle">${photoCell}</td>
                <td valign="middle" style="padding:0 8px;line-height:0;font-size:0;">${nameBlock}</td>
                <td width="56" valign="middle" align="right">${logoCell}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td height="1" bgcolor="#eef1f5" style="font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:10px 16px 0 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="176" valign="top" style="width:176px;">${leftRows}</td>
                <td width="20" style="width:20px;">&nbsp;</td>
                <td width="176" valign="top" style="width:176px;">${rightRows}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0;margin:0;border-top:1px solid #eef1f5;font-size:0;line-height:0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="40" style="border-collapse:collapse;width:100%;height:40px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" height="40" style="vertical-align:middle;height:40px;padding:0 0 0 14px;margin:0;font-size:0;line-height:0;border:0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" height="40" style="border-collapse:collapse;height:40px;">
                    <tr>
                      ${socialIcons || '<td height="40" style="height:40px;font-size:0;line-height:0;border:0;">&nbsp;</td>'}
                    </tr>
                  </table>
                </td>
                <td width="128" valign="top" height="40" align="right" style="vertical-align:top;width:128px;height:40px;padding:0;margin:0;font-size:0;line-height:0;border:0;">
                  <a href="${cardUrl}" style="display:block;text-decoration:none;border:0;line-height:0;font-size:0;">
                    <img src="${SAVE_CONTACT_BTN_DATA_URI}" width="128" height="40" alt="Save Contact" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:128px;height:40px;margin:0;padding:0;" />
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
