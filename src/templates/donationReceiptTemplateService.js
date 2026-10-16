const axios = require('axios');
const certAssets = require('../assets/embeddedCertAssets');
let certData = {};
try {
  certData = require('../data/certificates.json');
} catch (_) { }

/**
 * Escape HTML to prevent XSS while preserving text
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert English digits to Gujarati digits
 */
function toGujaratiDigits(val) {
  if (val === undefined || val === null || val === '') return '';
  const gujaratiNums = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
  return String(val).replace(/[0-9]/g, (d) => gujaratiNums[parseInt(d, 10)]);
}

/**
 * Number to Indian English Words Converter
 */
function numberToEnglishWords(num) {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'Zero Rupees Only';

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';

  return str.trim() ? str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Rupees Only' : 'Zero Rupees Only';
}

/**
 * Number to Gujarati Words Converter
 */
function numberToGujaratiWords(num) {
  const gujNums = [
    '', 'એક', 'બે', 'ત્રણ', 'ચાર', 'પાંચ', 'છ', 'સાત', 'આઠ', 'નવ', 'દસ',
    'અગિયાર', 'બાર', 'તેર', 'ચૌદ', 'પંદર', 'સોળ', 'સત્તર', 'અઢાર', 'ઓગણીસ', 'વીસ',
    'એકવીસ', 'બાવીસ', 'ત્રેવીસ', 'ચોવીસ', 'પચ્ચીસ', 'છવ્વીસ', 'સત્તાવીસ', 'અઠ્ઠાવીસ', 'ઓગણત્રીસ', 'ત્રીસ',
    'એકત્રીસ', 'બત્રીસ', 'તેંત્રીસ', 'ચોવીસ', 'પાંત્રીસ', 'છત્રીસ', 'સાડત્રીસ', 'આડત્રીસ', 'ઓગણચાલીસ', 'ચાલીસ',
    'એકતાલીસ', 'બેતાલીસ', 'તેતાલીસ', 'ચુંમાલીસ', 'પિસ્તાલીસ', 'છેતાલીસ', 'સુડતાલીસ', 'અડતાલીસ', 'ઓગણપચાસ', 'પચાસ',
    'એકાવન', 'બાવન', 'ત્રેપન', 'ચોપન', 'પંચાવન', 'છપ્પન', 'સત્તાવન', 'અઠ્ઠાવન', 'ઓગણસાઠ', 'સાઠ',
    'એકસઠ', 'બાસઠ', 'ત્રેસઠ', 'ચોસઠ', 'પાંસઠ', 'છાસઠ', 'સડસઠ', 'અડસઠ', 'અગણોસિત્તેર', 'સિત્તેર',
    'એકોતેર', 'બોતેર', 'તોતેર', 'ચુમોતેર', 'પંચોતેર', 'છોતેર', 'સંતોતેર', 'ઈઠોતેર', 'ઓગણાએંસી', 'એંસી',
    'એક્યાસી', 'બ્યાસી', 'ત્યાસી', 'ચોર્યાસી', 'પંચાસી', 'છ્યાસી', 'સત્યાસી', 'અઠ્યાસી', 'નેવ્યાસી', 'નેવું',
    'એકાણું', 'બાણું', 'ત્રાણું', 'ચોરાણું', 'પંચાણું', 'છન્નું', 'સત્તાણું', 'અઠ્ઠાણું', 'નવ્વાણું'
  ];

  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'શૂન્ય રૂપિયા પૂરા';

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let parts = [];
  const crore = parseInt(n[1], 10);
  const lakh = parseInt(n[2], 10);
  const thousand = parseInt(n[3], 10);
  const hundred = parseInt(n[4], 10);
  const rest = parseInt(n[5], 10);

  if (crore > 0) parts.push((gujNums[crore] || crore) + ' કરોડ');
  if (lakh > 0) parts.push((gujNums[lakh] || lakh) + ' લાખ');
  if (thousand > 0) parts.push((gujNums[thousand] || thousand) + ' હજાર');
  if (hundred > 0) parts.push((gujNums[hundred] || hundred) + ' સો');
  if (rest > 0) parts.push(gujNums[rest] || rest);

  return parts.join(' ') + ' રૂપિયા પૂરા';
}

