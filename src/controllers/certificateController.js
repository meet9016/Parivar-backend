const Certificate = require('../models/certificateModel');
const { apiResponse } = require('../utils/apiResponse');

// Get all certificate records (optionally filter by ?type=marriage)
exports.getCertificates = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type;

    // Fast lean query with projection (exclude large base64 image strings from table list to prevent 30MB payload locks)
    const list = await Certificate.find(filter)
      .select('type certificateNumber primaryName secondaryName issuedDate title createdAt updatedAt data.number data.regNumber data.dateDay data.dateMonth data.dateYear data.hijriYear data.hijriMonth data.dulhaName data.dulhanFullName data.memberName data.dikraDikri data.refNumber data.letterTitle')
      .sort({ createdAt: -1 })
      .lean();

    return apiResponse(res, 200, 'Certificates fetched successfully', {
      list: list || [],
    });
  } catch (error) {
    console.error('Error in getCertificates:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// Get single certificate record by ID (with complete data)
exports.getCertificateRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Certificate.findById(id).lean();
    if (!record) {
      return apiResponse(res, 404, 'Certificate record not found');
    }
    return apiResponse(res, 200, 'Certificate record fetched successfully', record);
  } catch (error) {
    console.error('Error in getCertificateRecordById:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// Create a new certificate record in DB
exports.createCertificateRecord = async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) {
      return apiResponse(res, 400, 'Type and form data are required');
    }

    let certificateNumber = data.number || data.refNumber || '';
    let primaryName = '';
    let secondaryName = '';
    let issuedDate = '';

    if (type === 'marriage') {
      primaryName = data.dulhaName || '';
      secondaryName = data.dulhanFullName || '';
      issuedDate = [data.dateDay, data.dateMonth, data.dateYear ? `20${data.dateYear}` : ''].filter(Boolean).join('/');
    } else if (type === 'noc') {
      primaryName = data.memberName || '';
      secondaryName = data.dikraDikri || '';
      issuedDate = [data.dateDay, data.dateMonth, data.dateYear ? `20${data.dateYear}` : ''].filter(Boolean).join('/');
    } else if (type === 'letterhead') {
      issuedDate = data.date || '';
      primaryName = data.refNumber || 'Letter';
    }

    const newRecord = await Certificate.create({
      type,
      certificateNumber,
      primaryName,
      secondaryName,
      issuedDate,
      data,
    });

    return apiResponse(res, 201, 'Certificate record saved successfully', newRecord);
  } catch (error) {
    console.error('Error in createCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// Update an existing certificate record
exports.updateCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, type } = req.body;

    let certificateNumber = data?.number || data?.refNumber || '';
    let primaryName = '';
    let secondaryName = '';
    let issuedDate = '';

    if (type === 'marriage') {
      primaryName = data?.dulhaName || '';
      secondaryName = data?.dulhanFullName || '';
      issuedDate = [data?.dateDay, data?.dateMonth, data?.dateYear ? `20${data.dateYear}` : ''].filter(Boolean).join('/');
    } else if (type === 'noc') {
      primaryName = data?.memberName || '';
      secondaryName = data?.dikraDikri || '';
      issuedDate = [data?.dateDay, data?.dateMonth, data?.dateYear ? `20${data.dateYear}` : ''].filter(Boolean).join('/');
    } else if (type === 'letterhead') {
      issuedDate = data?.date || '';
      primaryName = data?.refNumber || 'Letter';
    }

    const updated = await Certificate.findByIdAndUpdate(
      id,
      {
        $set: {
          data,
          certificateNumber,
          primaryName,
          secondaryName,
          issuedDate,
        }
      },
      { new: true }
    );

    if (!updated) {
      return apiResponse(res, 404, 'Record not found');
    }

    return apiResponse(res, 200, 'Certificate record updated successfully', updated);
  } catch (error) {
    console.error('Error in updateCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// Delete a certificate record
exports.deleteCertificateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await Certificate.findByIdAndDelete(id);
    return apiResponse(res, 200, 'Certificate record deleted successfully');
  } catch (error) {
    console.error('Error in deleteCertificateRecord:', error);
    return apiResponse(res, 500, error.message || 'Server error');
  }
};

// Save bulk/active certificates for compatibility
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

// Generate and download PDF from rendered HTML
exports.generateCertificatePdf = async (req, res) => {
  try {
    const { html, filename, pageRanges } = req.body;
    if (!html) {
      return apiResponse(res, 400, 'HTML content is required for PDF generation');
    }

    const { generatePdfFromHtml } = require('../services/pdfService');
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


