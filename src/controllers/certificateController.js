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
 * Helper to determine API route prefix (/api/api on production nginx proxy, /api locally)
 */
function getApiPrefix(req) {
  const host = req?.headers?.['x-forwarded-host'] || (typeof req?.get === 'function' ? req.get('host') : req?.headers?.host) || '';
  const referer = req?.headers?.['referer'] || '';
  const origin = req?.headers?.['origin'] || '';
  const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
                    host.includes('parivar.me') ||
                    referer.includes('parivar.me') ||
                    origin.includes('parivar.me');

  return isApiApi ? '/api/api' : '/api';
}

/**
 * Helper to construct canonical download and view URLs for a certificate record
 */
function attachCertificateUrls(record, req) {
  if (!record) return record;
  const baseUrl = resolveBaseUrl(req);
  const prefix = getApiPrefix(req);
  const recObj = record.toObject ? record.toObject() : { ...record };
  const recId = String(recObj._id || recObj.id);

  recObj.downloadUrl = `${baseUrl}${prefix}/certificates/download/${recId}`;
  recObj.viewUrl = `${baseUrl}${prefix}/certificates/view/${recId}`;
  recObj.pdfUrl = `${baseUrl}${prefix}/certificates/view/${recId}`;

  return recObj;
}

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


/**
 * Convert Gujarati digits (૦-૯) to standard ASCII digits (0-9)
 */
function normalizeToEnglishDigits(str) {
  if (!str) return '';
  const gujaratiDigits = { '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4', '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9' };
  return String(str).replace(/[૦-૯]/g, (d) => gujaratiDigits[d] || d);
}

/**
 * Generate a safe, readable identifier for certificate filenames
 */
function makeSafeCertificateNumber(num, fallback = 'doc') {
  if (!num) return fallback;
  const eng = normalizeToEnglishDigits(num);
  const cleaned = eng.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
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
// ── 3. Create a new certificate record (Direct DB storage, no server disk storage) ──
exports.createCertificateRecord = async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) {
      return apiResponse(res, 400, 'Type and form data are required');
    }

    const { certificateNumber, primaryName, secondaryName, issuedDate } = extractCommonFields(type, data);

    const safeNum = makeSafeCertificateNumber(certificateNumber, 'new');
    const filename = `certificate-${type}-${safeNum}-${Date.now().toString(36)}.pdf`;

    const newRecord = await Certificate.create({
      type,
      certificateNumber,
      primaryName,
      secondaryName,
      issuedDate,
      data,
      fileName: filename,
      isGenerated: false,
      isDeleted: false,
    });

    return apiResponse(res, 201, 'Certificate record saved successfully', attachCertificateUrls(newRecord, req));
  } catch (error) {
    console.error('Error in createCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error while saving certificate');
  }
};

// ── 4. Update an existing certificate record (Direct DB storage, no server disk storage) ──
exports.updateCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, type } = req.body;

    const existing = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!existing) {
      return apiResponse(res, 404, 'Record not found');
    }

    const docType = type || existing.type;
    const docData = data || existing.data;
    const { certificateNumber, primaryName, secondaryName, issuedDate } = extractCommonFields(docType, docData);

    const safeNum = makeSafeCertificateNumber(certificateNumber || existing.certificateNumber, 'doc');
    const newFilename = `certificate-${docType}-${safeNum}-${Date.now().toString(36)}.pdf`;

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
          fileName: newFilename,
        }
      },
      { new: true }
    );

    return apiResponse(res, 200, 'Certificate record updated successfully', attachCertificateUrls(updated, req));
  } catch (error) {
    console.error('Error in updateCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error while updating certificate');
  }
};

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
// ── 7. Authenticated View PDF (In-memory stream for browser preview, no server disk storage) ──
exports.viewCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return res.status(404).send('Certificate not found');
    }

    const safeNum = makeSafeCertificateNumber(record.certificateNumber, 'doc');
    const filename = `certificate-${record.type}-${safeNum}-${id.toString().slice(-6)}`;
    const html = renderCertificateHtml(record.type, record.data);

    // Generate PDF in memory directly and stream
    const pdfBuffer = await generatePdfFromHtml(html, {
      filename,
      pageRanges: record.type === 'letterhead' ? undefined : '1-2',
    });

    const asciiFilename = (record.fileName || `${filename}.pdf`).replace(/[^a-zA-Z0-9_\-.]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${asciiFilename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Error in viewCertificatePdf:', error);
    return res.status(500).send('Error viewing certificate PDF: ' + error.message);
  }
};

// ── 8. Authenticated Download PDF (In-memory stream for direct download, no server disk storage) ──
exports.downloadCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return res.status(404).json({
        status: 404,
        message: 'Certificate not found',
        data: null
      });
    }

    const safeNum = makeSafeCertificateNumber(record.certificateNumber, 'doc');
    const filename = `certificate-${record.type}-${safeNum}-${id.toString().slice(-6)}`;
    const html = renderCertificateHtml(record.type, record.data);

    // Generate PDF in memory directly
    const pdfBuffer = await generatePdfFromHtml(html, {
      filename,
      pageRanges: record.type === 'letterhead' ? undefined : '1-2',
    });

    const downloadName = (record.fileName || `${filename}.pdf`).replace(/\.pdf$/i, '');
    const cleanFilename = downloadName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const isInline = req.query.view === 'true' || req.query.inline === 'true' || req.path.includes('/view');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${cleanFilename}.pdf"; filename*=UTF-8''${encodeURIComponent(downloadName)}.pdf`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Error in downloadCertificatePdf:', error);
    return res.status(500).json({
      status: 500,
      message: 'Failed to download certificate PDF',
      error: error.message
    });
  }
};

exports.getCertificateDownloadLink = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return apiResponse(res, 404, 'Certificate record not found');
    }

    const baseUrl = resolveBaseUrl(req);
    const prefix = getApiPrefix(req);
    const recId = String(record._id || record.id);
    const token = req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const downloadUrl = `${baseUrl}${prefix}/certificates/download/${recId}${tokenQuery}`;
    const filename = (record.fileName || `${record.type}-certificate.pdf`).replace(/\.pdf$/i, '');

    return apiResponse(res, 200, 'Certificate download link generated successfully', {
      id: recId,
      certificate_number: record.certificateNumber || '',
      type: record.type,
      filename: `${filename}.pdf`,
      download_url: downloadUrl,
    });
  } catch (error) {
    console.error('Error in getCertificateDownloadLink:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// ── 9. Force Re-generate Stored PDF for an Existing Record ──
// ── 9. Dynamic Download Link refresh for an Existing Record ──
exports.regenerateCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!record) {
      return apiResponse(res, 404, 'Certificate record not found');
    }

    return apiResponse(res, 200, 'Certificate download link ready', attachCertificateUrls(record, req));
  } catch (error) {
    console.error('Error in regenerateCertificatePdf:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

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
