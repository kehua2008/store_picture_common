import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const assets = [
  {
    input: "public/homepage-assets/common-home-entry-poster.png",
    outDir: "public/homepage-assets/optimized",
    name: "common-home-entry-poster",
    widths: [480, 800, 1200]
  },
  {
    input: "public/homepage-assets/common-choice-image.png",
    outDir: "public/homepage-assets/optimized",
    name: "common-choice-image",
    widths: [420, 760, 1100]
  },
  {
    input: "public/homepage-assets/common-choice-video.png",
    outDir: "public/homepage-assets/optimized",
    name: "common-choice-video",
    widths: [420, 760, 1100]
  },
  {
    input: "public/video-choice-assets/common-video-choice-reference-blue.png",
    outDir: "public/video-choice-assets/optimized",
    name: "common-video-choice-reference-blue",
    widths: [420, 760, 1100]
  },
  {
    input: "public/video-choice-assets/common-video-choice-prompt-blue.png",
    outDir: "public/video-choice-assets/optimized",
    name: "common-video-choice-prompt-blue",
    widths: [420, 760, 1100]
  }
];

async function optimizeAsset(asset) {
  mkdirSync(asset.outDir, { recursive: true });
  const image = sharp(asset.input);
  const meta = await image.metadata();
  if (!meta.width) throw new Error(`Could not read width for ${asset.input}`);

  await Promise.all(asset.widths.map(async (width) => {
    const targetWidth = Math.min(width, meta.width);
    const base = path.join(asset.outDir, `${asset.name}-${targetWidth}w`);
    await sharp(asset.input)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(`${base}.webp`);
    await sharp(asset.input)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .avif({ quality: 48, effort: 5 })
      .toFile(`${base}.avif`);
  }));
}

await Promise.all(assets.map(optimizeAsset));
