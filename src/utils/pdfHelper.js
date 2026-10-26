const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const { apiResponse } = require('./apiResponse');

/**
 * Common PDF Export Generator
 *
 * @param {Object} options
 * @param {Object} options.req Express request object
 * @param {string} [options.filePrefix='Report'] Filename prefix
 * @param {string} [options.title='Directory Report'] Main title
 * @param {string} [options.subtitle] Optional subtitle / filter details
 * @param {Array<Object>} options.columns Array of { header, key, width, align, bold, color }
 * @param {Array<Object>} [options.rows=[]] Array of row data objects
 * @param {Object} [options.branding] { name, logo, phone, email, primaryColor, secondaryColor }
 * @param {string} [options.orientation='landscape'] 'portrait' | 'landscape'
 * @returns {Promise<{ download_url: string, filename: string, filePath: string }>}
 */
const generatePdfExport = async ({
  req,
  filePrefix = 'Report',
  title = 'Directory Report',
  subtitle,
  columns = [],
  rows = [],
  branding = {},
  orientation = 'landscape'
}) => {
  const isLandscape = orientation === 'landscape';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const leftMargin = 35;
  const rightMargin = 35;
  const topMargin = 35;
  const bottomMargin = 40;
  const printableWidth = pageWidth - leftMargin - rightMargin;

  // Exact Navy Blue matching Excel sheet header (STYLES.header.fill.fgColor: 'FF1B365D')
  const headerColor = '#1B365D';
  const primaryColor = '#1B365D';
  const secondaryColor = branding.secondaryColor || '#42A5F5';
  const communityName = branding.name || 'Parivar Community';
  const communityPhone = branding.phone || '';
  const communityEmail = branding.email || '';

  // Ensure export directory exists
  const exportDir = path.join(__dirname, '../../public/uploads/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Clean up older export files (>24 hours old)
  try {
    const existingFiles = fs.readdirSync(exportDir);
    const now = Date.now();
    for (const file of existingFiles) {
      const fullFilePath = path.join(exportDir, file);
      const stats = fs.statSync(fullFilePath);
      if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(fullFilePath);
      }
    }
  } catch (_) {}

  // Generate unique filename
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanPrefix = String(filePrefix).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanPrefix}_${dateStr}_${timestamp}.pdf`;
  const filePath = path.join(exportDir, filename);

  // Initialize PDFKit Document
  const doc = new PDFDocument({
    size: 'A4',
    layout: orientation,
    margin: leftMargin,
    bufferPages: true,
    autoFirstPage: true
  });

  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // Pre-load and convert logo image (handles WebP, PNG, JPG, SVG)
  let logoBuffer = null;
  const rawLogo = branding.logo || '';
  if (rawLogo && typeof rawLogo === 'string' && rawLogo.trim()) {
    const logoStr = rawLogo.trim();
    try {
      if (/^https?:\/\//i.test(logoStr)) {
        // If it's pointing to local uploads on disk, read directly
        const uploadsMatch = logoStr.match(/\/uploads\/[^?#]+/i);
        if (uploadsMatch) {
          const localRel = uploadsMatch[0].replace(/^\/+/, '');
          const localPath = path.join(__dirname, '../../public', localRel);
          if (fs.existsSync(localPath)) {
            logoBuffer = fs.readFileSync(localPath);
          }
        }

        // If not found locally, fetch via HTTP/HTTPS
        if (!logoBuffer) {
          const resp = await axios.get(logoStr, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (resp.data) {
            logoBuffer = Buffer.from(resp.data);
          }
        }
      } else {
        // Relative file path
        const cleanPath = logoStr.replace(/^\/+/, '');
        const localPath = path.join(__dirname, '../../public', cleanPath);
        if (fs.existsSync(localPath)) {
          logoBuffer = fs.readFileSync(localPath);
        } else {
          // Fallback to service url
          const serviceUrl = `https://service.digitalks.co.in/${cleanPath}`;
          const resp = await axios.get(serviceUrl, { responseType: 'arraybuffer', timeout: 8000 });
          if (resp.data) {
            logoBuffer = Buffer.from(resp.data);
          }
        }
      }
    } catch (err) {
      console.warn('[pdfHelper] Error loading logo buffer:', err.message);
    }
  }

  // Convert logo buffer to PNG using sharp (crucial for PDFKit compatibility with WebP)
  if (logoBuffer) {
    try {
      logoBuffer = await sharp(logoBuffer).png().toBuffer();
    } catch (convErr) {
      console.warn('[pdfHelper] sharp logo conversion warning:', convErr.message);
    }
  }

  // Helper to render top header
  const renderHeader = (isFirstPage = true) => {
    // Top colored banner accent line
    doc.rect(leftMargin, 22, printableWidth, 4).fill(primaryColor);

    if (isFirstPage) {
      const logoBoxSize = 48;
      const logoX = leftMargin;
      const logoY = 32;

      let drawnLogo = false;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, logoX, logoY, {
            fit: [logoBoxSize, logoBoxSize],
            align: 'center',
            valign: 'center'
          });
          drawnLogo = true;
        } catch (imgErr) {
          console.warn('[pdfHelper] Could not draw logo image in doc:', imgErr.message);
          drawnLogo = false;
        }
      }

      if (!drawnLogo) {
        // Draw elegant circular monogram badge fallback
        doc.save();
        doc.circle(logoX + 24, logoY + 24, 23).fillColor(primaryColor).fill();
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(
          (communityName || 'P').charAt(0).toUpperCase(),
          logoX,
          logoY + 13,
          { width: logoBoxSize, align: 'center' }
        );
        doc.restore();
      }

      // PDF Title beside Logo
      const textX = logoX + logoBoxSize + 14;
      doc.font('Helvetica-Bold').fontSize(18).fillColor(primaryColor).text(title, textX, 46, { width: 440 });

      // Contact details block on the right (Phone & Email from theme config)
      const contactBoxWidth = 240;
      const contactBoxX = leftMargin + printableWidth - contactBoxWidth;
      const contactBoxY = 32;
      const contactBoxHeight = 48;

      doc.roundedRect(contactBoxX, contactBoxY, contactBoxWidth, contactBoxHeight, 6)
        .fillAndStroke('#F8FAFC', '#E2E8F0');

      let currentContactY = contactBoxY + 8;
      if (communityPhone) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
          .text('Phone:', contactBoxX + 10, currentContactY, { width: 45 });
        doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
          .text(communityPhone, contactBoxX + 58, currentContactY, { width: 172 });
        currentContactY += 15;
      }
      if (communityEmail) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
          .text('Email:', contactBoxX + 10, currentContactY, { width: 45 });
        doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
          .text(communityEmail, contactBoxX + 58, currentContactY, { width: 172 });
      }

      // Subtle horizontal divider below header
      doc.moveTo(leftMargin, 88).lineTo(leftMargin + printableWidth, 88).strokeColor('#E2E8F0').lineWidth(0.75).stroke();
      return 95;
    } else {
      // Header for subsequent pages
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
        .text(title, leftMargin, 30);
      return 45;
    }
  };

  // Helper to render table header row
  const renderTableHeader = (headerY) => {
    const headerHeight = 24;
    doc.rect(leftMargin, headerY, printableWidth, headerHeight).fill(primaryColor);

    let currentX = leftMargin;
    columns.forEach((col) => {
      const colWidth = col.width || 80;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text(
        String(col.header || '').toUpperCase(),
        currentX + 5,
        headerY + 7,
        {
          width: colWidth - 10,
          align: col.align || 'left'
        }
      );
      currentX += colWidth;
    });

    return headerY + headerHeight;
  };

  // 1. Initial Page Header
  let currentY = renderHeader(true);
  currentY = renderTableHeader(currentY);

  // 2. Render Data Rows
  const rowHeight = 22;
  const maxTableY = pageHeight - bottomMargin - 15;

  rows.forEach((row, rowIndex) => {
    // Check if new page is needed
    if (currentY + rowHeight > maxTableY) {
      doc.addPage();
      currentY = renderHeader(false);
      currentY = renderTableHeader(currentY);
    }

    const isEven = rowIndex % 2 === 0;
    const rowBg = isEven ? '#FFFFFF' : '#F8FAFC';

    // Row background
    doc.rect(leftMargin, currentY, printableWidth, rowHeight).fill(rowBg);

    // Row bottom border
    doc.moveTo(leftMargin, currentY + rowHeight)
      .lineTo(leftMargin + printableWidth, currentY + rowHeight)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();

    // Render cells
    let currentX = leftMargin;
    columns.forEach((col) => {
      const colWidth = col.width || 80;
      const cellValue = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';

      if (col.key === 'status') {
        // Status pill
        const isAct = cellValue.toLowerCase() === 'active';
        const pillWidth = 52;
        const pillHeight = 15;
        const pillX = currentX + (colWidth - pillWidth) / 2;
        const pillY = currentY + 3.5;

        doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 4)
          .fillAndStroke(isAct ? '#DCFCE7' : '#FEE2E2', isAct ? '#86EFAC' : '#FCA5A5');

        doc.font('Helvetica-Bold').fontSize(7.5)
          .fillColor(isAct ? '#15803D' : '#B91C1C')
          .text(isAct ? 'Active' : 'Inactive', pillX, pillY + 3.5, {
            width: pillWidth,
            align: 'center'
          });
      } else {
        const isBold = col.bold;
        const textColor = col.color || (col.key === 'email' ? '#2563EB' : (col.key === 'designation' ? primaryColor : '#1E293B'));
        const fontSize = col.key === 'email' ? 7.5 : (col.key === 'sr' ? 8 : 8.5);

        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(cellValue, currentX + 5, currentY + 6, {
            width: colWidth - 10,
            align: col.align || 'left',
            ellipsis: true
          });
      }

      currentX += colWidth;
    });

    currentY += rowHeight;
  });

  // 3. Add Footers with Page Numbers on all buffered pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = pageHeight - 26;

    // Footer divider line
    doc.moveTo(leftMargin, footerY - 6)
      .lineTo(leftMargin + printableWidth, footerY - 6)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();

    // Footer right: Page number
    doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text(
      `Page ${i + 1} of ${range.count}`,
      pageWidth - rightMargin - 200,
      footerY,
      { align: 'right', width: 200 }
    );
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Construct download_url
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  const baseUrl = req.baseUrl || '';
  const download_url = `${protocol}://${host}${baseUrl}/export-pdf/download/${filename}`;

  return {
    download_url,
    filename,
    filePath
  };
};

/**
 * Common Express Handler to send exported PDF file
 */
const sendExportedPdfFile = (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename || !filename.endsWith('.pdf')) {
      return apiResponse(res, 400, 'Invalid file request');
    }

    const filePath = path.join(__dirname, '../../public/uploads/exports', filename);
    if (!fs.existsSync(filePath)) {
      return apiResponse(res, 404, 'Exported PDF file not found or has expired');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    return apiResponse(res, 500, err.message || 'Error downloading PDF file');
  }
};

module.exports = {
  generatePdfExport,
  sendExportedPdfFile
};
