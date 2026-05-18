import sharp, { Sharp } from 'sharp';
import { IMAGE_RESTRICTIONS, UPLOAD_LIMITS } from '@/config/security';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  metadata: {
    colorSpace?: string;
    hasAlpha?: boolean;
    density?: number;
  };
}

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  width?: number;
  height?: number;
  aspectRatio?: number;
}

/**
 * Process an image: optimize, strip EXIF, validate dimensions.
 * @param buffer - Image file buffer
 * @param targetMimeType - Desired output MIME type (e.g., 'image/jpeg')
 * @returns Processed image with metadata
 */
export async function processImage(
  buffer: Buffer,
  targetMimeType: string = 'image/jpeg'
): Promise<ProcessedImage> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Buffer is empty');
  }

  let image = sharp(buffer).rotate(); // Auto-rotate based on EXIF orientation

  // Get metadata before processing
  const metadata = await image.metadata();

  // Validate dimensions before processing
  if (metadata.width && metadata.height) {
    const validation = validateImageDimensions(metadata.width, metadata.height);
    if (!validation.valid) {
      throw new Error(`Image dimensions invalid: ${validation.errors[0]}`);
    }
  }

  // Resize if dimensions exceed max
  if (metadata.width && metadata.height) {
    const { width, height } = calculateOptimalDimensions(
      metadata.width,
      metadata.height
    );
    if (width < metadata.width || height < metadata.height) {
      image = image.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }

  // Normalize format and compress
  let processed: Sharp;
  switch (targetMimeType) {
    case 'image/png':
      processed = image.png({
        compressionLevel: 9,
      });
      break;
    case 'image/webp':
      processed = image.webp({
        quality: IMAGE_RESTRICTIONS.qualityLevel,
      });
      break;
    case 'image/jpeg':
    default:
      processed = image.jpeg({
        quality: IMAGE_RESTRICTIONS.qualityLevel,
        progressive: true,
        mozjpeg: true,
      });
      break;
  }

  // Remove all metadata (EXIF, IPTC, XMP, etc.) — sharp strips by default
  // on re-encode; calling .withMetadata() with no args preserves nothing
  // beyond orientation, which is what we want for user-uploaded photos.
  processed = processed.withMetadata({});

  // Process and get final metadata
  const processedBuffer = await processed.toBuffer();
  const finalMetadata = await sharp(processedBuffer).metadata();

  const mimeTypeMap: Record<string, string> = {
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/jpeg': 'image/jpeg',
  };

  return {
    buffer: processedBuffer,
    mimeType: mimeTypeMap[targetMimeType] || 'image/jpeg',
    width: finalMetadata.width || metadata.width || 0,
    height: finalMetadata.height || metadata.height || 0,
    size: processedBuffer.length,
    metadata: {
      colorSpace: finalMetadata.space,
      hasAlpha: finalMetadata.hasAlpha,
      density: finalMetadata.density,
    },
  };
}

/**
 * Validate image dimensions against restrictions.
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Validation result with errors and warnings
 */
export function validateImageDimensions(
  width: number,
  height: number
): ImageValidationResult {
  const result: ImageValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    width,
    height,
  };

  const minDim = IMAGE_RESTRICTIONS.minDimensions.width; // Assuming square min
  const maxDim = IMAGE_RESTRICTIONS.maxDimensions.width; // Assuming square max

  // Check minimum dimensions
  if (width < minDim || height < minDim) {
    result.errors.push(
      `Image must be at least ${minDim}x${minDim} pixels`
    );
    result.valid = false;
  }

  // Check maximum dimensions
  if (width > maxDim || height > maxDim) {
    result.errors.push(
      `Image must be at most ${maxDim}x${maxDim} pixels`
    );
    result.valid = false;
  }

  // Check aspect ratio
  const aspectRatio = width / height;
  result.aspectRatio = aspectRatio;

  const maxAspectRatio = IMAGE_RESTRICTIONS.maxAspectRatio;
  if (
    aspectRatio > maxAspectRatio ||
    1 / aspectRatio > maxAspectRatio
  ) {
    result.errors.push(
      `Image aspect ratio must not exceed ${maxAspectRatio}:1`
    );
    result.valid = false;
  }

  // Warn if image is larger than recommended
  if (width > 2000 || height > 2000) {
    result.warnings.push('Image is large; consider reducing dimensions');
  }

  return result;
}

