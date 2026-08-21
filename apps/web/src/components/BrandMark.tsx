type BrandLogoProps = {
  variant?: 'mark' | 'full';
  height?: number;
  className?: string;
  /** Invert dark wordmark for use on dark backgrounds */
  onDark?: boolean;
};

export function BrandLogo({
  variant = 'mark',
  height = 28,
  className = '',
  onDark = false,
}: BrandLogoProps) {
  if (variant === 'full') {
    const width = Math.round((278 / 53) * height);
    return (
      <img
        src="/brand/logo.svg"
        alt="Agency Partner Interactive"
        width={width}
        height={height}
        className={className}
        style={onDark ? { filter: 'brightness(0) invert(1)' } : undefined}
      />
    );
  }

  const width = Math.round((70 / 52) * height);
  return (
    <img
      src="/brand/logo-mark.svg"
      alt="Agency Partner Interactive"
      width={width}
      height={height}
      className={className}
    />
  );
}

/** @deprecated use BrandLogo */
export function BrandMark({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return <BrandLogo variant="mark" height={size} className={className} />;
}
