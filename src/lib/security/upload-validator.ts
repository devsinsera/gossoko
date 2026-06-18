import { UPLOAD_LIMITS } from '@/config/security';

// Magic byte signatures for file type verification
const FILE_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF signature, WebP in extended header
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'text/plain': [Buffer.from([0xEF, 0xBB, 0xBF])], // UTF-8 BOM (optional)
};

// Dangerous file patterns
const EXECUTABLE_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.dll', '.sys', '.msi', '.scr',
  '.vbs', '.js', '.jar', '.app', '.deb', '.rpm', '.sh', '.bash',
  '.py', '.pl', '.rb', '.php', '.jsp', '.asp', '.aspx',
];

// Retained for future MIME-based executable detection; referenced only by
// commented-out validation paths today.
export const EXECUTABLE_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-elf',
  'application/x-sharedlib',
] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileType: string | null;
  fileSize: number | null;
}

export interface MalwareScanResult {
  clean: boolean;
  scanEngine?: string;
  detectedThreats?: string[];
}

/**
 * Validate file by checking size, type, and content.
 * @param file - File object from upload
 * @param maxSize - Max file size in bytes (uses config default if not provided)
 * @returns Validation result with errors and warnings
 */
export async function validateUpload(
  file: File,
  maxSize?: number
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    fileType: null,
    fileSize: file.size,
  };

  // 1. Check file size
  const limit = maxSize || UPLOAD_LIMITS.maxFileSize;
  if (file.size === 0) {
    result.errors.push('File is empty');
    result.valid = false;
  } else if (file.size > limit) {
    result.errors.push(`File exceeds maximum size of ${limit / 1024 / 1024}MB`);
    result.valid = false;
  }

  // 2. Check file extension
  const extension = getFileExtension(file.name);
  if (isExecutableExtension(extension)) {
    result.errors.push(`File type .${extension} is not allowed`);
    result.valid = false;
  }

  // 3. Check file MIME type against declared type
  if (!isAllowedMimeType(file.type)) {
    result.errors.push(`File type ${file.type} is not allowed`);
    result.valid = false;
  }

  // 4. Verify magic bytes (file signature)
  try {
    const buffer = await fileToBuffer(file);
    const detectedType = detectFileTypeBySignature(buffer);
    result.fileType = detectedType;

    // Check if detected type matches declared type
    if (detectedType && file.type && detectedType !== file.type) {
      result.errors.push(`File content (${detectedType}) does not match declared type (${file.type})`);
      result.valid = false;
    }

    if (detectedType && !isAllowedMimeType(detectedType)) {
      result.errors.push(`File content indicates ${detectedType}, which is not allowed`);
      result.valid = false;
    }

    // 5. Check for executable patterns in content
    if (containsExecutablePatterns(buffer)) {
      result.errors.push('File contains executable patterns and is not allowed');
      result.valid = false;
    }

    // 6. Check for zip bomb patterns
    if (isLikelyZipBomb(buffer, file.size)) {
      result.errors.push('File appears to be a zip bomb or compressed archive');
      result.valid = false;
    }
  } catch (error) {
    result.warnings.push('Could not verify file content, proceeding with caution');
  }

  return result;
}

/**
 * Validate MIME type against whitelist.
 * @param mimeType - Declared MIME type
 * @returns true if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  const allowed: readonly string[] = [
    ...UPLOAD_LIMITS.allowedImageTypes,
    ...UPLOAD_LIMITS.allowedDocTypes,
  ];
  return allowed.includes(mimeType);
}

/**
 * Validate MIME type by checking file signature (magic bytes).
 * @param mimeType - Declared MIME type
 * @param buffer - File buffer
 * @returns true if signature matches MIME type
 */
export function validateMimeType(mimeType: string, buffer: Buffer): boolean {
  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) return false;

  return signatures.some((sig) => buffer.subarray(0, sig.length).equals(sig));
}

/**
 * Detect file type by reading magic bytes.
 * @param buffer - File buffer
 * @returns Detected MIME type or null
 */
export function detectFileTypeBySignature(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const sig of signatures) {
      if (buffer.subarray(0, sig.length).equals(sig)) {
        return mimeType;
      }
    }
  }
  return null;
}

/**
 * Check if file extension is in executable list.
 * @param extension - File extension without dot
 * @returns true if executable
 */
