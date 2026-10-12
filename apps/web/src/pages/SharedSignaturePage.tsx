import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  Facebook,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  MapPin,
  Smartphone,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  displayHost,
  normalizeSite,
  socialCardRows,
  type SavedSignature,
} from '../lib/signatures';

type RowIcon =
  | 'location'
  | 'phone'
  | 'email'
  | 'web'
  | 'link'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'twitter';

const ROW_ICONS: Record<RowIcon, LucideIcon> = {
  location: MapPin,
  phone: Smartphone,
  email: Mail,
  web: Globe,
  link: Link2,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
};

function CircleIcon({ type, index = 0 }: { type: RowIcon; index?: number }) {
  const Icon = ROW_ICONS[type];
  return (
    <span
      className="card-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b4dff] to-[#2437ff] text-white shadow-[0_6px_16px_rgba(36,55,255,0.28)] ring-4 ring-[#2437ff]/10"
      style={{ animationDelay: `${140 + index * 55}ms` }}
      aria-hidden
    >
      <Icon size={20} strokeWidth={2.25} className="drop-shadow-sm" />
    </span>
  );
}

function ContactRow({
  icon,
  href,
  meta,
  index,
  children,
}: {
  icon: RowIcon;
  href?: string;
  meta?: string;
  index: number;
  children: React.ReactNode;
}) {
  const className =
    'contact-row group flex items-start gap-4 rounded-2xl px-2 py-2.5 transition-colors duration-200 hover:bg-[#f7fafc]';
  const style = { animationDelay: `${120 + index * 55}ms` } as const;

  const body = (
    <>
      <CircleIcon type={icon} index={index} />
      <span className="min-w-0 pt-1">
        <span className="block text-[17px] leading-6 font-medium text-[#1a202c] break-words transition-colors group-hover:text-[#2437ff]">
          {children}
        </span>
        {meta ? (
          <span className="mt-0.5 block text-[13px] leading-4 text-[#a0aec0]">{meta}</span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <li className={className} style={style}>
        <a
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          className="flex w-full items-start gap-4"
        >
          {body}
        </a>
      </li>
    );
  }

  return (
    <li className={className} style={style}>
      {body}
    </li>
  );
}

function companyMonogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return (name.slice(0, 2) || 'CO').toUpperCase();
}

