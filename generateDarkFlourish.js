const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const darkFlourishSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 70" width="700" height="70">
  <defs>
    <linearGradient id="darkGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4a2e00" stop-opacity="0"/>
      <stop offset="12%" stop-color="#5a3800" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="#7a4f02" stop-opacity="1"/>
      <stop offset="50%" stop-color="#966304" stop-opacity="1"/>
      <stop offset="70%" stop-color="#7a4f02" stop-opacity="1"/>
      <stop offset="88%" stop-color="#5a3800" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#4a2e00" stop-opacity="0"/>
    </linearGradient>
    <filter id="darkGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#2a1800" flood-opacity="0.7"/>
    </filter>
  </defs>
  
  <g fill="url(#darkGoldGrad)" stroke="#3e2400" stroke-width="1.8" filter="url(#darkGlow)">
    <!-- Center Royal Rosette / Medallion -->
    <circle cx="350" cy="35" r="9" fill="#845503" stroke="#2d1a00" stroke-width="2.2"/>
    <circle cx="350" cy="35" r="4.5" fill="#e8ba45" stroke="#3e2400" stroke-width="1.5"/>
    <circle cx="350" cy="35" r="2" fill="#2d1a00"/>

    <!-- 4 Cardinal Petals -->
    <path d="M 350,14 C 356,24 356,24 350,35 C 344,24 344,24 350,14 Z" fill="#8c5d04"/>
    <path d="M 350,56 C 356,46 356,46 350,35 C 344,46 344,46 350,56 Z" fill="#8c5d04"/>
    <path d="M 329,35 C 340,41 340,41 350,35 C 340,29 340,29 329,35 Z" fill="#8c5d04"/>
    <path d="M 371,35 C 360,41 360,41 350,35 C 360,29 360,29 371,35 Z" fill="#8c5d04"/>

    <!-- 4 Diagonal Accent Jewels -->
    <circle cx="336" cy="21" r="4" fill="#a06e08" stroke="#3e2400" stroke-width="1.5"/>
    <circle cx="364" cy="21" r="4" fill="#a06e08" stroke="#3e2400" stroke-width="1.5"/>
    <circle cx="336" cy="49" r="4" fill="#a06e08" stroke="#3e2400" stroke-width="1.5"/>
    <circle cx="364" cy="49" r="4" fill="#a06e08" stroke="#3e2400" stroke-width="1.5"/>

    <!-- Flanking Diamonds -->
    <polygon points="318,35 306,26 294,35 306,44" fill="#845503" stroke="#2d1a00" stroke-width="1.8"/>
    <circle cx="306" cy="35" r="2.5" fill="#f0c65a"/>

    <polygon points="382,35 394,26 406,35 394,44" fill="#845503" stroke="#2d1a00" stroke-width="1.8"/>
    <circle cx="394" cy="35" r="2.5" fill="#f0c65a"/>

    <!-- Left Scroll Bar (Bolder & Darker) -->
    <path d="M 294,35 C 265,30 235,16 200,32 C 172,44 148,30 120,33 C 85,35 45,35 15,35 L 15,32 C 45,32 85,32 120,29 C 148,26 172,40 200,28 C 235,12 265,26 294,32 Z" fill="url(#darkGoldGrad)" stroke="#3e2400" stroke-width="1.6"/>
    <circle cx="200,31" r="5" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>
    <circle cx="120,31" r="4" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>
    <circle cx="65,33.5" r="3" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>

    <!-- Right Scroll Bar (Bolder & Darker) -->
    <path d="M 406,35 C 435,30 465,16 500,32 C 528,44 552,30 580,33 C 615,35 655,35 685,35 L 685,32 C 655,32 615,32 580,29 C 552,26 528,40 500,28 C 465,12 435,26 406,32 Z" fill="url(#darkGoldGrad)" stroke="#3e2400" stroke-width="1.6"/>
    <circle cx="500,31" r="5" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>
    <circle cx="580,31" r="4" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>
    <circle cx="635,33.5" r="3" fill="#845503" stroke="#2d1a00" stroke-width="1.5"/>
  </g>
</svg>`;

async function main() {
  const backendSvgPath = path.join(__dirname, 'public', 'uploads', 'mayyat_flourish.svg');
  const backendPngPath = path.join(__dirname, 'public', 'uploads', 'mayyat_flourish.png');
  const frontendPngPath = path.join(__dirname, '..', 'Privar-frontend', 'src', 'assets', 'mayyat', 'mayyat_flourish.png');

  fs.writeFileSync(backendSvgPath, darkFlourishSvg, 'utf8');
  console.log('Saved dark SVG to', backendSvgPath);

  // Render to high-res PNG via puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 70, deviceScaleFactor: 2 });
  
  const html = `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      svg { display: block; }
    </style>
  </head>
  <body>
    ${darkFlourishSvg}
  </body>
  </html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const pngBuffer = await page.screenshot({ type: 'png', omitBackground: true });
  await browser.close();

  fs.writeFileSync(backendPngPath, pngBuffer);
  console.log('Saved dark PNG to', backendPngPath, pngBuffer.length, 'bytes');

  fs.writeFileSync(frontendPngPath, pngBuffer);
  console.log('Saved dark PNG to', frontendPngPath, pngBuffer.length, 'bytes');
}

main().catch(console.error);
