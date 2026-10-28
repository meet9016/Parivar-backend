const fs = require('fs');
const path = require('path');

/**
 * Escape HTML to prevent XSS
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
 * Format date into DD / MM / YYYY
 */
function formatDateDisplay(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes('/')) return str;
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')} / ${parts[1].padStart(2, '0')} / ${parts[0]}`;
      }
      return `${parts[0].padStart(2, '0')} / ${parts[1].padStart(2, '0')} / ${parts[2]}`;
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day} / ${month} / ${year}`;
    }
  } catch (_) { }
  return String(val);
}

const GUJARATI_DAYS = [
  'રવિવાર',
  'સોમવાર',
  'મંગળવાર',
  'બુધવાર',
  'ગુરુવાર',
  'શુક્રવાર',
  'શનિવાર'
];

const ISLAMIC_MONTHS = [
  'મોહર્રમ', 'સફર', 'રબીઉલ અવ્વલ', 'રબીઉલ આખિર',
  'જમાદિલ અવ્વલ', 'જમાદિલ આખિર', 'રજબ', 'શાબાન',
  'રમઝાન', 'શવ્વાલ', 'ઝીલકાદ', 'ઝીલહિજ્જા'
];

function parseAnyDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const str = String(dateStr).trim();
  if (!str) return null;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const res = new Date(y, m, d);
      return isNaN(res.getTime()) ? null : res;
    }
  }
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const res = new Date(y, m, d);
        return isNaN(res.getTime()) ? null : res;
      }
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const res = new Date(y, m, d);
      return isNaN(res.getTime()) ? null : res;
    }
  }
  const res = new Date(str);
  return isNaN(res.getTime()) ? null : res;
}

function getGujaratiDay(dateStr) {
  const d = parseAnyDate(dateStr);
  if (!d) return '';
  return GUJARATI_DAYS[d.getDay()] || '';
}

function getAutoIslamicDate(dateStr) {
  const d = parseAnyDate(dateStr);
  if (!d) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    const monthName = ISLAMIC_MONTHS[month - 1] || '';
    return monthName ? `${day} ${monthName}` : '';
  } catch (e) {
    try {
      const formatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value;
      const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
      const monthName = ISLAMIC_MONTHS[month - 1] || '';
      return monthName ? `${day} ${monthName}` : '';
    } catch (_) { }
  }
  return '';
}

/**
 * Load asset as base64 data URI
 */
function getAssetDataUri(filename, mimeType = 'image/png') {
  try {
    const uploadPath = path.resolve(__dirname, '../../public/uploads', filename);
    if (fs.existsSync(uploadPath)) {
      const data = fs.readFileSync(uploadPath).toString('base64');
      return `data:${mimeType};base64,${data}`;
    }
    const assetPath = path.resolve(__dirname, '../assets', filename);
    if (fs.existsSync(assetPath)) {
      const data = fs.readFileSync(assetPath).toString('base64');
      return `data:${mimeType};base64,${data}`;
    }
  } catch (_) { }
  return '';
}

/**
 * Render Death / Mayyat Notification Card HTML
 * Matches exact royal Islamic Gujarati design template with gold ornaments, top arch banner & labels
 * @param {object} member - User / Deceased Member object
 * @param {object} options - Dynamic options
 * @returns {Promise<string>} Clean HTML string
 */
async function renderVafatCardHtml(member, options = {}) {
  const isFemale = String(member?.gender || '').toLowerCase() === 'female';
  const nameLabel = isFemale ? 'મરહુમાનું નામ' : 'મરહુમનું નામ';

  const memberName = (options.name !== undefined && options.name !== '') ? options.name : (options.memberName || [member?.first_name, member?.middle_name, member?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || member?.name || member?.full_name || '');

  const communityName = options.communityNameGujarati || options.communityName || options.community_name || 'રાધનપુર મેમણ જમાત';

  const rawDate = (options.formattedDate !== undefined && options.formattedDate !== '') ? options.formattedDate : ((options.date !== undefined && options.date !== '') ? options.date : (formatDateDisplay(member?.death_date) || ''));
  const vaarText = (options.vaar !== undefined && options.vaar !== '') ? options.vaar : (member?.vaar || (member?.death_date ? getGujaratiDay(member.death_date) : '') || '');
  const villageText = options.village !== undefined ? options.village : (member?.village || member?.native_place || '');
  const addressText = options.address !== undefined ? options.address : (member?.address || member?.death_place || '');
  const janazaTime = (options.janaza_time !== undefined && options.janaza_time !== '') ? options.janaza_time : (options.janazaTime || member?.janaza_time || '');
  const rawJanazaPlace = (options.janaza_place !== undefined && options.janaza_place !== '') ? options.janaza_place : (options.janazaPlace || member?.janaza_place || '');
  const janazaPlace = rawJanazaPlace ? (rawJanazaPlace.endsWith('માં') ? rawJanazaPlace : `${rawJanazaPlace} માં`) : '';
  const kabrastanText = (options.kabrastan !== undefined && options.kabrastan !== '') ? options.kabrastan : (member?.kabrastan || '');
  const mobileNumber = (options.number !== undefined && options.number !== '') ? options.number : (options.mobile || member?.number || member?.mobile || member?.phone || '');

  let addressLine = '';
  if (addressText && villageText) {
    const vDisplay = villageText.startsWith('ગામ:') ? villageText : `ગામ: ${villageText}`;
    addressLine = `${addressText}, ${vDisplay}`;
  } else if (addressText) {
    addressLine = addressText;
  } else if (villageText) {
    addressLine = villageText.startsWith('ગામ:') ? villageText : `ગામ: ${villageText}`;
  }

  const isPdf = options.isPdf || options.format === 'pdf';

  // Base64 assets from public/uploads
  const topImgDataUri = getAssetDataUri('top_img.png');
  const labelDataUri = getAssetDataUri('label_tall.png') || getAssetDataUri('label.png');
  const bannerDataUri = getAssetDataUri('banner_tall.png') || labelDataUri;
  const mosqueIconDataUri = getAssetDataUri('gold_mosque_icon.png');
  const cornerDataUri = getAssetDataUri('mayyat_corner.png');
  const sealDataUri = getAssetDataUri('letterpad.png') || getAssetDataUri('jamatSeal.png');

  return `
    <div class="vafat-card-wrapper ${isPdf ? 'pdf-page' : ''}">
      <div class="card-frame vafat-card-container">
        
        <!-- Outer thin gold border line -->
        <div class="outer-inner-line"></div>

        <!-- Top Corner Ornaments on Navy Background -->
        <div class="corner-top corner-tl"></div>
        <div class="corner-top corner-tr"></div>

        <!-- Top Arch Banner using top_img.png -->
        <div class="top-header-banner">
          <img src="${topImgDataUri}" class="top-header-img" alt="Top Header Arch" />
          <div class="top-cartouche-content">
            <span class="arabic-title">إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</span>
            <div class="title-mosque-row">
              <h1 class="gujarati-main-title">મૈયત સમાચાર</h1>
            </div>
          </div>
        </div>

        <!-- Main Parchment Content Body -->
        <div class="parchment-container">
          <!-- Bottom Corner Ornaments inside Cream Background -->
          <div class="corner-bottom corner-bl"></div>
          <div class="corner-bottom corner-br"></div>

          <div class="card-content-body">
            <!-- Date & Day Row (Left-aligned after label) -->
            <div class="date-day-row">
              <div class="date-group">
                <span>તા.</span>
                <span class="date-val" contenteditable="true" spellcheck="false" data-field="date">${escapeHtml(rawDate) || '___ / ___ / ___'}</span>
              </div>
              <div class="day-group">
                <span>વાર.</span>
                <span class="day-val" contenteditable="true" spellcheck="false" data-field="vaar">${escapeHtml(vaarText) || '________________'}</span>
              </div>
            </div>

            <!-- Fields List: 6 Clean Aligned Rows -->
            <div class="fields-list">
              
              <!-- 1. Marhum Name -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">${escapeHtml(nameLabel)}</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="name">${escapeHtml(memberName)}</div>
                </div>
              </div>

              <!-- 2. Address & Village (Single Line) -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">સરનામું</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="address">${escapeHtml(addressLine)}</div>
                </div>
              </div>

              <!-- 3. Janaza Time (Separate Row) -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">જનાઝાનો સમય</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="janaza_time">${escapeHtml(janazaTime)}</div>
                </div>
              </div>

              <!-- 4. Janaza Place (Separate Row) -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">જનાઝાની નમાઝનું સ્થળ</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="janaza_place">${escapeHtml(janazaPlace)}</div>
                </div>
              </div>

              <!-- 5. Kabrastan -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">કબ્રસ્તાન</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="kabrastan">${escapeHtml(kabrastanText)}</div>
                </div>
              </div>

              <!-- 6. Mobile Number (Aligned with other badges) -->
              <div class="field-item">
                <div class="badge-wrap">
                  <img src="${labelDataUri}" class="badge-bg" alt="" />
                  <span class="badge-text">મોબાઇલ નંબર</span>
                </div>
                <div class="field-value-lines">
                  <div class="line-text" contenteditable="true" spellcheck="false" data-field="number">${escapeHtml(mobileNumber)}</div>
                </div>
              </div>

            </div>

            <!-- Namaz Method Banner -->
            <div class="namaz-banner-wrap">
              <img src="${bannerDataUri}" class="badge-bg" alt="" />
              <span class="namaz-banner-text">જનાઝાની નમાઝનો તરીકો</span>
            </div>

            <!-- Namaz Instruction Text -->
            <div class="namaz-instructions">
              મુક્તદી કિબ્લાની તરફ નિય્યત કરે કે: હું નિય્યત કરૂં છું આ જનાઝાની નમાઝની, ચાર તકબીર સાથે અલ્લાહ માટે, દુઆ માટે, આ મૈયત માટે, પાછળ આ ઈમામની. પછી પ્રથમ તકબીર કહી હાથ બાંધી સુરા ફાતિહા પઢે. બીજી તકબીર પછી દુરૂદે ઈબ્રાહીમ પઢે. ત્રીજી તકબીર પછી મૈયત માટે દુઆ કરે કે: "અલ્લાહુમ્મા ઈગ્ફિર લિહય્યિના વ મય્યિતિના.." ચોથી તકબીર પછી સલામ ફેરવે જમણી અને ડાબી તરફ.
            </div>

            <!-- Footer Jamat Logo & Name -->
            <div class="card-footer">
              ${sealDataUri ? `<img src="${sealDataUri}" class="seal-img" alt="Seal" />` : ''}
              <div class="jamat-title">${escapeHtml(communityName)}</div>
            </div>

          </div>
        </div>

      </div>
    </div>

    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Noto+Sans+Gujarati:wght@500;600;700;800&display=swap');

      * {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
      }

      body {
        background: transparent;
        font-family: 'Noto Sans Gujarati', system-ui, -apple-system, sans-serif;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
        padding: 0;
        margin: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .vafat-card-wrapper {
        width: 100%;
        max-width: 665px;
        margin: 0 auto;
        display: flex;
        justify-content: center;
      }

      .pdf-page {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }

      /* Overall Card Container */
      .card-frame {
        width: 665px;
        height: 980px;
        background-color: #06182c !important;
        position: relative;
        border: 2px solid #caa156 !important;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.45) !important;
      }

      /* Thin Inner Border Line */
      .outer-inner-line {
        position: absolute;
        top: 4px;
        left: 4px;
        right: 4px;
        bottom: 4px;
        border: 1px solid #7d6328 !important;
        pointer-events: none;
        z-index: 1;
      }

      /* Top Corner Ornaments on Navy Background */
      .corner-top {
        position: absolute;
        width: 140px;
        height: 140px;
        background-image: url('${cornerDataUri}');
        background-size: contain;
        background-repeat: no-repeat;
        pointer-events: none;
        z-index: 1;
      }
      .corner-tl { top: 2px; left: 2px; }
      .corner-tr { top: 2px; right: 2px; transform: scaleX(-1); }

      /* Top Arch Banner Header using top_img.png */
      .top-header-banner {
        position: relative;
        margin: 8px 16px 0 16px;
        width: calc(100% - 32px);
        height: 270px;
        overflow: hidden;
        z-index: 3;
      }
      .top-header-img {
        position: absolute;
        top: -26px;
        left: 0;
        width: 100%;
        height: 324px;
        pointer-events: none;
      }

      /* Content positioned inside the dark blue cartouche of top_img.png */
      .top-cartouche-content {
        position: absolute;
        top: 124px;
        left: 40px;
        right: 40px;
        height: 115px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 4;
        text-align: center;
      }
      .arabic-title {
        font-family: 'Amiri', serif;
        font-size: 21px;
        font-weight: 700;
        color: #ffffff !important;
        line-height: 1.15;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
        letter-spacing: 0.5px;
      }
      .title-mosque-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 6px;
      }
      .cartouche-mosque-img {
        width: 44px;
        height: 48px;
        object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
      }
      .cartouche-mosque-right {
        transform: scaleX(-1);
      }
      .gujarati-main-title {
        font-size: 40px;
        font-weight: 800;
        color: #fad074 !important;
        line-height: 1;
        letter-spacing: 1.2px;
        text-shadow: 0 2px 5px rgba(0, 0, 0, 0.95);
      }

      /* The Cream Parchment Body */
      .parchment-container {
        position: relative;
        z-index: 2;
        margin: -2px 16px 16px 16px;
        width: calc(100% - 32px);
        background: #fffdf8 !important;
        background: radial-gradient(circle at 50% 30%, #fffdf8 0%, #faf5ea 70%, #f6edd7 100%) !important;
        border: 2px solid #caa156 !important;
        border-top: none !important;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }

      /* Bottom Corner Ornaments inside Cream Background */
      .corner-bottom {
        position: absolute;
        width: 135px;
        height: 135px;
        background-image: url('${cornerDataUri}');
        background-size: contain;
        background-repeat: no-repeat;
        pointer-events: none;
        z-index: 1;
        opacity: 0.85;
      }
      .corner-bl { bottom: 0; left: 0; transform: scaleY(-1); }
      .corner-br { bottom: 0; right: 0; transform: scale(-1, -1); }

      /* Middle Content Body */
      .card-content-body {
        position: relative;
        z-index: 3;
        padding: 0 18px 8px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        flex: 1;
      }

      /* Date & Day Row - Left aligned after label */
      .date-day-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 14px 4px 4px;
        font-size: 19px;
        font-weight: 700;
        color: #081a2e !important;
      }
      .date-group, .day-group {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .date-val, .day-val {
        border-bottom: 2px solid #081a2e !important;
        padding: 0 4px 1px 6px;
        display: inline-block;
        text-align: left;
        font-weight: 600;
        font-size: 16.5px;
        color: #081a2e !important;
      }

      /* Fields list - 6 clean aligned rows */
      .fields-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 2px 0;
      }
      .field-item {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .field-item.two-line {
        align-items: flex-start;
      }

      /* Label Badge using new label_tall.png */
      .badge-wrap {
        position: relative;
        width: 220px;
        height: 52px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .badge-wrap.two-line {
        height: 54px;
        margin-top: 1px;
      }
      .badge-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: fill;
        pointer-events: none;
      }
      .badge-text {
        position: relative;
        z-index: 2;
        color: #ffffff !important;
        font-size: 15.5px;
        font-weight: 600;
        text-align: center;
        padding: 0 16px;
        line-height: 1.25;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      }
      .badge-text.small-text {
        font-size: 13.5px;
        line-height: 1.2;
      }

      .field-value-lines {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .line-text {
        border-bottom: 2px solid #081a2e !important;
        padding-bottom: 2px;
        font-size: 16px;
        font-weight: 600;
        color: #081a2e !important;
        min-height: 24px;
        display: flex;
        align-items: flex-end;
        padding-left: 6px;
      }

      /* Namaz Method Banner using banner_tall.png */
      .namaz-banner-wrap {
        position: relative;
        width: 500px;
        height: 46px;
        margin: 4px auto 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .namaz-banner-text {
        position: relative;
        z-index: 2;
        color: #ffffff !important;
        font-size: 19px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      /* Namaz Instruction text */
      .namaz-instructions {
        text-align: center;
        font-size: 11.5px;
        font-weight: 500;
        color: #000000 !important;
        line-height: 1.5;
        padding: 4px 10px 0;
      }

      /* Footer Logo & Name */
      .card-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 3px;
        gap: 2px;
        position: relative;
        z-index: 3;
      }
      .seal-img {
        width: 60px;
        height: 60px;
        object-fit: contain;
      }
      .jamat-title {
        font-size: 21px;
        font-weight: 700;
        color: #081a2e !important;
        letter-spacing: 0.5px;
      }

      /* Editable fields interactive styling */
      [contenteditable="true"] {
        cursor: text !important;
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      [contenteditable="true"]:focus {
        outline: 2px solid rgba(202, 161, 86, 0.55) !important;
        background: rgba(202, 161, 86, 0.08) !important;
        border-radius: 3px !important;
      }
      [contenteditable="true"]:hover {
        background: rgba(202, 161, 86, 0.04);
      }
    </style>

    <script>
      (function() {
        function getValues() {
          function getVal(selector) {
            var el = document.querySelector(selector);
            return el ? (el.innerText || el.textContent || '').trim() : '';
          }
          return {
            date: getVal('[data-field="date"]'),
            vaar: getVal('[data-field="vaar"]'),
            name: getVal('[data-field="name"]'),
            address: getVal('[data-field="address"]'),
            janaza_time: getVal('[data-field="janaza_time"]'),
            janaza_place: getVal('[data-field="janaza_place"]'),
            kabrastan: getVal('[data-field="kabrastan"]'),
            number: getVal('[data-field="number"]')
          };
        }

        function sendToParent() {
          try {
            var data = getValues();
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'VAFAT_CARD_DATA_CHANGE', data: data }, '*');
            }
          } catch (_) {}
        }

        document.addEventListener('input', function(e) {
          if (e.target && e.target.getAttribute('contenteditable') === 'true') {
            sendToParent();
          }
        });

        document.addEventListener('blur', function(e) {
          if (e.target && e.target.getAttribute('contenteditable') === 'true') {
            sendToParent();
          }
        }, true);

        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'GET_VAFAT_CARD_DATA') {
            try {
              var data = getValues();
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'VAFAT_CARD_DATA_RESPONSE', data: data, requestId: e.data.requestId }, '*');
              }
            } catch (_) {}
          }
        });

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          sendToParent();
        } else {
          document.addEventListener('DOMContentLoaded', sendToParent);
        }
        setTimeout(sendToParent, 300);
      })();
    </script>
  `;
}

module.exports = {
  renderVafatCardHtml,
  formatDateDisplay,
  getGujaratiDay,
  getAutoIslamicDate
};
