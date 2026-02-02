const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

// Configuration
const SOURCE_DIR = path.join(__dirname, '..', 'raw_assets');
const HIGHRES_DIR = path.join(__dirname, '..', 'public', 'img', 'highres');
const THUMB_DIR = path.join(__dirname, '..', 'public', 'img', 'thumbs');

// High-res configuration
const HIGHRES_MAX_WIDTH = 2048;
const HIGHRES_MAX_4K = 3840;
const HIGHRES_QUALITY = 90;

// Thumbnail configuration
const THUMB_WIDTH = 256;
const THUMB_QUALITY_START = 60;
const THUMB_TARGET_KB = 20;
const THUMB_MIN_QUALITY = 20;
const THUMB_QUALITY_STEP = 5;

// Supported image formats (TIFF/TIF both supported)
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.gif'];

/**
 * Ensure output directory exists
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Get all image files from directory recursively
 */
async function getImageFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getImageFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Source directory not found: ${dir}`);
      console.error(`Please create the directory and add images to process.`);
      return [];
    }
    throw error;
  }
  
  return files;
}

/**
 * Format bytes to KB or MB
 */
function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generate high-res WebP image
 * - Target 2048px width, but preserve original if under 4K
 * - Only downscale if original > 4K (3840px) - never upscale
 * - Quality 90
 */
async function generateHighRes(inputPath, outputPath) {
  const metadata = await sharp(inputPath).metadata();
  const originalWidth = metadata.width;
  
  let resizeWidth = null;
  
  // Smart resizing: only resize if > 4K (3840px), never upscale
  if (originalWidth > HIGHRES_MAX_4K) {
    resizeWidth = HIGHRES_MAX_WIDTH;
  }
  
  const pipeline = sharp(inputPath);
  
  if (resizeWidth) {
    pipeline.resize({
      width: resizeWidth,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  }
  
  const buffer = await pipeline
    .webp({ quality: HIGHRES_QUALITY, effort: 6 })
    .toBuffer();
  
  await fs.writeFile(outputPath, buffer);
  
  return {
    width: resizeWidth || originalWidth,
    size: buffer.length,
  };
}

/**
 * Generate thumbnail WebP image with iterative quality reduction
 * - 256px width
 * - Target < 20KB
 * - Start at quality 60, reduce by 5 until target met or min quality reached
 */
async function generateThumbnail(inputPath, outputPath) {
  let quality = THUMB_QUALITY_START;
  let buffer;
  
  // Iteratively reduce quality to meet size target
  while (quality >= THUMB_MIN_QUALITY) {
    buffer = await sharp(inputPath)
      .resize({
        width: THUMB_WIDTH,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality, effort: 6 })
      .toBuffer();
    
    const sizeKB = buffer.length / 1024;
    
    // If under target or at minimum quality, we're done
    if (sizeKB <= THUMB_TARGET_KB || quality === THUMB_MIN_QUALITY) {
      break;
    }
    
    quality -= THUMB_QUALITY_STEP;
  }
  
  await fs.writeFile(outputPath, buffer);
  
  return {
    size: buffer.length,
    quality,
  };
}

/**
 * Process a single image file
 */
async function processImage(inputPath) {
  const filename = path.basename(inputPath, path.extname(inputPath));
  const highresFilename = `${filename}.webp`;
  const thumbFilename = `${filename}-thumb.webp`;
  
  const highresPath = path.join(HIGHRES_DIR, highresFilename);
  const thumbPath = path.join(THUMB_DIR, thumbFilename);
  
  try {
    // Get original file size
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;
    
    // Generate high-res
    const highresResult = await generateHighRes(inputPath, highresPath);
    
    // Generate thumbnail
    const thumbResult = await generateThumbnail(inputPath, thumbPath);
    
    // Log results
    console.log(`[Optimized] ${path.basename(inputPath)} -> ${highresFilename} + ${thumbFilename}`);
    console.log(`  Original: ${formatSize(originalSize)} | High-res: ${formatSize(highresResult.size)} (${highresResult.width}px) | Thumb: ${formatSize(thumbResult.size)} (≤${THUMB_WIDTH}px, q${thumbResult.quality})`);
    
    return {
      filename: path.basename(inputPath),
      originalSize,
      highresSize: highresResult.size,
      thumbSize: thumbResult.size,
    };
  } catch (error) {
    console.error(`[Error] Failed to process ${path.basename(inputPath)}: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🖼️  Image Optimization Script');
  console.log('================================\n');
  
  // Ensure output directories exist
  await ensureDir(HIGHRES_DIR);
  await ensureDir(THUMB_DIR);
  
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`High-res output: ${HIGHRES_DIR}`);
  console.log(`Thumbnail output: ${THUMB_DIR}\n`);
  
  // Get all image files
  console.log('Scanning for images...');
  const imageFiles = await getImageFiles(SOURCE_DIR);
  
  if (imageFiles.length === 0) {
    console.log('\n⚠️  No images found to process.');
    console.log(`\nPlease add images to: ${SOURCE_DIR}`);
    return;
  }
  
  console.log(`Found ${imageFiles.length} image(s) to process.\n`);
  
  // Process all images
  const results = [];
  for (const imagePath of imageFiles) {
    const result = await processImage(imagePath);
    if (result) {
      results.push(result);
    }
  }
  
  // Summary
  console.log('\n================================');
  console.log('Summary');
  console.log('================================\n');
  
  if (results.length === 0) {
    console.log('No images were successfully processed.');
    return;
  }
  
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalHighres = results.reduce((sum, r) => sum + r.highresSize, 0);
  const totalThumb = results.reduce((sum, r) => sum + r.thumbSize, 0);
  const totalSavings = totalOriginal - (totalHighres + totalThumb);
  const savingsPercent = ((totalSavings / totalOriginal) * 100).toFixed(1);
  
  console.log(`Files processed: ${results.length}`);
  console.log(`Original total: ${formatSize(totalOriginal)}`);
  console.log(`High-res total: ${formatSize(totalHighres)}`);
  console.log(`Thumbnail total: ${formatSize(totalThumb)}`);
  console.log(`Combined output: ${formatSize(totalHighres + totalThumb)}`);
  console.log(`Total savings: ${formatSize(totalSavings)} (${savingsPercent}%)\n`);
  
  console.log('✅ Optimization complete!');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
