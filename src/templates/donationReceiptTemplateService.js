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
 * Authentic Mini Verification QR Code SVG
 */
function renderMiniQrSvg() {
  return `
    <svg viewBox="0 0 100 100" style="width: 46px; height: 46px; display: block;" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#ffffff" rx="4" />
      <rect x="8" y="8" width="26" height="26" fill="none" stroke="#065f46" stroke-width="4" rx="2" />
      <rect x="15" y="15" width="12" height="12" fill="#065f46" rx="1" />
      <rect x="66" y="8" width="26" height="26" fill="none" stroke="#065f46" stroke-width="4" rx="2" />
      <rect x="73" y="15" width="12" height="12" fill="#065f46" rx="1" />
      <rect x="8" y="66" width="26" height="26" fill="none" stroke="#065f46" stroke-width="4" rx="2" />
      <rect x="15" y="73" width="12" height="12" fill="#065f46" rx="1" />
      <rect x="42" y="10" width="8" height="8" fill="#065f46" />
      <rect x="52" y="18" width="6" height="6" fill="#065f46" />
      <rect x="40" y="28" width="12" height="6" fill="#065f46" />
      <rect x="10" y="44" width="8" height="8" fill="#065f46" />
      <rect x="24" y="42" width="6" height="12" fill="#065f46" />
      <rect x="36" y="40" width="14" height="14" fill="#065f46" />
      <rect x="56" y="38" width="10" height="8" fill="#065f46" />
      <rect x="74" y="42" width="16" height="6" fill="#065f46" />
      <rect x="42" y="60" width="8" height="12" fill="#065f46" />
      <rect x="56" y="54" width="12" height="8" fill="#065f46" />
      <rect x="72" y="56" width="18" height="10" fill="#065f46" />
      <rect x="44" y="78" width="12" height="14" fill="#065f46" />
      <rect x="62" y="72" width="10" height="8" fill="#065f46" />
      <rect x="78" y="74" width="12" height="18" fill="#065f46" />
    </svg>
  `;
}

/**
 * Render Official Circular Seal SVG
 */
function renderOfficialSealSvg(communityName = 'સત્તાવાર સિક્કો') {
  return `
    <div style="width: 72px; height: 72px; position: relative; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
      <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
        <circle cx="50" cy="50" r="48" fill="none" stroke="#047857" stroke-width="2" stroke-dasharray="3,1.5" />
        <circle cx="50" cy="50" r="44" fill="#fffdfa" stroke="#065f46" stroke-width="1.5" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="#d1fae5" stroke-width="0.9" />
        
        <path id="sealTop" d="M 16,50 A 34,34 0 0,1 84,50" fill="none" />
        <text font-size="7" font-weight="900" fill="#065f46" font-family="'Noto Sans Gujarati', sans-serif">
          <textPath href="#sealTop" startOffset="50%" text-anchor="middle">
            ★ VERIFIED RECEIPT ★
          </textPath>
        </text>
        
        <circle cx="50" cy="50" r="16.5" fill="#065f46" />
        <circle cx="50" cy="50" r="14.8" fill="none" stroke="#fef08a" stroke-width="0.8" />
        <text x="50" y="47" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="6.5" font-weight="900" font-family="'Plus Jakarta Sans', sans-serif">
          OFFICIAL
        </text>
        <text x="50" y="55" text-anchor="middle" dominant-baseline="central" fill="#fef08a" font-size="6.5" font-weight="800" font-family="'Noto Sans Gujarati', sans-serif">
          માન્ય
        </text>
        
        <path id="sealBottom" d="M 84,50 A 34,34 0 0,1 16,50" fill="none" />
        <text font-size="6.5" font-weight="800" fill="#047857" font-family="'Noto Sans Gujarati', sans-serif">
          <textPath href="#sealBottom" startOffset="50%" text-anchor="middle">
            ★ સત્તાવાર સ્વીકૃત ★
          </textPath>
        </text>
      </svg>
    </div>
  `;
}

