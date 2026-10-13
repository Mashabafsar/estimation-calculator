import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { AppError } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(
  process.env.SIGNATURE_UPLOAD_DIR || path.join(__dirname, '../../uploads'),
);
const SIGNATURE_DIR = path.join(UPLOAD_ROOT, 'signatures');
const MAX_BYTES = 10_000_000;
/** Store raster uploads at most this wide/tall so preview/SVG stays under librsvg limits. */
const STORE_MAX_EDGE = 1600;
const PUBLIC_PREFIX = '/api/uploads/signatures';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function ensureSafeRelative(name: string) {
  if (!/^[a-f0-9]{16,64}\.(jpg|png|gif|webp|svg)$/i.test(name)) {
    throw new AppError('Invalid media path', 400);
  }
  return name;
}

export function signatureUploadDir() {
  return SIGNATURE_DIR;
}

export function signatureUploadsRoot() {
  return UPLOAD_ROOT;
}

export async function ensureSignatureUploadDir() {
  await mkdir(SIGNATURE_DIR, { recursive: true });
}

export async function saveSignatureImage(opts: {
  buffer: Buffer;
  contentType?: string | null;
  filename?: string | null;
}) {
  if (!opts.buffer?.length) throw new AppError('Empty image', 400);
  if (opts.buffer.length > MAX_BYTES) throw new AppError('Image must be under 10MB', 400);

  let mime = (opts.contentType || '').split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') {
    mime = sniffMime(opts.buffer, opts.filename);
  }
  if (!MIME_EXT[mime]) throw new AppError('Unsupported image type', 400);

  const normalized = await normalizeRasterUpload(opts.buffer, mime);
  mime = normalized.mime;
  const ext = MIME_EXT[mime];
  if (!ext) throw new AppError('Unsupported image type', 400);

  await ensureSignatureUploadDir();
  const name = `${randomBytes(16).toString('hex')}.${ext}`;
  const abs = path.join(SIGNATURE_DIR, name);
  await writeFile(abs, normalized.buffer);

  return {
    url: `${PUBLIC_PREFIX}/${name}`,
    mime,
    bytes: normalized.buffer.length,
  };
}

/** Downscale/compress large rasters; leave small SVGs alone. */
async function normalizeRasterUpload(buffer: Buffer, mime: string) {
  if (mime.includes('svg')) return { buffer, mime };

  try {
    const image = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await image.metadata();
    const wide = Math.max(meta.width || 0, meta.height || 0);
    const needsResize = wide > STORE_MAX_EDGE || buffer.length > 1_200_000;
    if (!needsResize && (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp')) {
      return { buffer, mime };
    }

    const pipeline = needsResize
      ? image.resize({
          width: STORE_MAX_EDGE,
          height: STORE_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : image;

    // Prefer JPEG for photos — much smaller than PNG for email/SVG embedding.
    const out = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { buffer: out, mime: 'image/jpeg' };
  } catch {
    return { buffer, mime };
  }
}

function sniffMime(buf: Buffer, filename?: string | null) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const head = buf.subarray(0, Math.min(buf.length, 256)).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml';

  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return '';
}

type ResolveOpts = {
  /** Max width/height for SVG card embeds — avoids librsvg "Buffer size limit exceeded". */
  maxEdge?: number;
};

async function bufferFromMediaValue(raw: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (/^data:image\//i.test(raw)) {
    const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;
    return {
      mime: match[1].toLowerCase(),
      buffer: Buffer.from(match[2].replace(/\s+/g, ''), 'base64'),
    };
  }

  if (raw.startsWith(`${PUBLIC_PREFIX}/`)) {
    const name = ensureSafeRelative(raw.slice(PUBLIC_PREFIX.length + 1));
    const abs = path.join(SIGNATURE_DIR, name);
    const buffer = await readFile(abs);
    const byExt =
      Object.entries(MIME_EXT).find(([, e]) => name.toLowerCase().endsWith(`.${e}`))?.[0] || '';
    const mime = byExt || sniffMime(buffer, name) || 'application/octet-stream';
    return { buffer, mime };
  }

  if (/^https?:\/\//i.test(raw)) {
    const res = await fetch(raw);
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0];
    if (!mime.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_BYTES) return null;
    return { buffer, mime };
  }

  return null;
}

/** Resolve stored media to a data URL; optionally downscale for card SVG rendering. */
export async function resolveImageDataUrl(
  value?: string | null,
  opts: ResolveOpts = {},
): Promise<string> {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  const loaded = await bufferFromMediaValue(raw);
  if (!loaded) return '';

  const maxEdge = opts.maxEdge ?? 0;
  if (!maxEdge || loaded.mime.includes('svg')) {
    // Tiny SVGs are fine inline; huge rasters without maxEdge still need a safety resize.
    if (!loaded.mime.includes('svg') && loaded.buffer.length > 400_000) {
      try {
        const out = await sharp(loaded.buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
        return `data:image/jpeg;base64,${out.toString('base64')}`;
      } catch {
        /* fall through */
      }
    }
    return `data:${loaded.mime};base64,${loaded.buffer.toString('base64')}`;
  }

  try {
    const out = await sharp(loaded.buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return `data:${loaded.mime};base64,${loaded.buffer.toString('base64')}`;
  }
}
