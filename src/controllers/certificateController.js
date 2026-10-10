const path = require('path');
const fs = require('fs');
const Certificate = require('../models/certificateModel');
const { apiResponse } = require('../utils/apiResponse');
const {
  saveCertificatePdf,
  replaceCertificatePdf,
  moveCertificatePdfToTrash,
  deleteCertificatePdf,
  certificatePdfExists,
  resolveCertificateDiskPath,
  resolveBaseUrl,
  sanitizeFilename,
} = require('../services/certificateStorageService');
const { generatePdfFromHtml, synchronizedGeneratePdf } = require('../services/pdfService');
const { renderCertificateHtml } = require('../templates/certificateTemplateService');

/**
 * Helper to construct canonical download and view URLs for a certificate record
 */
function attachCertificateUrls(record, req) {
  if (!record) return record;
  const baseUrl = resolveBaseUrl(req);
  const recObj = record.toObject ? record.toObject() : { ...record };
  const recId = String(recObj._id || recObj.id);

  recObj.downloadUrl = `${baseUrl}/api/certificates/download/${recId}`;
  recObj.viewUrl = `${baseUrl}/api/certificates/view/${recId}`;

  if (recObj.pdfPath && !recObj.pdfUrl) {
    recObj.pdfUrl = `${baseUrl}${recObj.pdfPath.startsWith('/') ? recObj.pdfPath : `/${recObj.pdfPath}`}`;
  }
  return recObj;
}

/**
 * Helper to derive safe tenant slug from request
 */
function getTenantSlugFromReq(req) {
  return req.tenantSlug || req.headers['x-tenant-id'] || 'default';
}

/**
 * Helper to extract common certificate fields
 */
function extractCommonFields(type, data = {}) {
  let certificateNumber = data.number || data.regNumber || '';
  let primaryName = '';
  let secondaryName = '';
  let issuedDate = '';

  if (type === 'marriage') {
    primaryName = data.dulhaName || '';
    secondaryName = data.dulhanFullName || '';
    issuedDate = [data.dateDay, data.dateMonth, data.dateYear ? (data.dateYear.length === 2 ? `20${data.dateYear}` : data.dateYear) : ''].filter(Boolean).join('/');
  } else if (type === 'noc') {
    primaryName = data.memberName || '';
    secondaryName = data.dikraDikri || '';
    issuedDate = [data.dateDay, data.dateMonth, data.dateYear ? (data.dateYear.length === 2 ? `20${data.dateYear}` : data.dateYear) : ''].filter(Boolean).join('/');
  } else if (type === 'letterhead') {
    issuedDate = data.date || '';
    primaryName = data.refNumber || 'Letter';
    secondaryName = data.letterTitle || data.subject || '';
  }

  return { certificateNumber, primaryName, secondaryName, issuedDate };
}