/**
 * Main Donation Receipt HTML Renderer
 * Generates an executive, compact, best-UI themed A5 Landscape Donation Receipt Slip
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
      communityNameGuj = `${rawName} પરિવાર ચેરીટેબલ ટ્રસ્ટ`;
      communityNameEng = `${rawName.toUpperCase()} PARIVAR CHARITABLE TRUST`;
    }
  } else if (l.communityName && !l.communityName.includes('રાધનપુર')) {
    communityNameGuj = l.communityName;
    communityNameEng = l.orgName || 'COMMUNITY PARIVAR';
  }

  const primaryColor = c.primaryColor || '#065f46';
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
    <div style="width: 210mm; height: 148mm; max-width: 210mm; max-height: 148mm; box-sizing: border-box; background: #ffffff; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; border: 3px solid #065f46; font-family: 'Plus Jakarta Sans', 'Noto Sans Gujarati', 'Anek Gujarati', system-ui, sans-serif;">
      
      <!-- 1. TOP EXECUTIVE HEADER BANNER -->
      <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%); padding: 11px 18px; color: #ffffff; display: flex; align-items: center; justify-content: space-between; gap: 14px; position: relative; overflow: hidden; border-bottom: 2.5px solid #064e3b; flex-shrink: 0;">
        
        <div style="position: absolute; right: -25px; top: -25px; width: 140px; height: 140px; background: rgba(255,255,255,0.06); border-radius: 50%; pointer-events: none;"></div>
        
        <!-- Left: Official Logo -->
        <div style="width: 58px; height: 58px; background: #ffffff; border-radius: 10px; padding: 2px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); flex-shrink: 0;">
          <img src="${logoBase64}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>

        <!-- Center: Trust & Organization Title -->
        <div style="flex: 1; text-align: center; padding: 0 4px;">
          <div style="font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 22px; font-weight: 900; line-height: 1.15; letter-spacing: 0.3px; text-shadow: 0 1px 3px rgba(0,0,0,0.25);">
            ${escapeHtml(communityNameGuj)}
          </div>
          <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 2.4px; text-transform: uppercase; color: #d1fae5; margin-top: 2px;">
            ${escapeHtml(communityNameEng)}
          </div>
          <div style="font-size: 8.5px; color: #a7f3d0; font-weight: 600; margin-top: 2px;">
            ${escapeHtml(trustRegLine)} ${officeAddress ? `• ${escapeHtml(officeAddress)}` : ''} ${contactPhone ? `• ✆ ${escapeHtml(contactPhone)}` : ''}
          </div>
        </div>

        <!-- Right: Receipt Number & Date (Clean, unboxed presentation) -->
        <div style="flex-shrink: 0; text-align: right; min-width: 135px;">
          <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.8px; color: #fef08a; text-transform: uppercase;">
            સત્તાવાર દાન પહોંચ
          </div>
          <div style="margin-top: 3px; font-size: 10.5px; font-weight: 800; color: #ffffff;">
            <span style="color: #a7f3d0; font-weight: 700;">No:</span> <span style="font-family: monospace; font-size: 11.5px; background: rgba(255,255,255,0.22); padding: 1px 7px; border-radius: 4px; font-weight: 900;">${escapeHtml(receiptNo)}</span>
          </div>
          <div style="margin-top: 2.5px; font-size: 9.5px; font-weight: 700; color: #d1fae5;">
            તારીખ: <strong style="color: #ffffff;">${escapeHtml(formattedDate)}</strong>
          </div>
        </div>
      </div>

      <!-- 2. MAIN BODY SECTION (Proportionally filled without dead space) -->
      <div style="padding: 12px 18px 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
        
        <!-- Core Grid (Left Details 66% + Right Amount Card 34%) -->
        <div style="display: flex; gap: 14px; align-items: stretch; margin-bottom: 2px;">
          
          <!-- Left: Donor & Donation Particulars -->
          <div style="flex: 1.95; display: flex; flex-direction: column; justify-content: space-between; gap: 9px;">
            
            <!-- Donor Name Card -->
            <div style="background: #f8fafc; border: 1.2px solid #e2e8f0; border-left: 5px solid #047857; border-radius: 8px; padding: 8px 14px;">
              <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                દાતાશ્રીનું નામ (DONOR NAME):
              </div>
              <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                ${escapeHtml(d.donator_name || '-')}
              </div>
            </div>

            <!-- Purpose & Mode 2-col Sub-grid -->
            <div style="display: flex; gap: 10px;">
              <div style="flex: 1.25; background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 8px; padding: 7px 12px;">
                <div style="font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  દાનનો હેતુ / યોજના (PURPOSE):
                </div>
                <div style="font-size: 12px; font-weight: 800; color: #1e293b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(d.donation_purpose || 'સામાન્ય દાન (General Donation)')}
                </div>
              </div>

              <div style="flex: 1; background: #f0fdf4; border: 1.2px solid #bbf7d0; border-radius: 8px; padding: 7px 12px;">
                <div style="font-size: 8.5px; font-weight: 800; color: #15803d; text-transform: uppercase;">
                  ચૂકવણી મોડ (PAYMENT MODE):
                </div>
                <div style="font-size: 11.5px; font-weight: 800; color: #166534; margin-top: 2px;">
                  ${escapeHtml(modeGuj)}
                </div>
              </div>
            </div>

            <!-- Amount in Words -->
            <div style="background: #fafaf9; border: 1.2px solid #e7e5e4; border-radius: 8px; padding: 7px 14px;">
              <div style="font-size: 8.5px; font-weight: 800; color: #78716c; text-transform: uppercase;">
                અંકે રૂપિયા (AMOUNT IN WORDS):
              </div>
              <div style="font-size: 12.5px; font-weight: 900; color: #1c1917; margin-top: 2px; line-height: 1.35;">
                ${escapeHtml(gujaratiWords)} <span style="font-size: 10.5px; color: #57534e; font-weight: 700;">(${escapeHtml(englishWords)})</span>
              </div>
            </div>
          </div>

          <!-- Right: Highlight Amount & Security Card -->
          <div style="flex: 1.05; background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%); border: 2.2px solid #10b981; border-radius: 10px; padding: 10px 12px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-shadow: 0 3px 10px rgba(16,185,129,0.15);">
            
            <div style="width: 100%;">
              <div style="font-size: 9.5px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 1px;">
                DONATION AMOUNT
              </div>
              <div style="font-size: 29px; font-weight: 900; color: #064e3b; letter-spacing: -0.5px; line-height: 1.1; margin: 4px 0 2px;">
                ₹ ${formattedAmount} /-
              </div>
            </div>

            <!-- QR Code & Verified Tag -->
            <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1.2px solid #a7f3d0; border-radius: 8px; padding: 6px 10px; width: 100%; justify-content: center;">
              ${renderMiniQrSvg()}
              <div style="text-align: left;">
                <div style="display: inline-block; background: #dcfce7; color: #166534; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">
                  ✓ VERIFIED
                </div>
                <div style="font-size: 8px; font-weight: 800; color: #047857; margin-top: 2.5px;">
                  100% Official
                </div>
                <div style="font-size: 7.5px; color: #64748b; font-weight: 600;">
                  Scan To Verify
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- AABHAR MESSAGE STRIP (Rich gratitude card with Ishwar removed) -->
        <div style="background: #fffbeb; border: 1.2px solid #fef3c7; border-left: 5px solid #f59e0b; border-radius: 8px; padding: 8px 14px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">🤲</span>
          <div style="font-size: 10.5px; font-weight: 700; color: #92400e; line-height: 1.35;">
            આપશ્રીના આ ઉમદા સખાવતી દાન બદલ સમસ્ત સમાજ હૃદયપૂર્વક આભાર વ્યક્ત કરે છે અને આપના ધન-ધાન્યમાં અવિરત બરકત રહે એવી નેક દુઆ તથા શુભકામનાઓ પાઠવે છે!
          </div>
        </div>

        <!-- FOOTER: SIGNATURES & OFFICIAL SEAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 8px 12px 4px; border: 1.2px solid #e2e8f0; background: #f8fafc; border-radius: 8px;">
          
          <!-- Left: Cashier -->
          <div style="text-align: center; width: 140px;">
            <div style="height: 24px;"></div>
            <div style="border-top: 1.5px solid #334155; padding-top: 3px;">
              <div style="font-weight: 900; font-size: 11.5px; color: #0f172a;">ખજાનચી / કેશિયર</div>
              <div style="font-size: 8.5px; color: #64748b; font-weight: 700;">Treasurer / Cashier</div>
            </div>
          </div>

          <!-- Center: Verified Seal -->
          <div style="text-align: center;">
            ${renderOfficialSealSvg(communityNameGuj)}
          </div>

          <!-- Right: Secretary / President -->
          <div style="text-align: center; width: 140px;">
            <div style="height: 24px;"></div>
            <div style="border-top: 1.5px solid #334155; padding-top: 3px;">
              <div style="font-weight: 900; font-size: 11.5px; color: #0f172a;">પ્રમુખ / મંત્રી</div>
              <div style="font-size: 8.5px; color: #64748b; font-weight: 700;">President / Secretary</div>
            </div>
          </div>
        </div>

        <!-- SUBTEXT NOTICE -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 600; padding: 2px 4px 0;">
          <span>* આ કમ્પ્યુટરાઈઝ્ડ સત્તાવાર ઈ-પહોંચ છે • Valid Computerized Official Donation Receipt</span>
          <span style="font-family: monospace;">TXN: ${escapeHtml(receiptNo)}-EVAL • 100% SECURE</span>
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
