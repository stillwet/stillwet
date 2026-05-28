import Link from "next/link";
import { StillWetLogo } from "@/components/StillWetLogo";
import { BRAND_LOGO_MARK, BRAND_NAME } from "@/lib/site-brand";

type BrandLogoLinkProps = {
  href?: string;
  className?: string;
  logoHeight?: number;
  /** Show “STILL WET” wordmark beside or below the drops. */
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

export function BrandLogoLink({
  href = "/",
  className = "inline-flex items-center gap-2.5 transition opacity-90 hover:opacity-100",
  logoHeight = 26,
  showWordmark = false,
  wordmarkClassName = "store-dimension-brand text-xs uppercase tracking-[0.2em] text-blue-400/80",
}: BrandLogoLinkProps) {
  return (
    <Link href={href} className={className} aria-label={`${BRAND_NAME} home`}>
      <StillWetLogo height={logoHeight} />
      {showWordmark ? <span className={wordmarkClassName}>{BRAND_LOGO_MARK}</span> : null}
    </Link>
  );
}