// ── 1. Get all certificates (with soft-delete filter & storage metadata) ──
exports.getCertificates = async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = { isDeleted: { $ne: true } };
    if (type) filter.type = type;

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { certificateNumber: { $regex: term, $options: 'i' } },
        { primaryName: { $regex: term, $options: 'i' } },
        { secondaryName: { $regex: term, $options: 'i' } },
        { issuedDate: { $regex: term, $options: 'i' } },
      ];
    }

    const list = await Certificate.find(filter)
      .select('type certificateNumber primaryName secondaryName issuedDate title pdfUrl pdfPath fileName fileSize isGenerated createdAt updatedAt data.number data.regNumber data.dateDay data.dateMonth data.dateYear data.hijriYear data.hijriMonth data.dulhaName data.dulhanFullName data.memberName data.dikraDikri data.refNumber data.letterTitle')
      .sort({ createdAt: -1 })
      .lean();

    const enrichedList = (list || []).map(r => attachCertificateUrls(r, req));

    return apiResponse(res, 200, 'Certificates fetched successfully', {
      list: enrichedList,
      total: enrichedList.length,
    });
  } catch (error) {
    console.error('Error in getCertificates:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 2. Get single certificate record by ID ──
exports.getCertificateRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
    if (!record) {
      return apiResponse(res, 404, 'Certificate record not found');
    }
    return apiResponse(res, 200, 'Certificate record fetched successfully', attachCertificateUrls(record, req));
  } catch (error) {
    console.error('Error in getCertificateRecordById:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 3. Create a new certificate record & store PDF ──
exports.createCertificateRecord = async (req, res) => {
  try {
    const { type, data, html } = req.body;
    if (!type || !data) {
      return apiResponse(res, 400, 'Type and form data are required');
    }

    const tenantSlug = getTenantSlugFromReq(req);
    const { certificateNumber, primaryName, secondaryName, issuedDate } = extractCommonFields(type, data);

    // Build unique filename
    const safeNum = (certificateNumber || 'new').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `certificate-${type}-${safeNum}-${Date.now().toString(36)}`;

    // Generate or receive PDF buffer
    let pdfBuffer = null;
    if (req.file && req.file.buffer) {
      // Direct Multer multipart PDF upload
      pdfBuffer = req.file.buffer;
    } else if (html && typeof html === 'string' && html.trim().length > 50) {
      // High-fidelity rendered HTML from Web Admin
      pdfBuffer = await generatePdfFromHtml(html, {
        filename,
        pageRanges: type === 'letterhead' ? undefined : '1-2',
      });
    } else {
      // Server-side fallback template for external API clients
      const serverHtml = renderCertificateHtml(type, data);
      pdfBuffer = await generatePdfFromHtml(serverHtml, {
        filename,
        pageRanges: type === 'letterhead' ? undefined : '1-2',
      });
    }

    // Save to shared storage service
    const storageMeta = await saveCertificatePdf({
      buffer: pdfBuffer,
      filename,
      tenantSlug,
      req,
      type,
    });

    const newRecord = await Certificate.create({
      type,
      certificateNumber,
      primaryName,
      secondaryName,
      issuedDate,
      data,
      pdfUrl: storageMeta.pdfUrl,
      pdfPath: storageMeta.pdfPath,
      fileName: storageMeta.fileName,
      fileSize: storageMeta.fileSize,
      mimeType: storageMeta.mimeType,
      storageProvider: storageMeta.storageProvider,
      generatedAt: storageMeta.generatedAt,
      isGenerated: true,
      isDeleted: false,
    });

    return apiResponse(res, 201, 'Certificate record saved and PDF generated successfully', attachCertificateUrls(newRecord, req));
  } catch (error) {
    console.error('Error in createCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error while generating and saving certificate');
  }
};

// ── 4. Update an existing certificate record & atomically replace PDF ──
exports.updateCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, type, html } = req.body;

    const existing = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!existing) {
      return apiResponse(res, 404, 'Record not found');
    }

    const docType = type || existing.type;
    const docData = data || existing.data;
    const tenantSlug = getTenantSlugFromReq(req);
    const { certificateNumber, primaryName, secondaryName, issuedDate } = extractCommonFields(docType, docData);

    const safeNum = (certificateNumber || existing.certificateNumber || 'doc').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const newFilename = `certificate-${docType}-${safeNum}-${Date.now().toString(36)}`;

    // Generate or receive new PDF buffer
    let newPdfBuffer = null;
    if (req.file && req.file.buffer) {
      newPdfBuffer = req.file.buffer;
    } else if (html && typeof html === 'string' && html.trim().length > 50) {
      newPdfBuffer = await generatePdfFromHtml(html, {
        filename: newFilename,
        pageRanges: docType === 'letterhead' ? undefined : '1-2',
      });
    } else {
      const serverHtml = renderCertificateHtml(docType, docData);
      newPdfBuffer = await generatePdfFromHtml(serverHtml, {
        filename: newFilename,
        pageRanges: docType === 'letterhead' ? undefined : '1-2',
      });
    }

    // Atomic replace in storage: writes new file, verifies it, then safely deletes old file
    const storageMeta = await replaceCertificatePdf({
      oldPdfPath: existing.pdfPath,
      newBuffer: newPdfBuffer,
      newFilename,
      tenantSlug,
      req,
      type: docType,
    });

    const updated = await Certificate.findByIdAndUpdate(
      id,
      {
        $set: {
          data: docData,
          type: docType,
          certificateNumber,
          primaryName,
          secondaryName,
          issuedDate,
          pdfUrl: storageMeta.pdfUrl,
          pdfPath: storageMeta.pdfPath,
          fileName: storageMeta.fileName,
          fileSize: storageMeta.fileSize,
          mimeType: storageMeta.mimeType,
          storageProvider: storageMeta.storageProvider,
          generatedAt: storageMeta.generatedAt,
          isGenerated: true,
        }
      },
      { new: true }
    );

    return apiResponse(res, 200, 'Certificate record and PDF updated successfully', attachCertificateUrls(updated, req));
  } catch (error) {
    console.error('Error in updateCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error while updating certificate');
  }
};

