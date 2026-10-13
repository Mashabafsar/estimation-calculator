import {
  displayHost,
  formatSignatureAddress,
  normalizeSite,
  socialLinks,
  type SignatureForm,
} from '../lib/signatures';

type Props = {
  data: SignatureForm;
  saveHref?: string;
  compact?: boolean;
};

type ContactIconType = 'location' | 'phone' | 'email' | 'web' | 'link' | 'person';

function ContactIcon({ type }: { type: ContactIconType }) {
  const paths: Record<ContactIconType, React.ReactNode> = {
    location: (
      <>
        <path d="M12 21s-6.2-5.4-6.2-10.2a6.2 6.2 0 1 1 12.4 0C18.2 15.6 12 21 12 21Z" />
        <circle cx="12" cy="10.6" r="2.2" fill="#2437ff" stroke="none" />
      </>
    ),
    phone: (
      <>
        <rect x="8" y="4.5" width="8" height="15" rx="1.8" />
        <path d="M10.2 6.4h3.6" strokeLinecap="round" />
        <circle cx="12" cy="16.8" r="0.9" fill="white" stroke="none" />
      </>
    ),
    email: (
      <>
        <rect x="4.5" y="7" width="15" height="10.5" rx="2" />
        <path d="M5.5 8.2 12 12.6 18.5 8.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    web: (
      <>
        <rect x="5" y="7.2" width="14" height="10" rx="1.8" />
        <path d="M5 10.2h14" />
        <path d="M8.2 13.2h4.4" strokeLinecap="round" />
        <path d="M8.2 15.4h6.2" strokeLinecap="round" />
      </>
    ),
    link: (
      <>
        <path
          d="M9.4 13.8a3.2 3.2 0 0 1 0-4.5l1.7-1.7a3.2 3.2 0 0 1 4.5 4.5l-.7.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.6 10.2a3.2 3.2 0 0 1 0 4.5l-1.7 1.7a3.2 3.2 0 1 1-4.5-4.5l.7-.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="9" r="3.2" />
        <path d="M6.5 18.2c.9-2.7 3.1-4.1 5.5-4.1s4.6 1.4 5.5 4.1" strokeLinecap="round" />
      </>
    ),
  };

  return (
    <span
      className="mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#2437ff] text-white shadow-[0_1px_3px_rgba(36,55,255,0.3)]"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        className="block"
      >
        {paths[type]}
      </svg>
    </span>
  );
}

function SocialIcon({ network }: { network: keyof typeof socialGlyphs }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" className="block" aria-hidden>
      {socialGlyphs[network]}
    </svg>
  );
}

const socialGlyphs = {
  facebook: (
    <path
      fill="currentColor"
      d="M14.2 8.2h1.8V5.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v1.7H8.2v2.9h1.9V20h3.1v-6.1h2.1l.3-2.9h-2.4V9.5c0-.8.2-1.3 1.2-1.3Z"
    />
  ),
  instagram: (
    <>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </>
  ),
  linkedin: (
    <path
      fill="currentColor"
      d="M6.4 9.2H3.8V20h2.6V9.2ZM5.1 4c-.9 0-1.6.7-1.6 1.6S4.2 7.2 5.1 7.2s1.6-.7 1.6-1.6S6 4 5.1 4ZM20.2 20h-2.6v-5.4c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.2-.1.6-.1.9V20h-2.6V9.2h2.5v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.9 1.4 3.9 4.5V20Z"
    />
  ),
  youtube: (
    <>
      <path
        fill="currentColor"
        d="M21.2 8.1a2.5 2.5 0 0 0-1.8-1.8C17.7 5.8 12 5.8 12 5.8s-5.7 0-7.4.5A2.5 2.5 0 0 0 2.8 8.1 26 26 0 0 0 2.4 12a26 26 0 0 0 .4 3.9 2.5 2.5 0 0 0 1.8 1.8c1.7.5 7.4.5 7.4.5s5.7 0 7.4-.5a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-3.9 26 26 0 0 0-.4-3.9Z"
      />
      <path fill="white" d="M10.4 14.8V9.2L15.2 12l-4.8 2.8Z" />
    </>
  ),
  twitter: (
    <path
      fill="currentColor"
      d="M4 4.8h3.5l4 5.4L16.4 4.8H20l-6.1 7.1L20.4 19.2h-3.5l-4.4-5.9-5 5.9H4l6.6-7.6L4 4.8Z"
    />
  ),
} as const;

function companyMonogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'CO').toUpperCase();
}

function BrandLogo({
  src,
  companyName,
}: {
  src?: string;
  companyName: string;
}) {
  const mono = companyMonogram(companyName || 'Company');

  if (src) {
    return (
      <div className="relative h-14 w-14 justify-self-end shrink-0" title={companyName}>
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 200deg, #22c55e 0%, #16a34a 28%, #2437ff 62%, #60a5fa 82%, #22c55e 100%)',
          }}
        />
        <div className="absolute inset-[2.5px] rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] grid place-items-center overflow-hidden p-1">
          <img src={src} alt={companyName} className="h-full w-full object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-14 w-14 justify-self-end shrink-0"
      title={companyName}
      aria-label={`${companyName} logo`}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 210deg, #16a34a 0%, #4ade80 24%, #2437ff 55%, #93c5fd 78%, #16a34a 100%)',
        }}
      />
      <div className="absolute inset-[2.5px] rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#eef2ff_45%,#dbeafe_100%)] grid place-items-center shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]">
        <span className="text-[12px] font-extrabold tracking-tight text-[#2437ff] leading-none">
          {mono}
        </span>
      </div>
    </div>
  );
}

function Row({
  icon,
  children,
  meta,
}: {
  icon: ContactIconType;
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <li className="flex gap-2.5 items-start">
      <ContactIcon type={icon} />
      <div className="min-w-0 pt-0.5 text-[9px] leading-[12px] text-[#111827]">
        <span className="break-words">{children}</span>
        {meta ? <span className="ml-1 text-[8px] text-[#9ca3af]">{meta}</span> : null}
      </div>
    </li>
  );
}

