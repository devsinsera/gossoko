import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateUpload,
  isAllowedMimeType,
  validateMimeType,
  detectFileTypeBySignature,
  isExecutableExtension,
  containsExecutablePatterns,
  isLikelyZipBomb,
  getFileExtension,
  validateFilename,
  getAllowedExtensions,
  scanForMalware,
} from '@/lib/security/upload-validator';

describe('Upload Validation', () => {
  describe('isAllowedMimeType', () => {
    it('should allow image types', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('image/png')).toBe(true);
      expect(isAllowedMimeType('image/webp')).toBe(true);
    });

    it('should allow document types', () => {
      expect(isAllowedMimeType('application/pdf')).toBe(true);
      expect(isAllowedMimeType('text/plain')).toBe(true);
    });

    it('should reject executable types', () => {
      expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
    });

    it('should reject arbitrary types', () => {
      expect(isAllowedMimeType('application/octet-stream')).toBe(false);
    });
  });

  describe('isExecutableExtension', () => {
    it('should detect executable extensions', () => {
      expect(isExecutableExtension('exe')).toBe(true);
      expect(isExecutableExtension('bat')).toBe(true);
      expect(isExecutableExtension('dll')).toBe(true);
      expect(isExecutableExtension('py')).toBe(true);
      expect(isExecutableExtension('sh')).toBe(true);
    });

    it('should allow safe extensions', () => {
      expect(isExecutableExtension('pdf')).toBe(false);
      expect(isExecutableExtension('jpg')).toBe(false);
      expect(isExecutableExtension('png')).toBe(false);
      expect(isExecutableExtension('txt')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isExecutableExtension('EXE')).toBe(true);
      expect(isExecutableExtension('Exe')).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.jpg')).toBe('jpg');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should handle files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should be case-insensitive', () => {
      expect(getFileExtension('FILE.PDF')).toBe('pdf');
    });
  });

  describe('validateFilename', () => {
    it('should accept valid filenames', () => {
      expect(validateFilename('document.pdf')).toBe('document.pdf');
      expect(validateFilename('my_file.txt')).toBe('my_file.txt');
      expect(validateFilename('file-2024.png')).toBe('file-2024.png');
    });

    it('should reject path traversal attempts', () => {
      expect(validateFilename('../../../etc/passwd')).toBeNull();
      expect(validateFilename('../../file.txt')).toBeNull();
      expect(validateFilename('path/to/file.txt')).toBeNull();
      expect(validateFilename('path\\to\\file.txt')).toBeNull();
    });

    it('should reject extremely long filenames', () => {
      const longName = 'a'.repeat(256) + '.pdf';
      expect(validateFilename(longName)).toBeNull();
    });

    it('should reject empty/null filenames', () => {
      expect(validateFilename('')).toBeNull();
      expect(validateFilename('   ')).toBeNull();
    });

    it('should sanitize special characters', () => {
      const result = validateFilename('file<script>.pdf');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });

  describe('containsExecutablePatterns', () => {
    it('should detect PE (Windows executable) header', () => {
      const peHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ header
      expect(containsExecutablePatterns(peHeader)).toBe(true);
    });

    it('should detect ELF (Linux executable) header', () => {
      const elfHeader = Buffer.from([0x7F, 0x45, 0x4C, 0x46]); // .ELF
      expect(containsExecutablePatterns(elfHeader)).toBe(true);
    });

    it('should detect Mach-O (macOS) header', () => {
      const machoHeader = Buffer.from([0xFE, 0xED, 0xFA, 0xCE]); // Mach-O
      expect(containsExecutablePatterns(machoHeader)).toBe(true);
    });

    it('should detect Java class files', () => {
      const javaClass = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]); // Java
      expect(containsExecutablePatterns(javaClass)).toBe(true);
    });

    it('should detect shell script shebang', () => {
      const shebang = Buffer.from([0x23, 0x21, 0x2F, 0x62, 0x69, 0x6E]); // #!/bin
      expect(containsExecutablePatterns(shebang)).toBe(true);
    });

    it('should allow non-executable content', () => {
      const plainText = Buffer.from('This is just a text file');
      expect(containsExecutablePatterns(plainText)).toBe(false);
    });

    it('should handle short buffers gracefully', () => {
      const shortBuffer = Buffer.from([0x00]);
      expect(containsExecutablePatterns(shortBuffer)).toBe(false);
    });
  });

  describe('isLikelyZipBomb', () => {
    it('should detect suspicious compression ratios', () => {
      // ZIP header
      const zipBomb = Buffer.alloc(30);
      zipBomb[0] = 0x50; // P
      zipBomb[1] = 0x4B; // K
      zipBomb.writeUInt32LE(100, 18); // compressed size: 100 bytes
      zipBomb.writeUInt32LE(10000000, 22); // uncompressed: 10MB

      expect(isLikelyZipBomb(zipBomb, 100)).toBe(true);
    });

    it('should allow normal ZIP files', () => {
      const normalZip = Buffer.alloc(30);
      normalZip[0] = 0x50;
      normalZip[1] = 0x4B;
      normalZip.writeUInt32LE(1000, 18); // 1KB compressed
      normalZip.writeUInt32LE(5000, 22); // 5KB uncompressed (5:1 ratio)

      expect(isLikelyZipBomb(normalZip, 1000)).toBe(false);
    });

    it('should reject non-ZIP files', () => {
      const pdfFile = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      expect(isLikelyZipBomb(pdfFile, 1000)).toBe(false);
    });

    it('should handle edge case with zero compressed size', () => {
      const edgeZip = Buffer.alloc(30);
      edgeZip[0] = 0x50;
      edgeZip[1] = 0x4B;
      edgeZip.writeUInt32LE(0, 18); // 0 bytes compressed
      edgeZip.writeUInt32LE(1000, 22); // 1KB uncompressed (infinite ratio)

      expect(isLikelyZipBomb(edgeZip, 0)).toBe(true);
    });
  });

  describe('getAllowedExtensions', () => {
    it('should return image extensions', () => {
      const exts = getAllowedExtensions('images');
      expect(exts).toContain('jpg');
      expect(exts).toContain('png');
      expect(exts).toContain('webp');
    });

    it('should return document extensions', () => {
      const exts = getAllowedExtensions('documents');
      expect(exts).toContain('pdf');
      expect(exts).toContain('txt');
    });
  });

  describe('detectFileTypeBySignature', () => {
    it('should detect JPEG files', () => {
      const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(detectFileTypeBySignature(jpeg)).toBe('image/jpeg');
    });

    it('should detect PNG files', () => {
      const png = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(detectFileTypeBySignature(png)).toBe('image/png');
    });

    it('should detect PDF files', () => {
      const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      expect(detectFileTypeBySignature(pdf)).toBe('application/pdf');
    });

    it('should return null for unknown types', () => {
      const unknown = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
      expect(detectFileTypeBySignature(unknown)).toBeNull();
    });
  });

  describe('validateMimeType', () => {
    it('should validate PNG MIME type with correct signature', () => {
      const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(validateMimeType('image/png', pngSig)).toBe(true);
    });

    it('should reject mismatched MIME type', () => {
      const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(validateMimeType('image/jpeg', pngSig)).toBe(false);
    });

    it('should return false for unknown MIME types', () => {
      const unknownSig = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
      expect(validateMimeType('application/unknown', unknownSig)).toBe(false);
    });
  });

  describe('scanForMalware', () => {
    it('should return disabled scan result when malware scan is disabled', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await scanForMalware(file);
      expect(result.clean).toBe(true);
      expect(result.scanEngine).toBe('disabled');
    });
  });

  describe('validateUpload', () => {
    it('should validate a good image file', async () => {
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([pngData], 'image.png', { type: 'image/png' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe('image/png');
    });

    it('should reject empty files', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject files exceeding size limit', async () => {
      const largeData = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const file = new File([largeData], 'large.pdf', { type: 'application/pdf' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum size'))).toBe(true);
    });

    it('should reject executable files by extension', async () => {
      const data = Buffer.from('fake executable');
      const file = new File([data], 'malware.exe', { type: 'application/octet-stream' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('.exe'))).toBe(true);
    });

    it('should reject files with executable MIME types', async () => {
      const data = Buffer.from('test');
      const file = new File([data], 'file.bin', { type: 'application/x-msdownload' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not allowed'))).toBe(true);
    });

    it('should detect executable patterns in file content', async () => {
      const peHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // PE header
      const file = new File([peHeader], 'file.pdf', { type: 'application/pdf' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('executable patterns'))).toBe(true);
    });

    it('should detect zip bombs', async () => {
      const zipBomb = Buffer.alloc(30);
      zipBomb[0] = 0x50; // P
      zipBomb[1] = 0x4B; // K
      zipBomb.writeUInt32LE(100, 18); // 100 bytes compressed
      zipBomb.writeUInt32LE(10000000, 22); // 10MB uncompressed
      const file = new File([zipBomb], 'archive.zip', { type: 'application/zip' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('zip bomb'))).toBe(true);
    });

    it('should reject files with mismatched content and declared type', async () => {
      const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      const file = new File([pdfHeader], 'file.jpg', { type: 'image/jpeg' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('does not match'))).toBe(true);
    });

    it('should use custom max size if provided', async () => {
      const data = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const file = new File([data], 'file.pdf', { type: 'application/pdf' });
      const result = await validateUpload(file, 5 * 1024 * 1024); // Custom 5MB limit
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum size'))).toBe(true);
    });

    it('should handle files with no MIME type declared', async () => {
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([pngData], 'image.png', { type: '' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not allowed'))).toBe(true);
    });

    it('should set fileSize in result', async () => {
      const data = Buffer.from('test data');
      const file = new File([data], 'test.txt', { type: 'text/plain' });
      const result = await validateUpload(file);
      expect(result.fileSize).toBe(data.length);
    });
  });

  describe('Integration: Full validation flow', () => {
    it('should validate legitimate PDF with correct type and size', async () => {
      const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      const file = new File([pdfHeader], 'document.pdf', { type: 'application/pdf' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('application/pdf');
      expect(result.fileSize).toBe(pdfHeader.length);
    });

    it('should reject suspicious file masquerading as image', async () => {
      const exeHeader = Buffer.from([0x4D, 0x5A]); // MZ header
      const file = new File([exeHeader], 'image.png', { type: 'image/png' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('executable'))).toBe(true);
    });

    it('should allow valid JPEG with correct type and size', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const file = new File([jpegHeader], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('image/jpeg');
    });

    it('should collect multiple validation errors', async () => {
      const exeHeader = Buffer.from([0x4D, 0x5A]); // MZ header
      const file = new File([exeHeader], 'program.exe', { type: 'application/octet-stream' });
      const result = await validateUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
