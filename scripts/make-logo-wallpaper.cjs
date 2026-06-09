"use strict";

/**
 * Tile still-wet-logo-full.svg on a solid background (5120×2880).
 * Usage: node scripts/make-logo-wallpaper.cjs [black|white|both]
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const WIDTH = 5120;
const HEIGHT = 2880;
const TILE = 280;
const GAP = 120;

const root = path.join(__dirname, "..");
const logoSvg = path.join(root, "public", "still-wet-logo-full.svg");
const outDir = path.join(root, "assets");

const BACKGROUNDS = {
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  white: { r: 255, g: 255, b: 255, alpha: 1 },
};

async function buildWallpaper(backgroundKey) {
  const background = BACKGROUNDS[backgroundKey];
  if (!background) {
    throw new Error(`Unknown background: ${backgroundKey}`);
  }

  const logoPng = await sharp(logoSvg).resize(TILE, TILE).png().toBuffer();

  const step = TILE + GAP;
  const cols = Math.ceil(WIDTH / step);
  const rows = Math.ceil(HEIGHT / step);
  const offsetX = Math.floor((WIDTH - (cols - 1) * step - TILE) / 2);
  const offsetY = Math.floor((HEIGHT - (rows - 1) * step - TILE) / 2);

  const composites = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      composites.push({
        input: logoPng,
        left: offsetX + col * step,
        top: offsetY + row * step,
      });
    }
  }

  const outPath = path.join(outDir, `still-wet-logo-wallpaper-5120x2880-${backgroundKey}.png`);
  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toFile(outPath);

  return outPath;
}

async function main() {
  const mode = (process.argv[2] ?? "both").toLowerCase();
  const keys =
    mode === "both"
      ? ["black", "white"]
      : mode === "black" || mode === "white"
        ? [mode]
        : null;

  if (!keys) {
    console.error("Usage: node scripts/make-logo-wallpaper.cjs [black|white|both]");
    process.exit(1);
  }

  if (!fs.existsSync(logoSvg)) {
    console.error(`Logo not found: ${logoSvg}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const key of keys) {
    const out = await buildWallpaper(key);
    console.log(`Wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