// ── 5. Recoverable Soft-Delete a certificate record ──
exports.deleteCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!existing) {
      return apiResponse(res, 404, 'Certificate record not found');
    }

    const tenantSlug = getTenantSlugFromReq(req);

    // Move file to .trash for recoverable deletion
    if (existing.pdfPath) {
      await moveCertificatePdfToTrash(existing.pdfPath, tenantSlug);
    }

    // Soft-delete in database
    await Certificate.findByIdAndUpdate(id, {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user?._id || null,
      }
    });

    return apiResponse(res, 200, 'Certificate record deleted successfully');
  } catch (error) {
    console.error('Error in deleteCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 6. Restore a soft-deleted certificate record ──
exports.restoreCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const restored = await Certificate.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null } },
      { new: true }
    );
    if (!restored) {
      return apiResponse(res, 404, 'Deleted record not found');
    }
    return apiResponse(res, 200, 'Certificate record restored successfully', attachCertificateUrls(restored, req));
  } catch (error) {
    console.error('Error in restoreCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 7. Authenticated View PDF (Inline stream for in-app browser view) ──
exports.viewCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return res.status(404).send('Certificate not found');
    }

    const tenantSlug = getTenantSlugFromReq(req);
    let diskPath = resolveCertificateDiskPath(record.pdfPath, tenantSlug);
    const fileExists = diskPath && (await certificatePdfExists(record.pdfPath, tenantSlug));

    // Self-healing recovery: If file is missing on disk, regenerate on-demand
    if (!fileExists) {
      console.warn(`[Self-Healing] Missing PDF detected for certificate ${id}. Regenerating...`);
      await synchronizedGeneratePdf(`regen_${id}`, async () => {
        const safeNum = (record.certificateNumber || 'doc').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const filename = `certificate-${record.type}-${safeNum}-${id.toString().slice(-6)}`;
        const html = renderCertificateHtml(record.type, record.data);
        const buffer = await generatePdfFromHtml(html, {
          filename,
          pageRanges: record.type === 'letterhead' ? undefined : '1-2',
        });
        const meta = await saveCertificatePdf({
          buffer,
          filename,
          tenantSlug,
          req,
          type: record.type,
        });
        record.pdfUrl = meta.pdfUrl;
        record.pdfPath = meta.pdfPath;
        record.fileName = meta.fileName;
        record.fileSize = meta.fileSize;
        record.isGenerated = true;
        record.generatedAt = meta.generatedAt;
        await record.save();
        diskPath = resolveCertificateDiskPath(meta.pdfPath, tenantSlug);
      });
    }

    const asciiFilename = (record.fileName || 'certificate.pdf').replace(/[^a-zA-Z0-9_\-.]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${asciiFilename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const fileStream = fs.createReadStream(diskPath);
    return fileStream.pipe(res);
  } catch (error) {
    console.error('Error in viewCertificatePdf:', error);
    return res.status(500).send('Error viewing certificate PDF: ' + error.message);
  }
};

// ── 8. Authenticated Download PDF (Attachment stream for direct download) ──
exports.downloadCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return res.status(404).send('Certificate not found');
    }

    const tenantSlug = getTenantSlugFromReq(req);
    let diskPath = resolveCertificateDiskPath(record.pdfPath, tenantSlug);
    const fileExists = diskPath && (await certificatePdfExists(record.pdfPath, tenantSlug));

    // Self-healing recovery: If file is missing on disk, regenerate on-demand
    if (!fileExists) {
      console.warn(`[Self-Healing] Missing PDF detected for certificate ${id}. Regenerating...`);
      await synchronizedGeneratePdf(`regen_${id}`, async () => {
        const safeNum = (record.certificateNumber || 'doc').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const filename = `certificate-${record.type}-${safeNum}-${id.toString().slice(-6)}`;
        const html = renderCertificateHtml(record.type, record.data);
        const buffer = await generatePdfFromHtml(html, {
          filename,
          pageRanges: record.type === 'letterhead' ? undefined : '1-2',
        });
        const meta = await saveCertificatePdf({
          buffer,
          filename,
          tenantSlug,
          req,
          type: record.type,
        });
        record.pdfUrl = meta.pdfUrl;
        record.pdfPath = meta.pdfPath;
        record.fileName = meta.fileName;
        record.fileSize = meta.fileSize;
        record.isGenerated = true;
        record.generatedAt = meta.generatedAt;
        await record.save();
        diskPath = resolveCertificateDiskPath(meta.pdfPath, tenantSlug);
      });
    }

    const downloadName = (record.fileName || `${record.type}-certificate.pdf`).replace(/\.pdf$/i, '');
    const asciiFilename = downloadName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const encodedFilename = encodeURIComponent(downloadName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}.pdf"; filename*=UTF-8''${encodedFilename}.pdf`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const fileStream = fs.createReadStream(diskPath);
    return fileStream.pipe(res);
  } catch (error) {
    console.error('Error in downloadCertificatePdf:', error);
    return res.status(500).send('Error downloading certificate PDF: ' + error.message);
  }
};

