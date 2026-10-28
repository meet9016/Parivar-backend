const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { apiResponse } = require('./apiResponse');

/**
 * Convert 1-based column index to Excel column letter (e.g. 1 -> A, 26 -> Z, 27 -> AA)
 */
const getExcelColumnLetter = (colIndex) => {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
};

/**
 * Standard styles
 */
const STYLES = {
  header: {
    height: 28,
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B365D' } // Navy Blue
    },
    font: {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    },
    alignment: {
      vertical: 'middle',
      horizontal: 'center'
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF1B365D' } },
      left: { style: 'thin', color: { argb: 'FF1B365D' } },
      bottom: { style: 'medium', color: { argb: 'FF1B365D' } },
      right: { style: 'thin', color: { argb: 'FF1B365D' } }
    }
  },
  cellBorder: {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
  },
  statusActive: {
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2F0D9' } // Light Green
    },
    font: {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FF385623' } // Dark Green
    }
  },
  statusInactive: {
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFCE4D6' } // Light Red
    },
    font: {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FFC00000' } // Dark Red
    }
  }
};

/**
 * Common Excel Export Generator
 * 
 * @param {Object} options
 * @param {Object} options.req Express request object
 * @param {string} [options.filePrefix='Export'] Filename prefix
 * @param {string} [options.sheetName='Sheet1'] Worksheet name
 * @param {Array<Object>} options.columns Array of { header, key, width, align, bold, color }
 * @param {Array<Object>} [options.rows=[]] Array of row data objects
 * @param {Function} [options.rowFormatter] Optional (row, rowData, index, worksheet) => void
 * @param {Function} [options.buildWorksheet] Optional (worksheet, workbook) => void
 * @returns {Promise<{ download_url: string, filename: string, filePath: string }>}
 */
const generateExcelExport = async ({
  req,
  filePrefix = 'Export',
  sheetName = 'Sheet1',
  columns = [],
  rows = [],
  rowFormatter,
  buildWorksheet
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Parivar Admin Panel';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Set columns
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 20
  }));

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = STYLES.header.height;
  headerRow.eachCell((cell) => {
    cell.fill = STYLES.header.fill;
    cell.font = STYLES.header.font;
    cell.alignment = STYLES.header.alignment;
    cell.border = STYLES.header.border;
  });

  // Auto filter across all columns
  if (columns.length > 0) {
    const lastColLetter = getExcelColumnLetter(columns.length);
    worksheet.autoFilter = {
      from: 'A1',
      to: `${lastColLetter}1`
    };
  }

  // Map of column index (1-based) to column config
  const colConfigMap = {};
  columns.forEach((col, idx) => {
    colConfigMap[idx + 1] = col;
  });

  // Add Rows
  rows.forEach((rowData, index) => {
    const rawData = rowData && typeof rowData === 'object' && rowData.data ? rowData.data : rowData;
    const row = worksheet.addRow(rawData);
    row.height = rowData?._height || 22;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colConf = colConfigMap[colNumber] || {};

      // Default cell font
      cell.font = {
        name: 'Calibri',
        size: colConf.size || 10.5,
        bold: !!colConf.bold,
        ...(colConf.color ? { color: { argb: colConf.color } } : {})
      };

      // Default cell border
      cell.border = STYLES.cellBorder;

      // Default alignment
      if (colConf.align) {
        cell.alignment = {
          vertical: 'middle',
          horizontal: colConf.align
        };
      } else {
        // Fallback default alignment
        const isCenterCol = ['member_id', 'id', 'number', 'contact', 'gender', 'blood_group', 'status', 'role'].includes(colConf.key);
        cell.alignment = {
          vertical: 'middle',
          horizontal: isCenterCol ? 'center' : 'left'
        };
      }

      // Status badge styling
      const cellValStr = String(cell.value || '').trim().toLowerCase();
      if (cellValStr === 'active' || (colConf.key === 'status' && cellValStr === 'active')) {
        cell.fill = STYLES.statusActive.fill;
        cell.font = {
          ...STYLES.statusActive.font,
          size: cell.font.size
        };
      } else if (cellValStr === 'inactive' || (colConf.key === 'status' && cellValStr === 'inactive')) {
        cell.fill = STYLES.statusInactive.fill;
        cell.font = {
          ...STYLES.statusInactive.font,
          size: cell.font.size
        };
      }
    });

    // Custom row formatter if provided
    if (typeof rowFormatter === 'function') {
      rowFormatter(row, rowData, index, worksheet);
    }
  });

  // Custom worksheet builder if provided
  if (typeof buildWorksheet === 'function') {
    buildWorksheet(worksheet, workbook);
  }

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();

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
  } catch (_) { }

  // Generate unique timestamped filename
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanPrefix = String(filePrefix).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanPrefix}_${dateStr}_${timestamp}.xlsx`;
  const filePath = path.join(exportDir, filename);

  fs.writeFileSync(filePath, buffer);

  // Construct download_url
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  const baseUrl = req.baseUrl || '';
  const download_url = `${protocol}://${host}${baseUrl}/export/download/${filename}`;

  return {
    download_url,
    filename,
    filePath
  };
};

/**
 * Common Express Handler to send exported Excel file
 */
const sendExportedExcelFile = (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename || !filename.endsWith('.xlsx')) {
      return apiResponse(res, 400, 'Invalid file request');
    }

    const filePath = path.join(__dirname, '../../public/uploads/exports', filename);
    if (!fs.existsSync(filePath)) {
      return apiResponse(res, 404, 'Exported file not found or has expired');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    return apiResponse(res, 500, err.message || 'Error downloading file');
  }
};

module.exports = {
  generateExcelExport,
  sendExportedExcelFile,
  getExcelColumnLetter,
  STYLES
};
