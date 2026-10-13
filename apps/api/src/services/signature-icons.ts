/** Email-safe SVG icons as data URIs (same artwork as apps/web/public/esignature/icons/*.svg) */

function svgDataUri(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

const CONTACT_BG = '#2437ff';
const INK = '#111827';

export const SIGNATURE_ICON_SVGS = {
  location: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><path d="M12 18.2s-4.4-3.9-4.4-7.2a4.4 4.4 0 1 1 8.8 0c0 3.3-4.4 7.2-4.4 7.2Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10.8" r="1.5" fill="#fff"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><rect x="8.5" y="5.5" width="7" height="13" rx="1.6" stroke="#fff" stroke-width="1.6"/><path d="M10.2 7.2h3.6" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="15.8" r="0.85" fill="#fff"/></svg>`,
  email: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><rect x="5.5" y="7.5" width="13" height="9" rx="1.6" stroke="#fff" stroke-width="1.6"/><path d="M6.6 8.8 12 12.8l5.4-4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  web: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><rect x="5.5" y="7.2" width="13" height="9.6" rx="1.6" stroke="#fff" stroke-width="1.6"/><path d="M5.5 10.2h13" stroke="#fff" stroke-width="1.5"/><path d="M8.2 13h4.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M8.2 15.2h6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><path d="M9.6 13.5a2.7 2.7 0 0 1 0-3.8l1.5-1.5a2.7 2.7 0 0 1 3.8 3.8l-.5.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.4 10.5a2.7 2.7 0 0 1 0 3.8l-1.5 1.5a2.7 2.7 0 1 1-3.8-3.8l.5-.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  person: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="${CONTACT_BG}"/><circle cx="12" cy="9" r="3.1" stroke="#fff" stroke-width="1.6"/><path d="M6.8 18.2c.9-2.6 3-4 5.2-4s4.3 1.4 5.2 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${INK}"><path d="M14.2 8.2h1.8V5.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v1.7H8.2v2.9h1.9V20h3.1v-6.1h2.1l.3-2.9h-2.4V9.5c0-.8.2-1.3 1.2-1.3Z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="${INK}" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="${INK}"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${INK}"><path d="M6.4 9.2H3.8V20h2.6V9.2ZM5.1 4c-.9 0-1.6.7-1.6 1.6S4.2 7.2 5.1 7.2s1.6-.7 1.6-1.6S6 4 5.1 4ZM20.2 20h-2.6v-5.4c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.2-.1.6-.1.9V20h-2.6V9.2h2.5v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.9 1.4 3.9 4.5V20Z"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path fill="${INK}" d="M21.2 8.1a2.5 2.5 0 0 0-1.8-1.8C17.7 5.8 12 5.8 12 5.8s-5.7 0-7.4.5A2.5 2.5 0 0 0 2.8 8.1 26 26 0 0 0 2.4 12a26 26 0 0 0 .4 3.9 2.5 2.5 0 0 0 1.8 1.8c1.7.5 7.4.5 7.4.5s5.7 0 7.4-.5a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-3.9 26 26 0 0 0-.4-3.9Z"/><path fill="#fff" d="M10.4 14.8V9.2L15.2 12l-4.8 2.8Z"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${INK}"><path d="M4 4.8h3.5l4 5.4L16.4 4.8H20l-6.1 7.1L20.4 19.2h-3.5l-4.4-5.9-5 5.9H4l6.6-7.6L4 4.8Z"/></svg>`,
} as const;

export type SignatureIconName = keyof typeof SIGNATURE_ICON_SVGS;

export const SIGNATURE_ICON_DATA_URIS = Object.fromEntries(
  (Object.keys(SIGNATURE_ICON_SVGS) as SignatureIconName[]).map((name) => [
    name,
    svgDataUri(SIGNATURE_ICON_SVGS[name]),
  ]),
) as Record<SignatureIconName, string>;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Blue avatar with white initials — baked into SVG so email clients keep colors */
export function avatarInitialsDataUri(initials: string) {
  const text = escapeXml((initials || 'AP').slice(0, 3).toUpperCase());
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <rect width="56" height="56" rx="12" fill="${CONTACT_BG}"/>
      <text x="28" y="36" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700">${text}</text>
    </svg>`,
  );
}

/** Green-ring logo monogram matching SignatureCard BrandLogo */
export function logoMonogramDataUri(mono: string) {
  const text = escapeXml((mono || 'CO').slice(0, 3).toUpperCase());
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="28" fill="#16a34a"/>
      <circle cx="28" cy="28" r="24.5" fill="#eef2ff"/>
      <text x="28" y="33" text-anchor="middle" fill="${CONTACT_BG}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800">${text}</text>
    </svg>`,
  );
}

/** Save Contact control — SVG shape (not PNG). TL cut + BR card corner survive paste. */
export function saveContactBtnDataUri() {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="40" viewBox="0 0 128 40">
      <path d="M20 0H128V24C128 32.837 120.837 40 112 40H0V20C0 8.954 8.954 0 20 0Z" fill="${CONTACT_BG}"/>
      <text x="64" y="25" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="0.9">SAVE CONTACT</text>
    </svg>`,
  );
}

export const SAVE_CONTACT_BTN_DATA_URI = saveContactBtnDataUri();

export type SignatureTextPart = {
  text: string;
  color?: string;
  size?: number;
  weight?: number | string;
  italic?: boolean;
};

/** Measure approximate Arial text width in SVG px */
function measureTextWidth(text: string, size: number, weight: number | string = 400) {
  const bold = Number(weight) >= 600 || weight === 'bold';
  return Math.ceil(Math.max(1, text.length) * size * (bold ? 0.62 : 0.55));
}

/**
 * Bake signature copy into an SVG <img> so Mail/Gmail cannot inflate font-size on paste.
 * Icons already use this approach; text must too when clients ignore CSS/pt.
 */
export function signatureTextImage(
  lines: SignatureTextPart[][],
  opts: { maxWidth?: number; lineHeight?: number } = {},
) {
  const maxWidth = opts.maxWidth ?? 168;
  const defaultSize = 11;
  const lineHeight = opts.lineHeight ?? 14;

  const normalized = lines
    .map((parts) =>
      parts
        .map((p) => ({
          text: p.text,
          color: p.color || INK,
          size: p.size ?? defaultSize,
          weight: p.weight ?? 400,
          italic: Boolean(p.italic),
        }))
        .filter((p) => p.text.length > 0),
    )
    .filter((parts) => parts.length > 0);

  if (normalized.length === 0) {
    return { src: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`), width: 1, height: 1, alt: '' };
  }

  let width = 1;
  for (const parts of normalized) {
    const w = parts.reduce((sum, p) => sum + measureTextWidth(p.text, p.size, p.weight), 0);
    width = Math.max(width, Math.min(maxWidth, w + 2));
  }
  const height = Math.max(lineHeight, normalized.length * lineHeight);

  const textNodes = normalized
    .map((parts, row) => {
      const y = Math.round(row * lineHeight + defaultSize);
      let x = 0;
      const runs = parts
        .map((p) => {
          const node = `<text x="${x}" y="${y}" fill="${p.color}" font-family="Arial,Helvetica,sans-serif" font-size="${p.size}" font-weight="${p.weight}" font-style="${p.italic ? 'italic' : 'normal'}">${escapeXml(p.text)}</text>`;
          x += measureTextWidth(p.text, p.size, p.weight);
          return node;
        })
        .join('');
      return runs;
    })
    .join('');

  const alt = normalized.map((parts) => parts.map((p) => p.text).join('')).join('\n');
  const src = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${textNodes}</svg>`,
  );
  return { src, width, height, alt };
}