// ── 9. Force Re-generate Stored PDF for an Existing Record ──
exports.regenerateCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return apiResponse(res, 404, 'Certificate record not found');
    }

    const tenantSlug = getTenantSlugFromReq(req);
    const safeNum = (record.certificateNumber || 'doc').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const newFilename = `certificate-${record.type}-${safeNum}-${Date.now().toString(36)}`;

    const html = renderCertificateHtml(record.type, record.data);
    const buffer = await generatePdfFromHtml(html, {
      filename: newFilename,
      pageRanges: record.type === 'letterhead' ? undefined : '1-2',
    });

    const storageMeta = await replaceCertificatePdf({
      oldPdfPath: record.pdfPath,
      newBuffer: buffer,
      newFilename,
      tenantSlug,
      req,
      type: record.type,
    });

    record.pdfUrl = storageMeta.pdfUrl;
    record.pdfPath = storageMeta.pdfPath;
    record.fileName = storageMeta.fileName;
    record.fileSize = storageMeta.fileSize;
    record.isGenerated = true;
    record.generatedAt = storageMeta.generatedAt;
    await record.save();

    return apiResponse(res, 200, 'Certificate PDF regenerated successfully', attachCertificateUrls(record, req));
  } catch (error) {
    console.error('Error in regenerateCertificatePdf:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 10. Bounded Bulk Download URL resolution ──
exports.bulkDownloadCertificates = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return apiResponse(res, 400, 'Array of certificate IDs is required');
    }

    if (ids.length > 25) {
      return apiResponse(res, 400, 'Batch size limit exceeded: Maximum 25 certificates allowed per bulk download');
    }

    const records = await Certificate.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).lean();
    const enriched = records.map(r => attachCertificateUrls(r, req));

    return apiResponse(res, 200, 'Bulk download records resolved successfully', {
      total: enriched.length,
      records: enriched,
    });
  } catch (error) {
    console.error('Error in bulkDownloadCertificates:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 11. Ephemeral PDF generation from raw HTML (Legacy Backward Compatibility) ──
exports.generateCertificatePdf = async (req, res) => {
  try {
    const { html, filename, pageRanges } = req.body;
    if (!html) {
      return apiResponse(res, 400, 'HTML content is required for PDF generation');
    }

    const pdfBuffer = await generatePdfFromHtml(html, { filename, pageRanges });

    const asciiFilename = (filename || 'certificate').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const encodedFilename = encodeURIComponent(filename || 'certificate');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}.pdf"; filename*=UTF-8''${encodedFilename}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('Error in generateCertificatePdf:', error);
    return apiResponse(res, 500, error.message || 'PDF Generation failed');
  }
};

// ── 12. Save active bulk certificates for legacy compatibility ──
exports.saveCertificates = async (req, res) => {
  try {
    const { marriage, letterhead, noc } = req.body;
    const updates = [];

    if (marriage) {
      updates.push(
        Certificate.findOneAndUpdate(
          { type: 'marriage' },
          { $set: { data: marriage, certificateNumber: marriage.number || '' } },
          { upsert: true, new: true }
        )
      );
    }
    if (letterhead) {
      updates.push(
        Certificate.findOneAndUpdate(
          { type: 'letterhead' },
          { $set: { data: letterhead, certificateNumber: letterhead.refNumber || '' } },
          { upsert: true, new: true }
        )
      );
    }
    if (noc) {
      updates.push(
        Certificate.findOneAndUpdate(
          { type: 'noc' },
          { $set: { data: noc, certificateNumber: noc.number || '' } },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(updates);
    return apiResponse(res, 200, 'Certificate data saved successfully to database');
  } catch (error) {
    console.error('Error in saveCertificates:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};