export function SignatureCard({ data, saveHref, compact }: Props) {
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Name';
  const initials = `${(data.firstName?.[0] || 'A').toUpperCase()}${(data.lastName?.[0] || 'P').toUpperCase()}`;
  const socials = socialLinks(data);
  const website = displayHost(data.companyUrl);
  const website2 = displayHost(data.website2);
  const website2Href = normalizeSite(data.website2);
  const customHref = normalizeSite(data.customLinkUrl);
  const addressLines = formatSignatureAddress(data).lines;

  return (
    <article className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-[#d5dae3] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <header className="grid grid-cols-[56px_1fr_56px] gap-2.5 items-center px-3.5 pt-3 pb-2">
        {data.photoUrl ? (
          <img
            src={data.photoUrl}
            alt={fullName}
            className="h-14 w-14 object-cover rounded-[12px] bg-slate-100"
          />
        ) : (
          <div className="h-14 w-14 rounded-[12px] bg-[#2437ff] text-white grid place-items-center text-base font-bold">
            {initials}
          </div>
        )}

        <div className="min-w-0 leading-none">
          <h2 className="m-0 text-[13px] leading-[15px] font-bold text-[#0f172a] truncate">{fullName}</h2>
          <p className="m-0 text-[10px] leading-[12px] text-[#1f2937] truncate">
            {data.jobTitle || 'Job title'}
          </p>
          <p className="m-0 text-[10px] leading-[12px] italic text-[#6b7280] truncate">
            {data.companyName}
          </p>
        </div>

        <BrandLogo src={data.logoUrl} companyName={data.companyName} />
      </header>

      {!compact && data.tagline ? (
        <p className="px-4 pb-2 text-[11px] leading-4 text-[#6b7280] line-clamp-2">
          {data.tagline}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 px-4 py-3 border-t border-[#eef1f5]">
        <ul className="space-y-2.5 min-w-0">
          <li className="flex gap-2.5 items-start">
            <ContactIcon type="location" />
            <div className="min-w-0 pt-0.5 text-[9px] leading-[12px] text-[#111827]">
              {addressLines.map((line, i) => {
                const isLast = i === addressLines.length - 1 && addressLines.length > 1;
                const workIdx = line.lastIndexOf(' work');
                const hasWork = workIdx > 0 && workIdx === line.length - 5;
                return (
                  <div
                    key={`${line}-${i}`}
                    className={isLast ? 'text-[#4b5563]' : undefined}
                  >
                    {hasWork ? (
                      <>
                        {line.slice(0, workIdx)}{' '}
                        <span className="text-[8px] text-[#9ca3af]">work</span>
                      </>
                    ) : (
                      line
                    )}
                  </div>
                );
              })}
            </div>
          </li>
          {data.cellPhone ? (
            <Row icon="phone" meta="mobile">
              <a
                className="hover:text-[#2437ff]"
                href={`tel:${data.cellPhone.replace(/[^\d+]/g, '')}`}
              >
                {data.cellPhone}
              </a>
            </Row>
          ) : null}
          {(data.reportsTo.trim() || data.directLine.trim()) ? (
            <Row icon="phone" meta="direct line">
              <a
                className="hover:text-[#2437ff]"
                href={`tel:${(data.reportsTo.trim() || data.directLine.trim()).replace(/[^\d+]/g, '')}`}
              >
                {data.reportsTo.trim() || data.directLine.trim()}
              </a>
            </Row>
          ) : null}
          {data.email ? (
            <Row icon="email">
              <a className="hover:text-[#2437ff] break-all" href={`mailto:${data.email}`}>
                {data.email}
              </a>
            </Row>
          ) : null}
        </ul>

        <ul className="space-y-2.5 min-w-0">
          <Row icon="web">
            <a
              className="hover:text-[#2437ff] break-all"
              href={data.companyUrl}
              target="_blank"
              rel="noreferrer"
            >
              {website || 'website'}
            </a>
          </Row>
          {website2 ? (
            <Row icon="web">
              {website2Href ? (
                <a
                  className="hover:text-[#2437ff] break-all"
                  href={website2Href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {website2}
                </a>
              ) : (
                <span className="break-all">{website2}</span>
              )}
            </Row>
          ) : null}
          {data.customLinkLabel.trim() || data.customLinkUrl.trim() ? (
            <Row icon="link">
              {customHref ? (
                <a
                  className="hover:text-[#2437ff] break-words"
                  href={customHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.customLinkLabel || displayHost(data.customLinkUrl) || 'Learn more'}
                </a>
              ) : (
                <span className="break-words">
                  {data.customLinkLabel || displayHost(data.customLinkUrl) || 'Learn more'}
                </span>
              )}
            </Row>
          ) : null}
        </ul>
      </div>

      <footer className="flex h-10 items-center border-t border-[#eef1f5] pl-3.5 pr-0">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {socials.map((s) => (
            <a
              key={s.network}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-[#111827] transition-colors hover:text-[#2437ff]"
              aria-label={s.label}
            >
              <SocialIcon network={s.network} />
            </a>
          ))}
        </div>
        {saveHref ? (
          <a
            href={saveHref}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-tl-[20px] rounded-br-2xl bg-[#2437ff] px-4 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-white hover:brightness-110"
          >
            Save Contact
          </a>
        ) : (
          <div className="inline-flex h-10 shrink-0 items-center justify-center rounded-tl-[20px] rounded-br-2xl bg-[#2437ff] px-4 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-white">
            Save Contact
          </div>
        )}
      </footer>
    </article>
  );
}
