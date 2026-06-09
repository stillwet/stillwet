import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_CANVAS_PRESENTATION_WRAPAROUND_MUG_3VIEW,
  computeListingArtworkCropFrameRect,
  guideXInContainer,
  parseCatalogCanvasPresentation,
} from "@/lib/admin-catalog-canvas-presentation";

describe("parseCatalogCanvasPresentation", () => {
  it("defaults null to flat", () => {
    assert.deepEqual(parseCatalogCanvasPresentation(null), { type: "flat" });
  });

  it("parses wraparound", () => {
    const p = parseCatalogCanvasPresentation(CATALOG_CANVAS_PRESENTATION_WRAPAROUND_MUG_3VIEW);
    assert.equal(p.type, "wraparound");
    if (p.type !== "wraparound") return;
    assert.equal(p.verticalGuideFractions.length, 3);
    assert.equal(p.orientationPreviews.length, 3);
    assert.equal(p.safeAreaInsetFraction, undefined);
  });

  it("parses shapeOutline", () => {
    const p = parseCatalogCanvasPresentation({
      type: "shapeOutline",
      outlineAssetKey: "tee-front-outline",
    });
    assert.equal(p.type, "shapeOutline");
  });
});

describe("computeListingArtworkCropFrameRect", () => {
  it("centers wide aspect in container", () => {
    const aspect = 2475 / 1155;
    const frame = computeListingArtworkCropFrameRect(800, 520, aspect);
    assert.ok(frame);
    assert.equal(frame!.width, 800);
    assert.ok(frame!.height < 520);
    assert.equal(frame!.left, 0);
    assert.ok(frame!.top > 0);
    const centerGuide = guideXInContainer(frame!, 0.5);
    assert.equal(centerGuide, 400);
  });
});
