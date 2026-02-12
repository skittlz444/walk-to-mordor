const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const MAP_DIR = path.join(__dirname, '..', 'public', 'img', 'map');
const TILE_DIR = path.join(MAP_DIR, 'tiles');
const TILE_SIZE = 512;
const SOURCE_FILE = 'ctd58g7fsmyf1.webp';

async function tileMapImage() {
  const inputPath = path.join(MAP_DIR, SOURCE_FILE);

  console.log(`Reading source image: ${inputPath}`);

  let meta;
  try {
    meta = await sharp(inputPath).metadata();
  } catch (err) {
    console.error(`Failed to read ${SOURCE_FILE}:`, err.message);
    process.exitCode = 1;
    return;
  }

  const fullWidth = meta.width;
  const fullHeight = meta.height;
  console.log(`Source dimensions: ${fullWidth}x${fullHeight}`);

  // Compute zoom levels: level 0 = full res, higher = more downscaled
  // We stop when the scaled image fits in a handful of tiles
  const levels = [];
  let w = fullWidth;
  let h = fullHeight;
  let z = 0;
  while (w > TILE_SIZE || h > TILE_SIZE) {
    levels.push({ z, w: Math.ceil(fullWidth / (2 ** z)), h: Math.ceil(fullHeight / (2 ** z)) });
    z++;
    w = Math.ceil(w / 2);
    h = Math.ceil(h / 2);
  }
  // Add the final (smallest) level
  levels.push({ z, w: Math.ceil(fullWidth / (2 ** z)), h: Math.ceil(fullHeight / (2 ** z)) });

  console.log(`\nTile scheme (tile size: ${TILE_SIZE}px):`);
  for (const lvl of levels) {
    const cols = Math.ceil(lvl.w / TILE_SIZE);
    const rows = Math.ceil(lvl.h / TILE_SIZE);
    console.log(`  Level ${lvl.z}: ${lvl.w}x${lvl.h} -> ${cols}x${rows} = ${cols * rows} tiles`);
  }

  // Clean and create tile directory
  try {
    await fs.rm(TILE_DIR, { recursive: true, force: true });
  } catch (e) {
    // ignore if doesn't exist
  }
  await fs.mkdir(TILE_DIR, { recursive: true });

  let totalTiles = 0;

  for (const lvl of levels) {
    const levelDir = path.join(TILE_DIR, String(lvl.z));
    await fs.mkdir(levelDir, { recursive: true });

    const cols = Math.ceil(lvl.w / TILE_SIZE);
    const rows = Math.ceil(lvl.h / TILE_SIZE);

    console.log(`\nGenerating level ${lvl.z} (${lvl.w}x${lvl.h}, ${cols}x${rows} tiles)...`);

    // Resize the full image to this level's dimensions
    const resizedBuffer = await sharp(inputPath)
      .resize(lvl.w, lvl.h, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resizedBuffer;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = col * TILE_SIZE;
        const top = row * TILE_SIZE;
        const tileW = Math.min(TILE_SIZE, info.width - left);
        const tileH = Math.min(TILE_SIZE, info.height - top);

        if (tileW <= 0 || tileH <= 0) continue;

        // Extract tile pixels from the raw buffer
        const tileBuffer = Buffer.alloc(tileW * tileH * info.channels);
        for (let y = 0; y < tileH; y++) {
          const srcOffset = ((top + y) * info.width + left) * info.channels;
          const dstOffset = y * tileW * info.channels;
          data.copy(tileBuffer, dstOffset, srcOffset, srcOffset + tileW * info.channels);
        }

        const tilePath = path.join(levelDir, `${col}_${row}.webp`);
        await sharp(tileBuffer, {
          raw: {
            width: tileW,
            height: tileH,
            channels: info.channels,
          },
        })
          .webp({ quality: 85 })
          .toFile(tilePath);

        totalTiles++;
      }
    }

    console.log(`  ✅ Level ${lvl.z} complete`);
  }

  // Write metadata file for the client
  const metadata = {
    source: SOURCE_FILE,
    fullWidth,
    fullHeight,
    tileSize: TILE_SIZE,
    levels: levels.map((lvl) => ({
      z: lvl.z,
      width: lvl.w,
      height: lvl.h,
      cols: Math.ceil(lvl.w / TILE_SIZE),
      rows: Math.ceil(lvl.h / TILE_SIZE),
    })),
  };

  const metaPath = path.join(TILE_DIR, 'metadata.json');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

  console.log(`\n✅ Done! ${totalTiles} tiles generated across ${levels.length} zoom levels.`);
  console.log(`Metadata written to: ${metaPath}`);
  console.log(`Tiles directory: ${TILE_DIR}`);
}

tileMapImage();