/**
 * Calculate optimal dimensions for storage.
 * Maintains aspect ratio while staying within limits.
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @returns Dimensions to resize to
 */
export function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number
): { width: number; height: number } {
  const maxDim = IMAGE_RESTRICTIONS.maxDimensions.width;
  const minDim = IMAGE_RESTRICTIONS.minDimensions.width;

  let newWidth = originalWidth;
  let newHeight = originalHeight;

  // If image is too small, upscale while maintaining aspect ratio
  if (originalWidth < minDim || originalHeight < minDim) {
    const scaleFactor = minDim / Math.min(originalWidth, originalHeight);
    newWidth = Math.round(originalWidth * scaleFactor);
    newHeight = Math.round(originalHeight * scaleFactor);
  }
  // If image is too large, downscale while maintaining aspect ratio
  else if (originalWidth > maxDim || originalHeight > maxDim) {
    const scaleFactor = maxDim / Math.max(originalWidth, originalHeight);
    newWidth = Math.round(originalWidth * scaleFactor);
    newHeight = Math.round(originalHeight * scaleFactor);
  }

  return {
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Detect suspicious image content (potential exploit vectors).
 * Checks for: animated GIFs with too many frames, EXIF bombs, etc.
 * @param buffer - Image buffer
 * @returns Array of detected issues
 */
export async function detectSuspiciousImageContent(
  buffer: Buffer
): Promise<string[]> {
  const issues: string[] = [];

  try {
    const metadata = await sharp(buffer).metadata();

    // Detect animated GIFs (potential DOS via frame count)
    if (metadata.format === 'gif' && metadata.pages && metadata.pages > 100) {
      issues.push(`Animated GIF with ${metadata.pages} frames (potential DOS)`);
    }

    // Detect extremely high density (EXIF bomb potential)
    if (metadata.density && metadata.density > 10000) {
      issues.push('Image has extremely high density (potential EXIF bomb)');
    }

    // Detect unusual color spaces (anything other than sRGB or RGB)
    if (metadata.space && !['srgb', 'rgb'].includes(metadata.space)) {
      issues.push(`Image uses unusual color space: ${metadata.space}`);
    }
  } catch (error) {
    // If we can't parse, note it as a warning
    issues.push('Could not fully analyze image content');
  }

  return issues;
}

/**
 * Generate thumbnail from image.
 * @param buffer - Image buffer
 * @param width - Thumbnail width
 * @param height - Thumbnail height
 * @returns Thumbnail buffer
 */
export async function generateThumbnail(
  buffer: Buffer,
  width: number = 200,
  height: number = 200
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'center',
    })
    .withMetadata({})
    .toBuffer();
}

/**
 * Get image metadata without processing.
 * @param buffer - Image buffer
 * @returns Metadata object
 */
export async function getImageMetadata(buffer: Buffer) {
  try {
    return await sharp(buffer).metadata();
  } catch (error) {
    throw new Error('Failed to read image metadata');
  }
}

/**
 * Validate image size in bytes.
 * @param size - File size in bytes
 * @returns true if size is acceptable
 */
export function validateImageSize(size: number): boolean {
  return size > 0 && size <= UPLOAD_LIMITS.maxImageSize;
}

/**
 * Convert image to different format.
 * @param buffer - Image buffer
 * @param targetFormat - Target format (jpeg, png, webp)
 * @returns Converted image buffer
 */
export async function convertImageFormat(
  buffer: Buffer,
  targetFormat: 'jpeg' | 'png' | 'webp'
): Promise<Buffer> {
  const formatOptions = {
    jpeg: {
      quality: IMAGE_RESTRICTIONS.qualityLevel,
      progressive: true,
      mozjpeg: true,
    },
    png: {
      compressionLevel: 9,
    },
    webp: { quality: IMAGE_RESTRICTIONS.qualityLevel },
  };

  return sharp(buffer)
    .rotate()
    .withMetadata({})
    [targetFormat](formatOptions[targetFormat])
    .toBuffer();
}
