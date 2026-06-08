import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rgbBytesToHex } from "@/lib/listing-artwork-crop-color-sample";
import {
  canvasSolidSidePresetForHex,
  CANVAS_SOLID_SIDE_PRESET_HEX,
} from "@/lib/listing-artwork-canvas-wrap-bleed";

describe("rgbBytesToHex", () => {
  it("formats rgb bytes", () => {
    assert.equal(rgbBytesToHex(0, 0, 0), "#000000");
    assert.equal(rgbBytesToHex(255, 255, 255), "#ffffff");
    assert.equal(rgbBytesToHex(26, 43, 60), "#1a2b3c");
  });
});

describe("canvasSolidSidePresetForHex", () => {
  it("detects black and white presets", () => {
    assert.equal(canvasSolidSidePresetForHex("#000"), "black");
    assert.equal(canvasSolidSidePresetForHex("#ffffff"), "white");
    assert.equal(canvasSolidSidePresetForHex("#1a2b3c"), null);
    assert.equal(CANVAS_SOLID_SIDE_PRESET_HEX.black, "#000000");
  });
});