export function SharedSignaturePage() {
  const { slug } = useParams();
  const [data, setData] = useState<SavedSignature | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    api<SavedSignature>(`/signatures/share/${slug}`)
      .then(setData)
      .catch((err) => setError(err?.message || 'Signature not found'));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-full grid place-items-center bg-[#f7fafc] p-8">
        <div className="max-w-md space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#1a202c]">Card unavailable</h1>
          <p className="text-sm text-[#718096]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full grid place-items-center bg-[#f7fafc] p-8 text-[#718096]">
        Loading card…
      </div>
    );
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim() || 'Contact';
  const initials = `${(data.firstName?.[0] || 'A').toUpperCase()}${(data.lastName?.[0] || 'P').toUpperCase()}`;
  const vcardUrl = `${import.meta.env.VITE_API_URL || '/api'}/signatures/share/${data.shareSlug}/vcard`;
  const street = data.companyStreet.replace(/\s+/g, ' ').trim();
  const cityLine = `${data.companyCity}, ${data.companyRegion} ${data.companyPostal}`
    .replace(/\s+/g, ' ')
    .trim();
  const mapQuery = [street, cityLine].filter(Boolean).join(', ');
  const mapsHref = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';
  const website = displayHost(data.companyUrl);
  const websiteHref = normalizeSite(data.companyUrl);
  const website2 = displayHost(data.website2);
  const website2Href = normalizeSite(data.website2);
  const customHref = normalizeSite(data.customLinkUrl);
  const socials = socialCardRows(data);
  const mono = companyMonogram(data.companyName || 'Company');

  let row = 0;
  const nextIndex = () => row++;

  return (
    <main className="min-h-full bg-[#edf2f7]">
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.04)]">
        <header className="hero-block flex flex-col items-center px-6 pt-10 pb-6 text-center">
          <div className="avatar-wrap relative mb-5">
            {data.photoUrl ? (
              <img
                src={data.photoUrl}
                alt={fullName}
                className="avatar-main h-[148px] w-[148px] rounded-[28px] object-cover shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
              />
            ) : (
              <div className="avatar-main grid h-[148px] w-[148px] place-items-center rounded-[28px] bg-gradient-to-br from-[#3b4dff] to-[#1e2fd9] text-[42px] font-bold text-white shadow-[0_12px_32px_rgba(36,55,255,0.28)]">
                {initials}
              </div>
            )}
            <div className="logo-badge absolute -right-1 -bottom-1 grid h-14 w-14 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md">
              {data.logoUrl ? (
                <img src={data.logoUrl} alt={data.companyName} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[13px] font-extrabold tracking-tight text-[#2437ff]">{mono}</span>
              )}
            </div>
          </div>

          <h1 className="m-0 text-[28px] leading-tight font-bold tracking-[-0.02em] text-[#1a202c]">
            {fullName}
          </h1>
          {data.jobTitle ? (
            <p className="mt-1.5 m-0 text-[16px] leading-snug text-[#4a5568]">{data.jobTitle}</p>
          ) : null}
          {data.companyName ? (
            <p className="mt-1 m-0 text-[15px] leading-snug text-[#718096]">{data.companyName}</p>
          ) : null}
        </header>

        {data.tagline ? (
          <section className="tagline-block px-6 pb-6 text-center">
            <p className="m-0 text-[15px] leading-6 text-[#4a5568]">{data.tagline}</p>
          </section>
        ) : null}

        <ul className="flex-1 space-y-0.5 px-5 pb-4">
          {street || cityLine ? (
            <ContactRow
              icon="location"
              meta="work"
              index={nextIndex()}
              href={mapsHref || undefined}
            >
              {street ? <span className="block">{street}</span> : null}
              {cityLine ? <span className="block">{cityLine}</span> : null}
            </ContactRow>
          ) : null}

          {data.cellPhone ? (
            <ContactRow
              icon="phone"
              meta="mobile"
              index={nextIndex()}
              href={`tel:${data.cellPhone.replace(/[^\d+]/g, '')}`}
            >
              {data.cellPhone}
            </ContactRow>
          ) : null}

          {data.email ? (
            <ContactRow icon="email" index={nextIndex()} href={`mailto:${data.email}`}>
              {data.email}
            </ContactRow>
          ) : null}

          {website ? (
            <ContactRow icon="web" index={nextIndex()} href={websiteHref || undefined}>
              {website}
            </ContactRow>
          ) : null}

          {website2 ? (
            <ContactRow icon="web" index={nextIndex()} href={website2Href || undefined}>
              {website2}
            </ContactRow>
          ) : null}

          {data.customLinkLabel.trim() || data.customLinkUrl.trim() ? (
            <ContactRow icon="link" index={nextIndex()} href={customHref || undefined}>
              {data.customLinkLabel || displayHost(data.customLinkUrl) || 'Learn more'}
            </ContactRow>
          ) : null}

          {socials.map((s) => (
            <ContactRow key={s.network} icon={s.network} index={nextIndex()} href={s.url}>
              {s.label}
            </ContactRow>
          ))}
        </ul>

        <div className="cta-block mt-auto">
          <div className="border-t border-[#edf2f7] bg-white px-5 py-4">
            <a
              href={vcardUrl}
              className="save-btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#2437ff] py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(36,55,255,0.28)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <Download size={18} strokeWidth={2.4} className="save-icon" />
              Save Contact
            </a>
          </div>
          <footer className="bg-[#2437ff] px-4 py-3.5 text-center text-[12px] font-medium text-white/95">
            Digital business card
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.72); }
          70% { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes badgeIn {
          0% { opacity: 0; transform: scale(0.4) rotate(-12deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes iconIn {
          0% { opacity: 0; transform: scale(0.5); }
          65% { transform: scale(1.12); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes shine {
          0% { transform: translateX(-120%) skewX(-18deg); }
          100% { transform: translateX(220%) skewX(-18deg); }
        }
        @keyframes iconBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        .hero-block { animation: fadeUp 0.5s ease-out both; }
        .tagline-block { animation: fadeUp 0.55s ease-out 0.08s both; }
        .avatar-main { animation: popIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .logo-badge { animation: badgeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both; }
        .contact-row { opacity: 0; animation: fadeUp 0.45s ease-out both; }
        .card-icon { animation: iconIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .cta-block { animation: fadeUp 0.5s ease-out 0.35s both; }

        .contact-row:hover .card-icon {
          transform: scale(1.08);
          box-shadow: 0 8px 20px rgba(36, 55, 255, 0.36);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-icon { transition: transform 0.2s ease, box-shadow 0.2s ease; }

        .save-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          transform: translateX(-120%) skewX(-18deg);
        }
        .save-btn:hover::after { animation: shine 0.7s ease; }
        .save-btn:hover .save-icon { animation: iconBob 0.7s ease; }

        @media (prefers-reduced-motion: reduce) {
          .hero-block, .tagline-block, .avatar-main, .logo-badge,
          .contact-row, .card-icon, .cta-block {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .save-btn::after, .save-btn:hover .save-icon { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