/**
 * Format date string into DD/MM/YYYY
 */
function formatDateDisplay(val) {
  if (!val) return '-';
  const str = String(val).trim();
  if (str.includes('/')) return str;
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (_) { }
  return String(val);
}

/**
 * In-memory cache for downloaded external web logos as base64
 */
const logoBase64Cache = new Map();

async function resolveLogoBase64(config) {
  const remoteUrl = config?.webLogo || config?.appLogo;
  if (!remoteUrl) {
    return certAssets.letterpadLogo || '';
  }

  if (remoteUrl.startsWith('data:image')) {
    return remoteUrl;
  }

  if (logoBase64Cache.has(remoteUrl)) {
    return logoBase64Cache.get(remoteUrl);
  }

  try {
    const response = await axios.get(remoteUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64Data = Buffer.from(response.data).toString('base64');
    const dataUri = `data:${contentType};base64,${base64Data}`;
    logoBase64Cache.set(remoteUrl, dataUri);
    return dataUri;
  } catch (err) {
    console.warn(`[DonationReceipt] Failed to fetch remote logo (${remoteUrl}), falling back to default logo:`, err.message);
    return certAssets.letterpadLogo || '';
  }
}

/**
 * Main Donation Receipt HTML Renderer
 * Generates an executive, clean, highly-readable A5 Landscape Donation Receipt Slip
 * @param {object} donation - Donation DB record
 * @param {object} config - App/Tenant Theme Config (if any)
 * @returns {Promise<string>} Clean, self-contained HTML for Puppeteer
 */
async function renderDonationReceiptHtml(donation = {}, config = {}) {
  const d = donation || {};
  const c = config || {};
  const l = certData?.letterhead || {};

  // Resolve official logo Base64
  const logoBase64 = await resolveLogoBase64(c);

  const amount = Number(d.donate_amount || 0);
  const formattedAmount = amount.toLocaleString('en-IN');
  const gujaratiWords = numberToGujaratiWords(amount);
  const englishWords = numberToEnglishWords(amount);
  const formattedDate = formatDateDisplay(d.date || d.donate_date || new Date());
  const receiptNo = d.receipt_number || d.receipt_no || `REC-${String(d.id || d._id || '000000').slice(-6).toUpperCase()}`;

  // Organization names & details
  let communityNameGuj = 'શ્રી પરિવાર જમાત';
  let communityNameEng = 'SHREE PARIVAR JAMAT';

  if (c.communityName) {
    communityNameGuj = c.communityName;
    communityNameEng = c.name ? c.name.toUpperCase() : 'COMMUNITY TRUST';
  } else if (c.name && c.name.trim()) {
    const rawName = c.name.trim();
    if (/parivar/i.test(rawName) || /jamat/i.test(rawName) || /trust/i.test(rawName)) {
      communityNameGuj = rawName;
      communityNameEng = rawName.toUpperCase();
    } else {
      communityNameGuj = `રાધનપુર મેમણ જમાત`;
      communityNameEng = `${rawName.toUpperCase()} PARIVAR CHARITABLE TRUST`;
    }
  } else if (l.communityName && !l.communityName.includes('રાધનપુર')) {
    communityNameGuj = l.communityName;
    communityNameEng = l.orgName || 'COMMUNITY PARIVAR';
  }

  const trustRegLine = c.trustLine || l.trustLine || 'રજીસ્ટર્ડ સામાજિક ચેરીટેબલ ટ્રસ્ટ • માન્ય સેવાકીય સંસ્થા';
  const officeAddress = c.address || l.address || '';
  const contactPhone = c.phone || l.phone1 || '';

  // Payment Mode styling
  const mode = String(d.payment_mode || 'Cash').trim();
  let modeGuj = 'રોકડ (Cash)';
  let modeColor = '#1e3a8a';
  let modeBg = '#eff6ff';
  let modeBorder = '#bfdbfe';

  if (/upi|online/i.test(mode)) {
    modeGuj = 'યુપીઆઈ / ઓનલાઈન (Online UPI)';
    modeColor = '#15803d';
    modeBg = '#f0fdf4';
    modeBorder = '#bbf7d0';
  } else if (/bank|transfer/i.test(mode)) {
    modeGuj = 'બેંક ટ્રાન્સફર (Bank Transfer)';
    modeColor = '#4338ca';
    modeBg = '#eef2ff';
    modeBorder = '#c7d2fe';
  } else if (/cheque/i.test(mode)) {
    modeGuj = 'ચેક (Cheque)';
    modeColor = '#b45309';
    modeBg = '#fffbeb';
    modeBorder = '#fde68a';
  }

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Anek+Gujarati:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
      * {
        font-family: 'Anek Gujarati', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
    </style>
    <div class="page-wrapper" style="width: 210mm; height: 148mm; max-width: 210mm; max-height: 148mm; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 5mm; margin: 0 auto; background: #ffffff; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid;">
      <div class="receipt-container" style="width: 200mm; height: 138mm; max-width: 200mm; max-height: 138mm; box-sizing: border-box; background: #ffffff; padding: 6mm 9mm; display: flex; flex-direction: column; justify-content: space-between; font-family: 'Anek Gujarati', 'Plus Jakarta Sans', sans-serif; color: #1e293b; border: 2.5px solid #065f46; border-radius: 4px; position: relative;">
        
        <!-- TOP HEADER (Symmetric 3-Column Grid for True Dead-Centering) -->
        <div style="display: grid; grid-template-columns: 80px 1fr 80px; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #065f46; gap: 10px; width: 100%;">
          <!-- Left: Logo (aligned left) -->
          <div style="display: flex; align-items: center; justify-content: flex-start; width: 80px;">
            <div style="width: 62px; height: 62px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img src="${logoBase64}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>
          </div>

          <!-- Center: Organization Details (100% Dead Centered) -->
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: #065f46; line-height: 1.15; letter-spacing: 0.3px;">
              ${escapeHtml(communityNameGuj)}
            </div>
            <div style="font-size: 11.5px; font-weight: 600; color: #334155; margin-top: 3px;">
              ${escapeHtml(trustRegLine)}
            </div>
            <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
              ${escapeHtml(officeAddress)} ${contactPhone ? `• ✆ ${escapeHtml(contactPhone)}` : ''}
            </div>
          </div>

          <!-- Right: Circular Receipt Badge (aligned right, matching logo size) -->
          <div style="display: flex; align-items: center; justify-content: flex-end; width: 80px;">
            <div style="width: 62px; height: 62px; border-radius: 50%; background: #065f46; border: 2px solid #065f46; outline: 1.5px dashed #a7f3d0; outline-offset: -4px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #ffffff; flex-shrink: 0; box-shadow: 0 2px 6px rgba(6,95,70,0.18);">
              <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; line-height: 1.1; text-transform: uppercase;">DONATION</div>
              <div style="font-size: 7.5px; font-weight: 800; letter-spacing: 0.4px; line-height: 1.1; text-transform: uppercase;">RECEIPT</div>
              <div style="font-size: 7.5px; font-weight: 700; color: #a7f3d0; margin-top: 1.5px; line-height: 1;">દાન પહોંચ</div>
            </div>
          </div>
        </div>

      <!-- RECEIPT NO & DATE -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 6px; padding: 6px 14px; font-size: 13.5px; font-weight: 700;">
        <div>
          <span style="color: #64748b;">Receipt No. : </span>
          <span style="color: #065f46; font-family: monospace; font-size: 14.5px; font-weight: 900;">${escapeHtml(receiptNo)}</span>
        </div>
        <div>
          <span style="color: #64748b;">Date: </span>
          <span style="color: #0f172a; font-weight: 800;">${escapeHtml(formattedDate)}</span>
        </div>
      </div>

      <!-- DONATION PARTICULARS TABLE -->
      <div style="border: 1.2px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tbody>
            <!-- Row 1: Donor Name -->
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="width: 25%; padding: 8px 14px; font-weight: 700; color: #475569; background: #f8fafc;">
                દાતાશ્રીનું નામ :
              </td>
              <td style="padding: 8px 14px; font-size: 18px; font-weight: 900; color: #0f172a;">
                ${escapeHtml(d.donator_name || '-')}
              </td>
            </tr>

            <!-- Row 2: Amount in Numbers & Payment Mode -->
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 14px; font-weight: 700; color: #475569; background: #f8fafc;">
                દાનની રકમ :
              </td>
              <td style="padding: 8px 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 22px; font-weight: 900; color: #065f46;">
                    ₹ ${formattedAmount} /-
                  </span>
                  <span style="font-size: 12.5px; font-weight: 800; color: ${modeColor}; background: ${modeBg}; border: 1px solid ${modeBorder}; padding: 3px 12px; border-radius: 4px;">
                    ${escapeHtml(modeGuj)}
                  </span>
                </div>
              </td>
            </tr>

            <!-- Row 3: Amount in Words -->
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 14px; font-weight: 700; color: #475569; background: #f8fafc;">
                અંકે રૂપિયા :
              </td>
              <td style="padding: 8px 14px; font-size: 14px; font-weight: 800; color: #1e293b; line-height: 1.4;">
                ${escapeHtml(gujaratiWords)} <span style="font-size: 12px; color: #64748b; font-weight: 700;">(${escapeHtml(englishWords)})</span>
              </td>
            </tr>

            <!-- Row 4: Purpose -->
            <tr>
              <td style="padding: 8px 14px; font-weight: 700; color: #475569; background: #f8fafc;">
                દાનનો હેતુ :
              </td>
              <td style="padding: 8px 14px; font-size: 14px; font-weight: 800; color: #1e293b;">
                ${escapeHtml(d.donation_purpose || 'સામાન્ય દાન (General Donation)')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- GRATITUDE MESSAGE -->
      <div style="padding: 7px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 12.5px; font-weight: 700; color: #166534; text-align: center;">
        આપના આ ઉમદા સખાવતી દાન બદલ સમસ્ત સમાજ આપનો હૃદયપૂર્વક આભાર વ્યક્ત કરે છે.
      </div>

      <!-- SIGNATURES -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 6px 36px 4px;">
        <!-- Left: Cashier -->
        <div style="text-align: center; width: 180px;">
          <div style="height: 28px;"></div>
          <div style="border-top: 1.5px solid #334155; padding-top: 4px;">
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">ખજાનચી / કેશિયર</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 700;">(Treasurer / Cashier)</div>
          </div>
        </div>

        <!-- Right: President / Secretary -->
        <div style="text-align: center; width: 180px;">
          <div style="height: 28px;"></div>
          <div style="border-top: 1.5px solid #334155; padding-top: 4px;">
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">પ્રમુખ / મંત્રી</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 700;">(President / Secretary)</div>
          </div>
        </div>
      </div>

      <!-- FOOTER NOTE -->
      <div style="text-align: center; font-size: 10.5px; font-weight: 600; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
        * આ કમ્પ્યુટરાઈઝ્ડ સત્તાવાર ઈ-પહોંચ છે અને માન્ય ગણાશે • Computerized Official Donation Receipt
      </div>

      </div>
    </div>
  `;
}

module.exports = {
  renderDonationReceiptHtml,
  numberToGujaratiWords,
  numberToEnglishWords,
  formatDateDisplay,
  resolveLogoBase64,
};
