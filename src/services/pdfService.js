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
    // Set viewport to standard high-DPI A4 aspect (794 x 1123 at 2x device scale)
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
            background: #ffffff !important;
            font-family: 'Noto Sans Gujarati', 'Anek Gujarati', 'Plus Jakarta Sans', sans-serif;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          .pdf-page-container {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            position: relative !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .pdf-page-container:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .pdf-page-scale {
            width: 650px !important;
            height: 920px !important;
            min-height: 920px !important;
            max-height: 920px !important;
            transform: scale(1.221078) !important;
            transform-origin: top left !important;
            box-sizing: border-box !important;
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
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for fonts to load with a max 2.5s race condition so it never hangs
    await Promise.race([
      page.evaluateHandle('document.fonts.ready'),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]).catch(() => {});

    // Dynamic adaptation: wrap each .certificate-page into an exact A4 page container
    await page.evaluate(() => {
      const pages = document.querySelectorAll('.certificate-page');
      if (pages.length > 0) {
        pages.forEach((el) => {
          if (!el.parentElement.classList.contains('pdf-page-scale')) {
            const container = document.createElement('div');
            container.className = 'pdf-page-container';

            const scaler = document.createElement('div');
            scaler.className = 'pdf-page-scale';

            // Preserve exact 650px preview width and standard 920px height
            el.style.width = '650px';
            el.style.maxWidth = '650px';
            el.style.minWidth = '650px';
            el.style.height = '920px';
            el.style.minHeight = '920px';
            el.style.maxHeight = '920px';
            el.style.boxSizing = 'border-box';
            el.style.margin = '0 auto';

            el.parentNode.insertBefore(container, el);
            scaler.appendChild(el);
            container.appendChild(scaler);
          }
        });

        // Clear layout gap from original preview wrapper
        document.querySelectorAll('body > div').forEach((d) => {
          if (!d.classList.contains('pdf-page-container')) {
            d.style.display = 'contents';
            d.style.margin = '0';
            d.style.padding = '0';
            d.style.gap = '0';
          }
        });
      }
    });

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };

    if (options.pageRanges && typeof options.pageRanges === 'string' && options.pageRanges.trim()) {
      pdfOptions.pageRanges = options.pageRanges.trim();
    }

    // Generate high resolution vector PDF buffer with safe fallback if pageRanges fails
    let pdfBuffer;
    try {
      pdfBuffer = await page.pdf(pdfOptions);
    } catch (pdfErr) {
      if (pdfOptions.pageRanges) {
        delete pdfOptions.pageRanges;
        pdfBuffer = await page.pdf(pdfOptions);
      } else {
        throw pdfErr;
      }
    }

    return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  } finally {
    try {
      await page.close();
    } catch (_) {}
  }
}

// In-memory mutex to prevent concurrent thundering-herd renders for the same record/key
const pendingRenders = new Map();

async function synchronizedGeneratePdf(lockKey, renderFn) {
  if (!lockKey) return renderFn();
  if (pendingRenders.has(lockKey)) {
    return pendingRenders.get(lockKey);
  }
  const promise = (async () => {
    try {
      return await renderFn();
    } finally {
      pendingRenders.delete(lockKey);
    }
  })();
  pendingRenders.set(lockKey, promise);
  return promise;
}

async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (_) {}
    browserInstance = null;
  }
}

module.exports = {
  getBrowser,
  generatePdfFromHtml,
  synchronizedGeneratePdf,
  closeBrowser,
};
