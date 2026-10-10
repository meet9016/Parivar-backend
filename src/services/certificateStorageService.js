const fs = require('fs');
const path = require('path');
const { uploadToExternalService, deleteFileFromExternalService } = require('../utils/fileUpload');

// Base storage directory for local certificate files (defaults to public/uploads/certificates)
const BASE_LOCAL_DIR = process.env.CERTIFICATE_STORAGE_DIR
  ? path.resolve(process.env.CERTIFICATE_STORAGE_DIR)
  : path.resolve(__dirname, '../../public/uploads/certificates');

/**
 * Sanitize tenant slug for filesystem safety
 */
function sanitizeTenantSlug(tenantSlug) {
  if (!tenantSlug || typeof tenantSlug !== 'string') {
    return 'default';
  }
  const clean = tenantSlug.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase().trim();
  return clean || 'default';
}

/**
 * Resolve canonical base URL for external links (avoids hardcoding localhost)
 */
function resolveBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
    return `${protocol}://${host}`;
  }
  return 'http://localhost:5000';
}

/**
 * Ensure tenant directory exists and assert path safety
 */
async function ensureTenantDir(tenantSlug) {
  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const tenantDir = path.join(BASE_LOCAL_DIR, safeSlug);

  // Path traversal guard
  if (!tenantDir.startsWith(BASE_LOCAL_DIR)) {
    throw new Error('Security Error: Tenant directory traversal detected');
  }

  await fs.promises.mkdir(tenantDir, { recursive: true });
  return tenantDir;
}

/**
 * Ensure trash directory exists for recoverable deletions
 */
async function ensureTrashDir(tenantSlug) {
  const tenantDir = await ensureTenantDir(tenantSlug);
  const trashDir = path.join(tenantDir, '.trash');
  await fs.promises.mkdir(trashDir, { recursive: true });
  return trashDir;
}

/**
 * Assert that a resolved target path strictly resides within the allowed base directory
 */
function assertSafePath(targetPath, allowedBaseDir) {
  const normalizedTarget = path.normalize(path.resolve(targetPath));
  const normalizedBase = path.normalize(path.resolve(allowedBaseDir));
  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error('Security Error: Path traversal outside allowed storage directory');
  }
  return normalizedTarget;
}

/**
 * Sanitize file name for safe storage
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `certificate-${Date.now()}`;
  }
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 100);
}

/**
 * Save a PDF Buffer to storage
 * Supports 'local' (default) and 'external' driver via environment configuration
 */
async function saveCertificatePdf({ buffer, filename, tenantSlug, req, type = 'marriage' }) {
  const nodeBuffer = buffer ? (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)) : null;
  if (!nodeBuffer || nodeBuffer.length === 0) {
    throw new Error('Storage Error: Invalid or empty PDF buffer provided');
  }

  const driver = (process.env.CERTIFICATE_STORAGE_DRIVER || 'local').toLowerCase();
  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const safeBaseName = sanitizeFilename(filename);
  const finalFileName = `${safeBaseName}.pdf`;

  if (driver === 'external') {
    // Route to external media service if configured
    const mockMulterFile = {
      buffer: nodeBuffer,
      originalname: finalFileName,
      mimetype: 'application/pdf',
      size: nodeBuffer.length,
    };
    const fileUrl = await uploadToExternalService(mockMulterFile, `certificates/${safeSlug}`);
    return {
      pdfUrl: fileUrl,
      pdfPath: fileUrl,
      fileName: finalFileName,
      fileSize: nodeBuffer.length,
      mimeType: 'application/pdf',
      storageProvider: 'external',
      isGenerated: true,
      generatedAt: new Date(),
    };
  }

  // Local Persistent Disk Storage
  const tenantDir = await ensureTenantDir(safeSlug);
  const targetFilePath = assertSafePath(path.join(tenantDir, finalFileName), tenantDir);

  // Atomic write to avoid partial/corrupted files
  const tempPath = `${targetFilePath}.tmp.${Date.now()}`;
  await fs.promises.writeFile(tempPath, nodeBuffer);
  await fs.promises.rename(tempPath, targetFilePath);

  // Verify file size on disk
  const stat = await fs.promises.stat(targetFilePath);
  if (stat.size === 0) {
    try { await fs.promises.unlink(targetFilePath); } catch (_) {}
    throw new Error('Storage Error: Written PDF file has 0 bytes');
  }

  // Generate accessible relative path and canonical full URL
  const relativePath = `/uploads/certificates/${safeSlug}/${finalFileName}`;
  const baseUrl = resolveBaseUrl(req);
  const fullUrl = `${baseUrl}${relativePath}`;

  return {
    pdfUrl: fullUrl,
    pdfPath: relativePath,
    fileName: finalFileName,
    fileSize: stat.size,
    mimeType: 'application/pdf',
    storageProvider: 'local',
    isGenerated: true,
    generatedAt: new Date(),
  };
}

