const puppeteer = require('puppeteer');

let browserInstance = null;

/**
 * Check if a Puppeteer browser instance is still active and connected
 */
function isBrowserAlive(browser) {
  if (!browser) return false;
  if (typeof browser.connected === 'boolean') return browser.connected;
  if (typeof browser.isConnected === 'function') {
    try {
      return browser.isConnected();
    } catch (_) {
      return false;
    }
  }
  if (browser.process && typeof browser.process === 'function') {
    return !!browser.process();
  }
  return true;
}

/**
 * Get or initialize a reusable Puppeteer browser instance
 */
async function getBrowser() {
  if (!isBrowserAlive(browserInstance)) {
    try {
      if (browserInstance && typeof browserInstance.close === 'function') {
        await browserInstance.close().catch(() => {});
      }
    } catch (_) {}

    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    // Reset instance if browser process unexpectedly disconnects
    if (browserInstance && typeof browserInstance.on === 'function') {
      browserInstance.on('disconnected', () => {
        browserInstance = null;
      });
    }
  }
  return browserInstance;
}

/**
 * Generate a PDF Buffer from HTML content using headless Chrome
 * @param {string} htmlContent - Clean HTML string
 * @param {object} options - Configuration options (filename, orientation, etc.)
 * @returns {Promise<Buffer>}
 */
async function generatePdfFromHtml(htmlContent, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport to high-res standard A4 aspect
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="gu">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.filename || 'Certificate'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wght@400;500;600;700;800;900&family=Noto+Sans+Gujarati:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            background: #ffffff !important;
            font-family: 'Noto Sans Gujarati', 'Anek Gujarati', 'Plus Jakarta Sans', sans-serif;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          body {
            display: block !important;
          }
          body > div {
            display: block !important;
            gap: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .certificate-page {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 5mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .certificate-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* Strip borders/outlines on inputs so they look like crisp printed official text */
          input, textarea, select {
            font-family: inherit !important;
            border: none !important;
            outline: none !important;
            background: transparent !important;
            color: #111111 !important;
            box-shadow: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
          }
          /* Hide screen-only guide lines if any */
          .letterhead-guide-lines {
            background-image: none !important;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    await page.setContent(fullHtml, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };

    if (options.pageRanges) {
      pdfOptions.pageRanges = options.pageRanges;
    }

    // Generate high resolution PDF buffer
    const pdfBuffer = await page.pdf(pdfOptions);

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

module.exports = {
  getBrowser,
  generatePdfFromHtml,
};
