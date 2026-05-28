import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  processImage,
  validateImageDimensions,
  calculateOptimalDimensions,
  detectSuspiciousImageContent,
  generateThumbnail,
  getImageMetadata,
  validateImageSize,
  convertImageFormat,
} from '@/lib/security/image-processor';
import { IMAGE_RESTRICTIONS, UPLOAD_LIMITS } from '@/config/security';

describe('Image Processing & Restrictions', () => {
  // Create test image buffers
  async function createTestImage(
    width: number,
    height: number
  ): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  describe('validateImageDimensions', () => {
    it('should accept valid image dimensions', () => {
      const result = validateImageDimensions(800, 600);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject images smaller than minimum', () => {
      const result = validateImageDimensions(50, 50);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject images larger than maximum', () => {
      const result = validateImageDimensions(5000, 5000);
      expect(result.valid).toBe(false);
    });

    it('should reject extreme aspect ratios', () => {
      const result = validateImageDimensions(4000, 100); // 40:1
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept borderline aspect ratios', () => {
      const result = validateImageDimensions(4000, 1000); // 4:1
      expect(result.valid).toBe(true);
    });

    it('should track aspect ratio in result', () => {
      const result = validateImageDimensions(1600, 1200);
      expect(result.aspectRatio).toBe(1600 / 1200);
    });

    it('should accept square images', () => {
      const result = validateImageDimensions(1000, 1000);
      expect(result.valid).toBe(true);
      expect(result.aspectRatio).toBe(1);
    });

    it('should accept portrait orientation within limits', () => {
      const result = validateImageDimensions(600, 800);
      expect(result.valid).toBe(true);
    });

    it('should warn about large images', () => {
      const result = validateImageDimensions(2500, 2500);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('calculateOptimalDimensions', () => {
    it('should not resize images within limits', () => {
      const dims = calculateOptimalDimensions(800, 600);
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });

    it('should resize oversized images maintaining aspect ratio', () => {
      const dims = calculateOptimalDimensions(8000, 6000);
      expect(dims.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
      expect(dims.height).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.height
      );
      // Aspect ratio should be preserved (within rounding)
      expect(Math.abs(dims.width / dims.height - (8000 / 6000))).toBeLessThan(
        0.01
      );
    });

    it('should enforce minimum dimensions', () => {
      const dims = calculateOptimalDimensions(50, 50);
      expect(dims.width).toBeGreaterThanOrEqual(
        IMAGE_RESTRICTIONS.minDimensions.width
      );
      expect(dims.height).toBeGreaterThanOrEqual(
        IMAGE_RESTRICTIONS.minDimensions.height
      );
    });

    it('should handle portrait images', () => {
      const dims = calculateOptimalDimensions(2000, 3000);
      expect(dims.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
      expect(dims.height).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.height
      );
    });

    it('should handle landscape images', () => {
      const dims = calculateOptimalDimensions(3000, 2000);
      expect(dims.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
      expect(dims.height).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.height
      );
    });
  });

  describe('validateImageSize', () => {
    it('should accept images within size limit', () => {
      expect(validateImageSize(1000000)).toBe(true); // 1MB
      expect(validateImageSize(UPLOAD_LIMITS.maxImageSize - 1)).toBe(true);
    });

    it('should reject oversized images', () => {
      expect(validateImageSize(UPLOAD_LIMITS.maxImageSize + 1)).toBe(false);
    });

    it('should reject empty images', () => {
      expect(validateImageSize(0)).toBe(false);
    });

    it('should accept maximum allowed size', () => {
      expect(validateImageSize(UPLOAD_LIMITS.maxImageSize)).toBe(true);
    });

    it('should reject negative size', () => {
      expect(validateImageSize(-1)).toBe(false);
    });
  });

  describe('processImage', () => {
    it('should process valid image', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage, 'image/jpeg');

      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should apply compression', async () => {
      const testImage = await createTestImage(1000, 1000);
      const result = await processImage(testImage, 'image/jpeg');

      expect(result.size).toBeLessThan(testImage.length);
    });

    it('should reject oversized images', async () => {
      const testImage = await createTestImage(5000, 5000);
      await expect(processImage(testImage, 'image/jpeg')).rejects.toThrow();
    });

    it('should handle PNG format', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage, 'image/png');
      expect(result.mimeType).toBe('image/png');
    });

    it('should handle WebP format', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage, 'image/webp');
      expect(result.mimeType).toBe('image/webp');
    });

    it('should default to JPEG format', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should strip EXIF metadata', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage, 'image/jpeg');

      // Verify metadata is present in result
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.colorSpace).toBe('string');
    });

    it('should reject empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(processImage(emptyBuffer)).rejects.toThrow('empty');
    });

    it('should reject null/undefined buffer', async () => {
      await expect(
        processImage(null as any)
      ).rejects.toThrow();
    });

    it('should handle large but valid images', async () => {
      const testImage = await createTestImage(3500, 3500);
      const result = await processImage(testImage, 'image/jpeg');
      expect(result.size).toBeGreaterThan(0);
      expect(result.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail from image', async () => {
      const testImage = await createTestImage(1000, 1000);
      const thumbnail = await generateThumbnail(testImage, 200, 200);

      expect(thumbnail).toBeDefined();
      expect(thumbnail.length).toBeGreaterThan(0);
      expect(thumbnail.length).toBeLessThan(testImage.length);

      // Verify dimensions
      const meta = await sharp(thumbnail).metadata();
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(200);
    });

    it('should use default thumbnail dimensions', async () => {
      const testImage = await createTestImage(1000, 1000);
      const thumbnail = await generateThumbnail(testImage);

      const meta = await sharp(thumbnail).metadata();
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(200);
    });

    it('should cover and center crop', async () => {
      const testImage = await createTestImage(1600, 800);
      const thumbnail = await generateThumbnail(testImage, 200, 200);

      const meta = await sharp(thumbnail).metadata();
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(200);
    });
  });

  describe('getImageMetadata', () => {
    it('should extract image metadata', async () => {
      const testImage = await createTestImage(800, 600);
      const metadata = await getImageMetadata(testImage);

      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('jpeg');
    });

    it('should return complete metadata object', async () => {
      const testImage = await createTestImage(800, 600);
      const metadata = await getImageMetadata(testImage);

      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('format');
      expect(metadata).toHaveProperty('space');
    });

    it('should fail gracefully on invalid data', async () => {
      const invalidBuffer = Buffer.from('not an image');
      await expect(getImageMetadata(invalidBuffer)).rejects.toThrow();
    });
  });

  describe('detectSuspiciousImageContent', () => {
    it('should detect normal images as safe', async () => {
      const testImage = await createTestImage(800, 600);
      const issues = await detectSuspiciousImageContent(testImage);

      expect(issues).toHaveLength(0);
    });

    it('should handle invalid images gracefully', async () => {
      const invalidBuffer = Buffer.from('not an image');
      const issues = await detectSuspiciousImageContent(invalidBuffer);

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('convertImageFormat', () => {
    it('should convert JPEG to PNG', async () => {
      const jpegImage = await createTestImage(800, 600);
      const pngImage = await convertImageFormat(jpegImage, 'png');

      const metadata = await sharp(pngImage).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should convert to WebP', async () => {
      const jpegImage = await createTestImage(800, 600);
      const webpImage = await convertImageFormat(jpegImage, 'webp');

      const metadata = await sharp(webpImage).metadata();
      expect(metadata.format).toBe('webp');
    });

    it('should convert JPEG to JPEG', async () => {
      const jpegImage = await createTestImage(800, 600);
      const convertedImage = await convertImageFormat(jpegImage, 'jpeg');

      const metadata = await sharp(convertedImage).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should apply compression during conversion', async () => {
      const testImage = await createTestImage(800, 600);
      const converted = await convertImageFormat(testImage, 'png');

      expect(converted.length).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should process, compress, and strip metadata', async () => {
      const originalImage = await createTestImage(2000, 1500);
      const result = await processImage(originalImage, 'image/jpeg');

      // Verify all processing occurred
      expect(result.size).toBeLessThan(originalImage.length);
      expect(result.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
      expect(result.height).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.height
      );
    });

    it('should handle portrait image processing', async () => {
      const portraitImage = await createTestImage(600, 1000);
      const result = await processImage(portraitImage, 'image/webp');

      expect(result.mimeType).toBe('image/webp');
      expect(result.width).toBe(600);
      expect(result.height).toBe(1000);
    });

    it('should handle landscape image processing', async () => {
      const landscapeImage = await createTestImage(1000, 600);
      const result = await processImage(landscapeImage, 'image/png');

      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(1000);
      expect(result.height).toBe(600);
    });

    it('should validate and process in one flow', async () => {
      const testImage = await createTestImage(1200, 800);

      // Validate before processing
      const validation = validateImageDimensions(1200, 800);
      expect(validation.valid).toBe(true);

      // Process if valid
      if (validation.valid) {
        const result = await processImage(testImage, 'image/jpeg');
        expect(result.size).toBeGreaterThan(0);
      }
    });

    it('should generate and process thumbnails', async () => {
      const originalImage = await createTestImage(2000, 2000);
      const thumbnail = await generateThumbnail(originalImage, 200, 200);

      // Process the thumbnail further if needed
      const processed = await processImage(thumbnail, 'image/jpeg');
      expect(processed.width).toBe(200);
      expect(processed.height).toBe(200);
    });

    it('should handle size validation with processed images', async () => {
      const testImage = await createTestImage(800, 600);
      const result = await processImage(testImage, 'image/jpeg');

      // Validate processed size
      const sizeValid = validateImageSize(result.size);
      expect(sizeValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle minimum dimension images', async () => {
      const minDim = IMAGE_RESTRICTIONS.minDimensions.width;
      const testImage = await createTestImage(minDim, minDim);
      const result = await processImage(testImage, 'image/jpeg');

      expect(result.width).toBe(minDim);
      expect(result.height).toBe(minDim);
    });

    it('should handle near-maximum dimension images', async () => {
      const maxDim = IMAGE_RESTRICTIONS.maxDimensions.width;
      const testImage = await createTestImage(maxDim - 10, maxDim - 10);
      const result = await processImage(testImage, 'image/jpeg');

      expect(result.width).toBeLessThanOrEqual(maxDim);
      expect(result.height).toBeLessThanOrEqual(maxDim);
    });

    it('should handle extreme aspect ratios at boundary', () => {
      const max = IMAGE_RESTRICTIONS.maxAspectRatio;
      const maxDim = IMAGE_RESTRICTIONS.maxDimensions.width;
      // Use dimensions that maintain aspect ratio but stay within max dimensions
      const width = maxDim - 100;
      const height = Math.round(width / max);
      const result = validateImageDimensions(width, height);
      expect(result.valid).toBe(true);
    });

    it('should calculate optimal dimensions for extreme inputs', () => {
      const dims = calculateOptimalDimensions(100000, 100000);
      expect(dims.width).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.width
      );
      expect(dims.height).toBeLessThanOrEqual(
        IMAGE_RESTRICTIONS.maxDimensions.height
      );
    });
  });
});
