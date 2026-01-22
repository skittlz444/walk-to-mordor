const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_MAX = 400;
const DEFAULT_TARGET_KB = 20;
const DEFAULT_QUALITY = 60;
const MIN_QUALITY = 20;
const QUALITY_STEP = 5;

const args = process.argv.slice(2);

const getFlagValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : fallback;
};

const inputPath = args[0];
const outputPath = args[1];

const maxDimension = getFlagValue('--max', DEFAULT_MAX);
const width = getFlagValue('--width', null);
const height = getFlagValue('--height', null);
const targetKB = getFlagValue('--targetKB', DEFAULT_TARGET_KB);
const startingQuality = getFlagValue('--quality', DEFAULT_QUALITY);

if (!inputPath || !outputPath) {
  console.error('Usage: node .github/skills/goal-image-generation/resources/resize-webp.js <input.webp> <output.webp> [--max 400] [--width 2560 --height 2560] [--targetKB 20] [--quality 60] [--upscale]');
  process.exit(1);
}

const allowUpscale = args.includes('--upscale');

const getResizeDimensions = () => {
  if (Number.isFinite(width) && Number.isFinite(height)) {
    return { width, height };
  }
  return { width: maxDimension, height: maxDimension };
};

const buildWebpBuffer = (quality) => {
  const dimensions = getResizeDimensions();
  return sharp(inputPath)
    .resize({
      ...dimensions,
      fit: 'inside',
      withoutEnlargement: !allowUpscale,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .webp({ quality, effort: 6 })
    .toBuffer();
};

const ensureOutputDir = async (filePath) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
};

const formatKB = (bytes) => (bytes / 1024).toFixed(2);

const run = async () => {
  let quality = startingQuality;
  let buffer = await buildWebpBuffer(quality);

  if (targetKB > 0) {
    while (buffer.length / 1024 > targetKB && quality > MIN_QUALITY) {
      quality -= QUALITY_STEP;
      buffer = await buildWebpBuffer(quality);
    }
  }

  await ensureOutputDir(outputPath);
  await fs.writeFile(outputPath, buffer);

  const resultKB = formatKB(buffer.length);
  const dimensions = getResizeDimensions();
  const targetNote = targetKB > 0 ? `target ${targetKB} KB` : 'no target size';
  console.log(`Saved ${outputPath} (${resultKB} KB) at ${quality} quality, ${dimensions.width}x${dimensions.height}px, ${targetNote}.`);
};

run().catch((error) => {
  console.error('Failed to resize image:', error);
  process.exit(1);
});