const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

// Avatar-specific configuration
const AVATAR_DIR = path.join(__dirname, '..', 'public', 'img', 'avatars');
const THUMB_DIR = path.join(AVATAR_DIR, 'thumbs');

const FULL_WIDTH = 512;
const FULL_QUALITY = 80;

const THUMB_WIDTH = 64;
const THUMB_QUALITY = 50;

const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.tiff', '.tif'];

function normalizeAvatarSlug(filename) {
  return path.basename(filename, path.extname(filename)).replace(/_\d+_$/, '');
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  console.log('🧝 Avatar Image Optimization');
  console.log('================================\n');

  await fs.mkdir(THUMB_DIR, { recursive: true });

  const entries = await fs.readdir(AVATAR_DIR, { withFileTypes: true });
  const sourceFiles = entries
    .filter(e => e.isFile() && SUPPORTED_FORMATS.includes(path.extname(e.name).toLowerCase()))
    .map(e => e.name)
    .sort();

  if (sourceFiles.length === 0) {
    console.log('No source images found in', AVATAR_DIR);
    return;
  }

  console.log(`Found ${sourceFiles.length} source image(s)\n`);
  console.log(`Full:  ${FULL_WIDTH}px, quality ${FULL_QUALITY} → ${AVATAR_DIR}/`);
  console.log(`Thumb: ${THUMB_WIDTH}px, quality ${THUMB_QUALITY} → ${THUMB_DIR}/\n`);

  let totalOriginal = 0;
  let totalFull = 0;
  let totalThumb = 0;
  let processed = 0;

  for (const file of sourceFiles) {
    const inputPath = path.join(AVATAR_DIR, file);
    const slug = normalizeAvatarSlug(file);
    const fullOut = path.join(AVATAR_DIR, `${slug}.webp`);
    const thumbOut = path.join(THUMB_DIR, `${slug}.webp`);

    try {
      const originalStats = await fs.stat(inputPath);
      totalOriginal += originalStats.size;

      // Generate full-size WebP (512px)
      const fullBuffer = await sharp(inputPath)
        .resize({ width: FULL_WIDTH, height: FULL_WIDTH, fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .webp({ quality: FULL_QUALITY, effort: 6 })
        .toBuffer();
      await fs.writeFile(fullOut, fullBuffer);
      totalFull += fullBuffer.length;

      // Generate thumbnail WebP (64px)
      const thumbBuffer = await sharp(inputPath)
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .webp({ quality: THUMB_QUALITY, effort: 6 })
        .toBuffer();
      await fs.writeFile(thumbOut, thumbBuffer);
      totalThumb += thumbBuffer.length;

      processed++;
      const sourceLabel = slug === path.basename(file, path.extname(file)) ? slug : `${file} -> ${slug}`;
      console.log(`  ✓ ${sourceLabel}  full: ${formatSize(fullBuffer.length)}  thumb: ${formatSize(thumbBuffer.length)}`);
    } catch (error) {
      console.error(`  ✗ ${slug}: ${error.message}`);
    }
  }

  console.log('\n================================');
  console.log(`Processed: ${processed}/${sourceFiles.length}`);
  console.log(`Original total:  ${formatSize(totalOriginal)}`);
  console.log(`Full total:      ${formatSize(totalFull)}`);
  console.log(`Thumb total:     ${formatSize(totalThumb)}`);
  console.log(`\n✅ Done! PNGs preserved in place.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
