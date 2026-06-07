import { ImageResponse } from "next/og";
import { BRAND_CMY } from "@/lib/site-brand";
import { STILL_WET_DROP_PATHS, STILL_WET_LOGO_VIEW_BOX } from "@/lib/still-wet-logo-paths";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Native-size PNG favicon (crisper than scaling the full SVG in the tab). */
export default function Icon() {
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
        <svg viewBox={STILL_WET_LOGO_VIEW_BOX} width={28} height={28}>
          <path d={STILL_WET_DROP_PATHS.left} fill={BRAND_CMY.cyan} />
          <path d={STILL_WET_DROP_PATHS.bottomRight} fill={BRAND_CMY.yellow} />
          <path d={STILL_WET_DROP_PATHS.topRight} fill={BRAND_CMY.magenta} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