/**
 * Atomically replace an existing certificate PDF with a new one
 * Ensures the old file is only removed AFTER the new file is safely verified on disk
 */
async function replaceCertificatePdf({ oldPdfPath, newBuffer, newFilename, tenantSlug, req, type = 'marriage' }) {
  // Step 1: Write and verify the new PDF file
  const newStorageResult = await saveCertificatePdf({
    buffer: newBuffer,
    filename: newFilename,
    tenantSlug,
    req,
    type,
  });

  // Step 2: If new file was written successfully and an old path exists, safely remove old file
  if (oldPdfPath && typeof oldPdfPath === 'string' && oldPdfPath !== newStorageResult.pdfPath) {
    try {
      await deleteCertificatePdf(oldPdfPath, tenantSlug);
    } catch (oldErr) {
      console.warn('Storage Warning: Could not remove superseded PDF file:', oldErr.message);
    }
  }

  return newStorageResult;
}

/**
 * Move a certificate PDF to .trash directory for recoverable deletion
 */
async function moveCertificatePdfToTrash(pdfPath, tenantSlug) {
  if (!pdfPath || typeof pdfPath !== 'string') return false;

  const driver = (process.env.CERTIFICATE_STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'external') {
    // For external service, we retain the URL or delete directly
    return true;
  }

  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const fileName = path.basename(pdfPath);
  const tenantDir = await ensureTenantDir(safeSlug);
  const sourcePath = assertSafePath(path.join(tenantDir, fileName), tenantDir);

  try {
    await fs.promises.access(sourcePath);
  } catch (_) {
    // File not found on disk, nothing to move
    return false;
  }

  const trashDir = await ensureTrashDir(safeSlug);
  const targetTrashPath = path.join(trashDir, `${Date.now()}_${fileName}`);

  try {
    await fs.promises.rename(sourcePath, targetTrashPath);
    return true;
  } catch (err) {
    console.warn('Storage Warning: Failed to move PDF to .trash:', err.message);
    return false;
  }
}

/**
 * Permanently delete a certificate PDF from storage
 */
async function deleteCertificatePdf(pdfPath, tenantSlug) {
  if (!pdfPath || typeof pdfPath !== 'string') return true;

  const driver = (process.env.CERTIFICATE_STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'external' || pdfPath.startsWith('http')) {
    try {
      await deleteFileFromExternalService(pdfPath);
    } catch (_) {}
    return true;
  }

  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const fileName = path.basename(pdfPath);
  const tenantDir = await ensureTenantDir(safeSlug);
  const targetPath = assertSafePath(path.join(tenantDir, fileName), tenantDir);

  try {
    await fs.promises.unlink(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return true; // Already deleted
    }
    console.warn('Storage Warning: Could not delete PDF file:', err.message);
    return false;
  }
}

/**
 * Check if a certificate PDF exists on disk and is non-empty
 */
async function certificatePdfExists(pdfPath, tenantSlug) {
  if (!pdfPath || typeof pdfPath !== 'string') return false;

  const driver = (process.env.CERTIFICATE_STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'external' || pdfPath.startsWith('http')) {
    return true; // Remote file reference assumed valid
  }

  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const fileName = path.basename(pdfPath);
  const tenantDir = path.join(BASE_LOCAL_DIR, safeSlug);
  const targetPath = path.join(tenantDir, fileName);

  try {
    const stat = await fs.promises.stat(targetPath);
    return stat.size > 0;
  } catch (_) {
    return false;
  }
}

/**
 * Resolve the absolute disk path for streaming a certificate PDF safely
 */
function resolveCertificateDiskPath(pdfPath, tenantSlug) {
  if (!pdfPath || typeof pdfPath !== 'string') return null;

  const safeSlug = sanitizeTenantSlug(tenantSlug);
  const fileName = path.basename(pdfPath);
  const tenantDir = path.join(BASE_LOCAL_DIR, safeSlug);
  const targetPath = path.join(tenantDir, fileName);

  return assertSafePath(targetPath, BASE_LOCAL_DIR);
}

module.exports = {
  saveCertificatePdf,
  replaceCertificatePdf,
  moveCertificatePdfToTrash,
  deleteCertificatePdf,
  certificatePdfExists,
  resolveCertificateDiskPath,
  resolveBaseUrl,
  sanitizeTenantSlug,
  sanitizeFilename,
};
