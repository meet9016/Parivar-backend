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
    console.warn(`[DonationReceipt] Failed to fetch remote logo (${remoteUrl}), falling back to embedded default logo:`, err.message);
    return certAssets.letterpadLogo || '';
  }
}

/**
 * Clean & Professional Title Banner for Normal Receipt
 */
function renderReceiptTitleBanner(title = 'આભાર પત્ર અને દાન સ્વીકાર પહોંચ') {
  return `
    <div style="text-align: center; margin: 6px auto 7px;">
      <div style="display: inline-block; background: #8b181b; color: #ffffff; padding: 5px 24px; border-radius: 4px; font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 15px; font-weight: 800; letter-spacing: 0.5px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px;">
        DONATION RECEIPT &bull; ACKNOWLEDGEMENT
      </div>
    </div>
  `;
}

/**
 * Render Official Circular Seal SVG
 */
function renderOfficialSealSvg(communityName = 'રાધનપુર મેમણ જમાત') {
  return `
    <div style="width: 70px; height: 70px; position: relative; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
      <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
        <circle cx="50" cy="50" r="47" fill="none" stroke="#8b181b" stroke-width="2" stroke-dasharray="3,1.5" />
        <circle cx="50" cy="50" r="43" fill="#fffdfa" stroke="#8b181b" stroke-width="1.2" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#cbd5e1" stroke-width="0.8" />
        <!-- Top Curve text -->
        <path id="sealCurveTop" d="M 18,50 A 32,32 0 0,1 82,50" fill="none" />
        <text font-size="7.5" font-weight="800" fill="#8b181b" font-family="'Noto Sans Gujarati', sans-serif">
          <textPath href="#sealCurveTop" startOffset="50%" text-anchor="middle">
            ${escapeHtml(communityName)}
          </textPath>
        </text>
        <!-- Center Emblem -->
        <circle cx="50" cy="50" r="14" fill="#8b181b" />
        <text x="50" y="47" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="6.5" font-weight="800" font-family="sans-serif">
          OFFICIAL
        </text>
        <text x="50" y="55" text-anchor="middle" dominant-baseline="central" fill="#fef08a" font-size="6" font-weight="800" font-family="'Noto Sans Gujarati', sans-serif">
          સિક્કો
        </text>
        <!-- Bottom Curve text -->
        <path id="sealCurveBottom" d="M 82,50 A 32,32 0 0,1 18,50" fill="none" />
        <text font-size="6.5" font-weight="700" fill="#475569" font-family="sans-serif">
          <textPath href="#sealCurveBottom" startOffset="50%" text-anchor="middle">
            ★ VERIFIED &bull; સ્વીકૃત ★
          </textPath>
        </text>
      </svg>
    </div>
  `;
}

