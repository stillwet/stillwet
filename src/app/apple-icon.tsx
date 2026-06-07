import { ImageResponse } from "next/og";
import { BRAND_CMY } from "@/lib/site-brand";
import {
  STILL_WET_DROP_PATHS,
  STILL_WET_HIGHLIGHT_FILLS,
  STILL_WET_HIGHLIGHT_PATHS,
  STILL_WET_LOGO_VIEW_BOX,
} from "@/lib/still-wet-logo-paths";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <svg viewBox={STILL_WET_LOGO_VIEW_BOX} width={152} height={152}>
          <path d={STILL_WET_DROP_PATHS.left} fill={BRAND_CMY.cyan} />
          <path d={STILL_WET_DROP_PATHS.bottomRight} fill={BRAND_CMY.yellow} />
          <path d={STILL_WET_DROP_PATHS.topRight} fill={BRAND_CMY.magenta} />
          <path d={STILL_WET_HIGHLIGHT_PATHS.left} fill={STILL_WET_HIGHLIGHT_FILLS.cyan} />
          <path
            d={STILL_WET_HIGHLIGHT_PATHS.bottomRight}
            fill={STILL_WET_HIGHLIGHT_FILLS.yellow}
          />
          <path
            d={STILL_WET_HIGHLIGHT_PATHS.topRight}
            fill={STILL_WET_HIGHLIGHT_FILLS.magenta}
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
