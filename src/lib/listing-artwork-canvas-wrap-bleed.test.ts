import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANVAS_SOLID_SIDE_DEFAULT_HEX,
  CANVAS_WRAP_BLEED_INCHES,
  CANVAS_WRAP_BLEED_OVERLAY_FILL,
  canvasSolidSideHexOrDefault,
  canvasWrapBleedInsetPx,
  canvasWrapBleedInsetFractions,
  canvasWrapBleedPreviewFill,
  canvasWrapBleedPreviewStyleVars,
  parseCanvasSolidSideHex,
} from "@/lib/listing-artwork-canvas-wrap-bleed";

describe("canvasWrapBleedInsetFractions", () => {
  it("uses 1.25 in relative to print face size at 300 DPI", () => {
    const twelveByNine = canvasWrapBleedInsetFractions(3600, 2700);
    assert.ok(Math.abs(twelveByNine.insetX - CANVAS_WRAP_BLEED_INCHES / 12) < 1e-6);
    assert.ok(Math.abs(twelveByNine.insetY - CANVAS_WRAP_BLEED_INCHES / 9) < 1e-6);

    const twentyFourBySixteen = canvasWrapBleedInsetFractions(7200, 4800);
    assert.ok(Math.abs(twentyFourBySixteen.insetX - CANVAS_WRAP_BLEED_INCHES / 24) < 1e-6);
    assert.ok(Math.abs(twentyFourBySixteen.insetY - CANVAS_WRAP_BLEED_INCHES / 16) < 1e-6);
  });

  it("returns zero insets for invalid print dimensions", () => {
    assert.deepEqual(canvasWrapBleedInsetFractions(0, 2700), { insetX: 0, insetY: 0 });
  });
});

describe("parseCanvasSolidSideHex", () => {
  it("normalizes #RGB and #RRGGBB", () => {
    assert.equal(parseCanvasSolidSideHex("#abc"), "#aabbcc");
    assert.equal(parseCanvasSolidSideHex("abc"), "#aabbcc");
    assert.equal(parseCanvasSolidSideHex("#1a2b3c"), "#1a2b3c");
  });

  it("rejects invalid values", () => {
    assert.equal(parseCanvasSolidSideHex(""), null);
    assert.equal(parseCanvasSolidSideHex("#gg0000"), null);
    assert.equal(parseCanvasSolidSideHex("#12345"), null);
  });

  it("falls back to default", () => {
    assert.equal(canvasSolidSideHexOrDefault("bad"), CANVAS_SOLID_SIDE_DEFAULT_HEX);
    assert.equal(canvasSolidSideHexOrDefault("#fff"), "#ffffff");
  });
});

describe("canvasWrapBleedPreviewFill", () => {
  it("uses semi-transparent overlay for image-on-sides", () => {
    assert.equal(canvasWrapBleedPreviewFill("image", "#000000"), CANVAS_WRAP_BLEED_OVERLAY_FILL);
  });

  it("uses opaque hex for solid sides", () => {
    assert.equal(canvasWrapBleedPreviewFill("solid", "#fff"), "#ffffff");
    assert.equal(canvasWrapBleedPreviewFill("solid", "bad"), CANVAS_SOLID_SIDE_DEFAULT_HEX);
  });
});

describe("canvasWrapBleedPreviewStyleVars", () => {
  it("sets 20px inset and fill for image-on-sides", () => {
    const vars = canvasWrapBleedPreviewStyleVars("image", "#000000", 671, 447) as Record<
      string,
      string
    >;
    assert.equal(vars["--listing-artwork-canvas-wrap-inset"], "20px");
    assert.equal(vars["--listing-artwork-canvas-wrap-edge-fill"], CANVAS_WRAP_BLEED_OVERLAY_FILL);
  });

  it("clamps inset on tiny hosts", () => {
    const vars = canvasWrapBleedPreviewStyleVars("image", "#000000", 30, 30) as Record<
      string,
      string
    >;
    assert.equal(vars["--listing-artwork-canvas-wrap-inset"], "14px");
  });
});

describe("canvasWrapBleedInsetPx", () => {
  it("uses equal px thickness on each axis for a print-aspect host", () => {
    const { insetXPx, insetYPx } = canvasWrapBleedInsetPx(600, 450, 3600, 2700);
    assert.ok(Math.abs(insetXPx - 62.5) < 0.01);
    assert.ok(Math.abs(insetYPx - 62.5) < 0.01);
  });
});