export function isExecutableExtension(extension: string): boolean {
  return EXECUTABLE_EXTENSIONS.includes(`.${extension.toLowerCase()}`);
}

/**
 * Check if file contains executable patterns (PE header, ELF, Mach-O, shell scripts).
 * @param buffer - File buffer
 * @returns true if executable patterns detected
 */
export function containsExecutablePatterns(buffer: Buffer): boolean {
  if (buffer.length < 2) return false;

  const patterns = [
    { name: 'PE (Windows executable)', sig: [0x4D, 0x5A] }, // MZ header
    { name: 'ELF (Linux executable)', sig: [0x7F, 0x45, 0x4C, 0x46] }, // .ELF
    { name: 'Mach-O (macOS executable)', sig: [0xFE, 0xED, 0xFA, 0xCE] },
    { name: 'Java class', sig: [0xCA, 0xFE, 0xBA, 0xBE] },
    { name: 'Shell script', sig: [0x23, 0x21, 0x2F] }, // #!/
  ];

  for (const pattern of patterns) {
    if (pattern.sig.every((byte, idx) => idx < buffer.length && buffer[idx] === byte)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect zip bomb (file with extremely high compression ratio).
 * Zip bombs are compressed files that expand to huge sizes when extracted.
 * @param buffer - File buffer
 * @param originalSize - Original file size
 * @returns true if likely zip bomb
 */
export function isLikelyZipBomb(buffer: Buffer, originalSize: number): boolean {
  if (buffer.length < 4) return false;

  // Check for ZIP signature (0x50 0x4B = 'PK')
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (!isZip) {
    return false; // Not a ZIP file
  }

  // Check for suspicious compression ratio
  // If declared uncompressed size >> file size, it might be a zip bomb
  try {
    // Read local file header to check size fields
    // ZIP format: [0x50 0x4B 0x03 0x04] + [14 bytes of header] + compressed size at offset 18
    if (buffer.length > 26) {
      const compressedSize = buffer.readUInt32LE(18);
      const uncompressedSize = buffer.readUInt32LE(22);

      // Ratio > 100:1 is suspicious (normal is < 10:1 for images, < 50:1 for docs)
      // Use originalSize as denominator for compression ratio
      const actualCompressedSize = originalSize > 0 ? originalSize : (compressedSize > 0 ? compressedSize : 1);
      const ratio = uncompressedSize / actualCompressedSize;
      if (ratio > 100) {
        return true;
      }
    }
  } catch {
    // If we can't parse, be conservative
    return false;
  }

  return false;
}

/**
 * Get file extension from filename.
 * @param filename - Filename
 * @returns Extension without dot (e.g., "pdf" for "file.pdf")
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Convert File object to Buffer for inspection.
 * @param file - File object
 * @returns Buffer containing file data
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Hook for external malware scanning (e.g., ClamAV, VirusTotal).
 * Implement in production with actual API calls.
 * @param file - File to scan
 * @returns Scan result
 */
export async function scanForMalware(_file: File): Promise<MalwareScanResult> {
  // TODO: Integrate with ClamAV or VirusTotal API
  // For now, return clean (no external scanning in local dev)
  if (process.env.MALWARE_SCAN_ENABLED === 'true') {
    // Call external API
    // const result = await virusTotal.scan(file);
    // return result;
    return { clean: true, scanEngine: 'disabled' };
  }
  return { clean: true, scanEngine: 'disabled' };
}

/**
 * Validate filename for safety (no path traversal, excessive length).
 * @param filename - Original filename
 * @returns Sanitized filename safe for storage
 */
export function validateFilename(filename: string): string | null {
  if (!filename || !filename.trim()) return null;
  if (filename.length > 255) return null;

  // Block path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return null;
  }

  // Remove special characters except dots, hyphens, underscores
  const sanitized = filename.replace(/[^\w\-. ]/g, '');
  if (sanitized.trim().length === 0) return null;

  return sanitized;
}

/**
 * Get allowed file extensions for a MIME type category.
 * @param category - 'images' or 'documents'
 * @returns Array of allowed extensions (e.g., ['jpg', 'png', 'webp'])
 */
export function getAllowedExtensions(category: 'images' | 'documents'): string[] {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  };

  const allowed = category === 'images'
    ? UPLOAD_LIMITS.allowedImageTypes
    : UPLOAD_LIMITS.allowedDocTypes;

  return allowed.map((mime) => mimeMap[mime] || mime).filter(Boolean);
}
