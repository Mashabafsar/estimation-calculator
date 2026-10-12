import { randomBytes } from 'node:crypto';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  SAVE_CONTACT_BTN_DATA_URI,
  SIGNATURE_ICON_DATA_URIS,
  avatarInitialsDataUri,
  logoMonogramDataUri,
  signatureTextImage,
  type SignatureIconName,
} from './signature-icons.js';

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

const IMAGE_MAX = 2_500_000;

export type SignatureInput = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl?: string | null;
  logoUrl?: string | null;
  directLine?: string | null;
  cellPhone?: string | null;
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
  if (raw.startsWith('data:image/') || /^https?:\/\//i.test(raw)) {
    return raw.slice(0, IMAGE_MAX);
  }
  return '';
}

function normalizeSocial(network: SocialNetwork, value?: string | null) {
  const raw = strip(value, 300);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (!handle) return '';
  if (network === 'linkedin' && /^(in|company)\//i.test(handle)) {
    return `https://www.linkedin.com/${handle}`;
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

export function buildVcard(data: SignatureDto) {
  const socials: Array<[SocialNetwork, string]> = [
    ['facebook', normalizeSocial('facebook', data.facebook)],
    ['instagram', normalizeSocial('instagram', data.instagram)],
    ['linkedin', normalizeSocial('linkedin', data.linkedin)],
    ['youtube', normalizeSocial('youtube', data.youtube)],
    ['twitter', normalizeSocial('twitter', data.twitter)],
  ].filter(([, url]) => Boolean(url)) as Array<[SocialNetwork, string]>;

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const website2 = normalizeUrl(data.website2);
  const customLink = normalizeUrl(data.customLinkUrl);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(data.lastName)};${escapeVcard(data.firstName)};;;`,
    `FN:${escapeVcard(fullName)}`,
    `ORG:${escapeVcard(data.companyName)}`,
    data.jobTitle ? `TITLE:${escapeVcard(data.jobTitle)}` : null,
    data.directLine ? `TEL;TYPE=WORK,VOICE:${escapeVcard(data.directLine)}` : null,
    data.cellPhone ? `TEL;TYPE=CELL,VOICE:${escapeVcard(data.cellPhone)}` : null,
    data.email ? `EMAIL;TYPE=INTERNET,WORK:${escapeVcard(data.email)}` : null,
    `ADR;TYPE=WORK:;;${escapeVcard(data.companyStreet)};${escapeVcard(data.companyCity)};${escapeVcard(data.companyRegion)};${escapeVcard(data.companyPostal)};`,
    data.companyUrl ? `URL;TYPE=Work:${escapeVcard(data.companyUrl)}` : null,
    website2 ? `URL;TYPE=Website:${escapeVcard(website2)}` : null,
    customLink
      ? `URL;TYPE=${escapeVcard(data.customLinkLabel || 'Link')}:${escapeVcard(customLink)}`
      : null,
    // One entry per social — avoid duplicating as both X-SOCIALPROFILE and URL
    ...socials.map(
      ([network, url]) =>
        `X-SOCIALPROFILE;TYPE=${network === 'twitter' ? 'x' : network}:${escapeVcard(url)}`,
    ),
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

export function buildSignatureHtml(
  data: SignatureDto,
  opts: { cardUrl: string; assetBase: string },
) {
  const escape = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Text as SVG <img> — Mail/Gmail ignore CSS font-size on paste; images keep exact size
  const textImg = (
    lines: Parameters<typeof signatureTextImage>[0],
    imgOpts?: Parameters<typeof signatureTextImage>[1],
  ) => {
    const img = signatureTextImage(lines, imgOpts);
    return `<img src="${img.src}" width="${img.width}" height="${img.height}" alt="${escape(img.alt)}" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:${img.width}px;height:${img.height}px;" />`;
  };

  const linkedText = (
    href: string,
    lines: Parameters<typeof signatureTextImage>[0],
    imgOpts?: Parameters<typeof signatureTextImage>[1],
  ) => {
    const img = signatureTextImage(lines, imgOpts);
    return `<a href="${escape(href)}" style="text-decoration:none;border:0;outline:none;"><img src="${img.src}" width="${img.width}" height="${img.height}" alt="${escape(img.alt)}" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:${img.width}px;height:${img.height}px;" /></a>`;
  };

  const fullNameRaw = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Name';
  const jobTitleRaw = data.jobTitle || 'Job title';
  const companyRaw = data.companyName || 'Company';
  const fullName = escape(fullNameRaw);
  const company = escape(companyRaw);
  const cardUrl = escape(opts.cardUrl);
  const assetBase = opts.assetBase.replace(/\/$/, '');
  const icon = (name: SignatureIconName) =>
    SIGNATURE_ICON_DATA_URIS[name] || `${assetBase}/esignature/icons/${name}.svg`;
  const companyUrl = normalizeUrl(data.companyUrl);
  const website2Url = normalizeUrl(data.website2);
  const customUrl = normalizeUrl(data.customLinkUrl);
  const customLabel = data.customLinkLabel || 'Learn more';
  const photo = escape(data.photoUrl);
  const logo = escape(data.logoUrl);
  const initials = `${(data.firstName[0] || 'A').toUpperCase()}${(data.lastName[0] || 'P').toUpperCase()}`;
  const addressLines = formatSignatureAddress(data);

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
          <img src="${icon(iconName)}" width="18" height="18" alt="" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:18px;height:18px;" />
        </td>
        <td valign="top" style="padding:1px 0 8px 0;line-height:0;font-size:0;">
          ${content}
        </td>
      </tr>
    </table>`;

  const addressImg = addressLines.length
    ? textImg(
        addressLines.map((line, i) => {
          const isLast = i === addressLines.length - 1 && addressLines.length > 1;
          const workIdx = line.lastIndexOf(' work');
          const hasWork = workIdx > 0 && workIdx === line.length - 5;
          if (hasWork) {
            return [
              { text: line.slice(0, workIdx), color: isLast ? '#4b5563' : '#111827', size: 11 },
              { text: ' work', color: '#9ca3af', size: 10 },
            ];
          }
          return [{ text: line, color: isLast ? '#4b5563' : '#111827', size: 11 }];
        }),
        { maxWidth: 168, lineHeight: 14 },
      )
    : '';

  const leftRows = [
    addressImg ? contactRow('location', addressImg) : '',
    data.cellPhone
      ? contactRow(
          'phone',
          linkedText(
            `tel:${data.cellPhone.replace(/[^\d+]/g, '')}`,
            [
              [
                { text: data.cellPhone, color: '#111827', size: 11 },
                { text: ' mobile', color: '#9ca3af', size: 10 },
              ],
            ],
            { maxWidth: 168, lineHeight: 14 },
          ),
        )
      : '',
    data.email
      ? contactRow(
          'email',
          linkedText(
            `mailto:${data.email.trim()}`,
            [[{ text: data.email.trim(), color: '#111827', size: 11 }]],
            { maxWidth: 168, lineHeight: 14 },
          ),
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
                [
                  [
                    {
                      text: displayUrlLabel(data.companyUrl) || displayUrlLabel(companyUrl) || 'website',
                      color: '#111827',
                      size: 11,
                    },
                  ],
                ],
                { maxWidth: 168, lineHeight: 14 },
              )
            : textImg(
                [
                  [
                    {
                      text: displayUrlLabel(data.companyUrl) || data.companyUrl.trim() || 'website',
                      color: '#111827',
                      size: 11,
                    },
                  ],
                ],
                { maxWidth: 168, lineHeight: 14 },
              ),
        )
      : '',
    data.website2.trim()
      ? contactRow(
          'web',
          website2Url
            ? linkedText(
                website2Url,
                [[{ text: displayUrlLabel(data.website2), color: '#111827', size: 11 }]],
                { maxWidth: 168, lineHeight: 14 },
              )
            : textImg(
                [[{ text: displayUrlLabel(data.website2), color: '#111827', size: 11 }]],
                { maxWidth: 168, lineHeight: 14 },
              ),
        )
      : '',
    data.customLinkLabel.trim() || data.customLinkUrl.trim()
      ? contactRow(
          'link',
          customUrl
            ? linkedText(
                customUrl,
                [
                  [
                    {
                      text: customLabel || displayUrlLabel(data.customLinkUrl),
                      color: '#111827',
                      size: 11,
                    },
                  ],
                ],
                { maxWidth: 168, lineHeight: 14 },
              )
            : textImg(
                [
                  [
                    {
                      text:
                        customLabel ||
                        displayUrlLabel(data.customLinkUrl) ||
                        data.customLinkUrl.trim(),
                      color: '#111827',
                      size: 11,
                    },
                  ],
                ],
                { maxWidth: 168, lineHeight: 14 },
              ),
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const nameBlock = [
    textImg([[{ text: fullNameRaw, color: '#0f172a', size: 13, weight: 700 }]], {
      maxWidth: 220,
      lineHeight: 16,
    }),
    textImg([[{ text: jobTitleRaw, color: '#1f2937', size: 11 }]], { maxWidth: 220, lineHeight: 14 }),
    textImg([[{ text: companyRaw, color: '#6b7280', size: 11, italic: true }]], {
      maxWidth: 220,
      lineHeight: 14,
    }),
  ].join('');

  const photoCell = photo
    ? `<img src="${photo}" width="56" height="56" alt="" border="0" style="display:block;border:0;width:56px;height:56px;border-radius:12px;" />`
    : `<img src="${avatarInitialsDataUri(initials)}" width="56" height="56" alt="${fullName}" border="0" style="display:block;border:0;width:56px;height:56px;" />`;

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
    : `<img src="${logoMonogramDataUri(mono)}" width="56" height="56" alt="${company}" border="0" style="display:block;border:0;width:56px;height:56px;" />`;

  const socialIcons = socials
    .map(
      (s) =>
        `<a href="${escape(s.url)}" style="text-decoration:none;border:0;"><img src="${icon(s.network as SignatureIconName)}" width="16" height="16" alt="" border="0" style="display:inline-block;border:0;outline:none;width:16px;height:16px;margin:0 12px 0 0;" /></a>`,
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
          <td style="padding:12px 16px 2px 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="176" valign="top" style="width:176px;">${leftRows}</td>
                <td width="20" style="width:20px;">&nbsp;</td>
                <td width="176" valign="top" style="width:176px;">${rightRows}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td height="1" bgcolor="#eef1f5" style="font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td valign="middle" style="padding:10px 8px 4px 14px;">${socialIcons || '&nbsp;'}</td>
                <td width="128" align="right" valign="bottom" style="width:128px;padding:0;line-height:0;font-size:0;">
                  <a href="${cardUrl}" style="display:block;text-decoration:none;border:0;line-height:0;">
                    <img src="${SAVE_CONTACT_BTN_DATA_URI}" width="128" height="40" alt="Save Contact" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:128px;height:40px;margin:0;" />
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
