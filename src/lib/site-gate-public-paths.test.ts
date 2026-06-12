import { describe, expect, it } from "vitest";
import {
  isLinkPreviewCrawlerUserAgent,
  isSiteGatePublicAssetPath,
} from "@/lib/site-gate-public-paths";

describe("isSiteGatePublicAssetPath", () => {
  it("allows icon and OG asset paths", () => {
    expect(isSiteGatePublicAssetPath("/icon")).toBe(true);
    expect(isSiteGatePublicAssetPath("/apple-icon")).toBe(true);
    expect(isSiteGatePublicAssetPath("/still-wet-logo-2048.png")).toBe(true);
    expect(isSiteGatePublicAssetPath("/favicon.ico")).toBe(true);
  });

  it("blocks normal app routes", () => {
    expect(isSiteGatePublicAssetPath("/shop/all")).toBe(false);
    expect(isSiteGatePublicAssetPath("/gate")).toBe(false);
  });
});

describe("isLinkPreviewCrawlerUserAgent", () => {
  it("detects common preview crawlers", () => {
    expect(isLinkPreviewCrawlerUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isLinkPreviewCrawlerUserAgent("Twitterbot/1.0")).toBe(true);
    expect(isLinkPreviewCrawlerUserAgent("Applebot/0.1")).toBe(true);
  });

  it("ignores normal browsers", () => {
    expect(
      isLinkPreviewCrawlerUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ),
    ).toBe(false);
  });
});