/**
 * Main Donation Receipt HTML Renderer
 * Generates a clean, normal, professional A4 Donation Receipt & Aabhar Patra
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
  const formattedDate = formatDateDisplay(d.date || d.donate_date || new Date());
  const receiptNo = d.receipt_number || d.receipt_no || `REC-DON-${String(d.id || d._id || '000000').slice(-6).toUpperCase()}`;

  // Organization names & details
  const communityNameGuj = c.communityName || c.name ? `${c.name} જમાત` : (l.communityName || 'રાધનપુર મેમણ જમાત');
  const communityNameEng = (c.name ? `${c.name.toUpperCase()} JAMAT` : (l.orgName || 'RADHANPUR MEMON JAMAT'));
  const trustRegLine = l.trustLine || 'ટ્રસ્ટ રજી નં. બી ૧૨૯-મહેસાણા તા.૩૦-૯-૧૯૫૫';
  const officeAddress = l.addressLine || l.address || 'કાર્યાલય: મેમણ જમાતખાના, મુ. રાધનપુર, જિ. પાટણ, પીન - ૩૮૫૩૪૦ (ઉ.ગુ.)';
  const contactPhone = c.phone || l.phone1 || '+૯૧ ૯૯૯૮૦ ૧૬૫૬૬ | +૯૧ ૮૪૯૦૦ ૯૫૨૪૦';
  const officialEmail = c.email || l.email || 'info.radhanpurmemonjamat@gmail.com';
  const officialWebsite = l.website || 'https://memon.parivar.me/';

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
    <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', 'Plus Jakarta Sans', sans-serif; font-size: 12px; background: #ffffff; border: 2px solid #8b181b; border-radius: 6px; padding: 5px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden;">
      <!-- Clean Inner Frame -->
      <div style="border: 1px solid #cbd5e1; border-radius: 4px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 14px 18px 12px; position: relative; background: #ffffff; overflow: hidden; box-sizing: border-box;">

        <!-- TOP HEADER SECTION -->
        <div style="width: 100%;">
          <!-- Top Row: Trust Reg Line + Email -->
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 2px 4px; font-size: 9.5px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #475569; margin-bottom: 6px;">
            <div style="color: #8b181b; font-weight: 800;">
              ${escapeHtml(trustRegLine)}
            </div>
            <div style="text-align: right; color: #64748b; font-size: 9px;">
              <span>ઈ-મેઇલ: ${escapeHtml(officialEmail)}</span>
            </div>
          </div>

          <!-- Main Brand & Community Title with Balanced Logos -->
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 6px; padding: 0 4px;">
            <!-- Left Logo -->
            <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img src="${logoBase64}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>

            <!-- Community Heading -->
            <div style="flex: 1; text-align: center; padding: 0 10px;">
              <div style="font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 24px; font-weight: 900; color: #8b181b; line-height: 1.2;">
                ${escapeHtml(communityNameGuj)}
              </div>
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10.5px; font-weight: 800; color: #1e293b; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px;">
                ${escapeHtml(communityNameEng)}
              </div>
              <div style="font-size: 9px; font-weight: 600; color: #475569; margin-top: 2px;">
                ${escapeHtml(officeAddress)}
              </div>
              <div style="font-size: 8.5px; font-weight: 700; color: #64748b; margin-top: 1px;">
                સંપર્ક: ${escapeHtml(contactPhone)} | વેબસાઇટ: ${escapeHtml(officialWebsite)}
              </div>
            </div>

            <!-- Right Logo -->
            <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img src="${logoBase64}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>
          </div>

          <div style="height: 1.5px; background: #8b181b; width: 100%; margin-bottom: 6px;"></div>

          <!-- CLEAN NORMAL TITLE BANNER -->
          ${renderReceiptTitleBanner('આભાર પત્ર અને દાન સ્વીકાર પહોંચ')}

          <!-- RECEIPT NO & DATE BAR -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px 14px; font-size: 11px; font-weight: 800; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #64748b;">પહોંચ ક્રમાંક (Receipt No.):</span>
              <span style="color: #0f172a; font-family: monospace; font-size: 12px; font-weight: 900;">${escapeHtml(receiptNo)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #64748b;">નાણાકીય સત્ર:</span>
              <span style="color: #0f172a;">૨૦૨૫-૨૦૨૬</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #64748b;">તારીખ (Date):</span>
              <span style="color: #0f172a; font-weight: 900;">${escapeHtml(formattedDate)}</span>
            </div>
          </div>
        </div>

        <!-- AABHAR / GRATITUDE MESSAGE BOX -->
        <div style="background: #faf8f5; border: 1px solid #e7ded5; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <div style="font-size: 12px; font-weight: 900; color: #8b181b;">
              માનનીય દાતાશ્રી ${escapeHtml(d.donator_name || 'દાતાશ્રી')},
            </div>
            <span style="font-size: 9.5px; font-weight: 800; color: #8b181b; background: #faebd7; padding: 1px 8px; border-radius: 4px; border: 1px solid #ebd3bd;">
              આભાર સંદેશ
            </span>
          </div>

          <div style="font-size: 11px; font-weight: 600; line-height: 18px; color: #334155; text-align: justify;">
            પરમ કૃપાળુ પરમાત્માના આશીર્વાદથી, સમાજના શૈક્ષણિક ઉત્થાન, સેવાકીય પ્રકલ્પો તથા લોક કલ્યાણકારી સત્કાર્ય અર્થે આપશ્રી તરફથી સદ્ભાવનાપૂર્વક અર્પણ કરવામાં આવેલ આ ઉદાર સખાવતી દાન કૃતજ્ઞતાપૂર્વક સ્વીકારવામાં આવેલ છે. આપના આ અમૂલ્ય સહયોગ બદલ સમસ્ત <strong>${escapeHtml(communityNameGuj)}</strong> આપનો હૃદયપૂર્વક આભાર વ્યક્ત કરે છે. ઈશ્વર આપના ધન-ધાન્ય તથા વેપાર-રોજગારમાં અવિરત બરકત આપે અને પરિવારને સુખ-શાંતિ અર્પે એવી શુભકામનાઓ સહ આ આભાર પત્ર અને દાન સ્વીકાર પહોંચ કૃતજ્ઞતાપૂર્વક અર્પણ કરીએ છીએ.
          </div>
        </div>

        <!-- DONATION PARTICULARS TABLE -->
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
          <div style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 5px 12px; font-size: 11px; font-weight: 800; color: #1e293b;">
            દાન સ્વીકૃતિ વિગતો (Donation Details)
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <tbody>
              <!-- Row 1: Donator Name -->
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="width: 30%; padding: 6px 12px; font-weight: 700; color: #475569;">
                  ૧. દાતાશ્રીનું પૂરું નામ :
                </td>
                <td style="padding: 6px 12px; font-weight: 900; color: #0f172a; font-size: 13px;">
                  ${escapeHtml(d.donator_name || '-')}
                </td>
              </tr>

              <!-- Row 2: Purpose -->
              <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
                <td style="padding: 6px 12px; font-weight: 700; color: #475569;">
                  ૨. દાનનો હેતુ / યોજના :
                </td>
                <td style="padding: 6px 12px; font-weight: 800; color: #0f172a;">
                  ${escapeHtml(d.donation_purpose || 'સામાન્ય દાન (General Donation)')}
                </td>
              </tr>

              <!-- Row 3: Amount In Figures -->
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="padding: 6px 12px; font-weight: 700; color: #475569;">
                  ૩. દાનની રકમ :
                </td>
                <td style="padding: 6px 12px; font-weight: 900; color: #15803d; font-size: 14.5px;">
                  <span style="display: inline-flex; align-items: center; gap: 4px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 2px 10px; border-radius: 4px;">
                    ₹ ${formattedAmount}/-
                  </span>
                </td>
              </tr>

              <!-- Row 4: Amount In Words -->
              <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
                <td style="padding: 6px 12px; font-weight: 700; color: #475569; vertical-align: top;">
                  ૪. અંકે રૂપિયા :
                </td>
                <td style="padding: 6px 12px; font-weight: 800; color: #0f172a; line-height: 1.4;">
                  ${escapeHtml(gujaratiWords)}
                </td>
              </tr>

              <!-- Row 5: Payment Mode & Date -->
              <tr style="background: #ffffff;">
                <td style="padding: 6px 12px; font-weight: 700; color: #475569;">
                  ૫. ચૂકવણી મોડ &amp; તારીખ :
                </td>
                <td style="padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 800; color: ${modeColor}; background: ${modeBg}; border: 1px solid ${modeBorder}; padding: 2px 8px; border-radius: 4px;">
                    ${escapeHtml(modeGuj)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- HIGHLIGHT AMOUNT BOX -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 6px; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
              કુલ સ્વીકારેલ દાન રકમ (Total Received)
            </div>
            <div style="font-size: 17px; font-weight: 900; color: #14532d; letter-spacing: 0.5px;">
              ₹ ${formattedAmount} /-
            </div>
          </div>
          <div style="text-align: right; max-width: 55%; font-size: 11.5px; font-weight: 800; color: #15803d;">
            ${escapeHtml(gujaratiWords)}
          </div>
        </div>

        <!-- SIGNATURES & OFFICIAL SEAL SECTION -->
        <div style="width: 100%; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 2px 14px;">
            <!-- Left: Cashier -->
            <div style="text-align: center; min-width: 130px;">
              <div style="height: 24px;"></div>
              <div style="border-top: 1.2px solid #334155; padding-top: 3px;">
                <div style="font-weight: 800; font-size: 11px; color: #1e293b;">ખજાનચીશ્રી / કેશિયર</div>
              </div>
            </div>

            <!-- Center: Official Seal -->
            <div style="text-align: center;">
              ${renderOfficialSealSvg(communityNameGuj)}
            </div>

            <!-- Right: President / Secretary -->
            <div style="text-align: center; min-width: 130px;">
              <div style="height: 24px;"></div>
              <div style="border-top: 1.2px solid #334155; padding-top: 3px;">
                <div style="font-weight: 800; font-size: 11px; color: #1e293b;">પ્રમુખશ્રી / સેક્રેટરી</div>
                <div style="font-size: 9px; color: #64748b; font-weight: 700;">${escapeHtml(communityNameGuj)}</div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Note -->
          <div style="text-align: center; font-size: 8.5px; font-weight: 600; color: #64748b; margin-top: 6px; padding-top: 3px; border-top: 1px solid #f1f5f9;">
            * આ કોમ્પ્યુટરાઈઝ્ડ ઈ-પહોંચ સંસ્થાના સત્તાવાર ચોપડે નોંધાયેલ છે અને માન્ય ગણાશે. આપના ઉમદા દાન બદલ સમસ્ત સમાજ આપનો ઋણી છે.
          </div>
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
