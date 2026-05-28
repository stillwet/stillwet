import { BRAND_NAME } from "@/lib/site-brand";
import {
  BRAND_CMY,
  STILL_WET_DROP_PATHS,
  STILL_WET_HIGHLIGHT_FILLS,
  STILL_WET_HIGHLIGHT_PATHS,
  STILL_WET_LOGO_VIEW_BOX,
  stillWetLogoRasterScale,
  stillWetLogoShowsHighlights,
} from "@/lib/still-wet-logo-paths";

type StillWetLogoProps = {
  className?: string;
  /** Render height in CSS pixels (square). */
  height?: number;
  title?: string;
  /**
   * `mark` — CMY drops only (crisper small sizes).
   * `full` — includes specular highlights.
   * Default: `mark` when height ≤ 40px, else `full`.
   */
  detail?: "mark" | "full";
};

export function StillWetLogo({
  className,
  height = 28,
  title = BRAND_NAME,
  detail,
}: StillWetLogoProps) {
  const showHighlights =
    detail === "full" || (detail !== "mark" && stillWetLogoShowsHighlights(height));
  const rasterScale = stillWetLogoRasterScale(height);
  const rasterPx = height * rasterScale;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={STILL_WET_LOGO_VIEW_BOX}
      width={rasterPx}
      height={rasterPx}
      style={{ width: height, height, display: "block" }}
      className={className}
      shapeRendering="geometricPrecision"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d={STILL_WET_DROP_PATHS.left} fill={BRAND_CMY.cyan} />
      <path d={STILL_WET_DROP_PATHS.bottomRight} fill={BRAND_CMY.yellow} />
      <path d={STILL_WET_DROP_PATHS.topRight} fill={BRAND_CMY.magenta} />
      {showHighlights ? (
        <>
          <path d={STILL_WET_HIGHLIGHT_PATHS.left} fill={STILL_WET_HIGHLIGHT_FILLS.cyan} />
          <path
            d={STILL_WET_HIGHLIGHT_PATHS.bottomRight}
            fill={STILL_WET_HIGHLIGHT_FILLS.yellow}
          />
          <path
            d={STILL_WET_HIGHLIGHT_PATHS.topRight}
            fill={STILL_WET_HIGHLIGHT_FILLS.magenta}
          />
        </>
      ) : null}
    </svg>
  );
}
