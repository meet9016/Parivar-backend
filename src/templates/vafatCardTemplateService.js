const axios = require('axios');

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
 * Format date into DD/MM/YYYY
 */
function formatDateDisplay(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes('/')) return str;
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
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
  const day = d.getDate();
  const month = d.getMonth() + 1; // 1 to 12
  const monthName = ISLAMIC_MONTHS[month - 1] || '';
  return monthName ? `${day} ${monthName}` : '';
}

/**
 * Render Death / Mayyat Notification Card HTML (Clean Normal White Card - Wide - No Photo)
 * @param {object} member - User / Deceased Member object
 * @param {object} options - Options including communityName, etc.
 * @returns {Promise<string>} Clean HTML string
 */
async function renderVafatCardHtml(member, options = {}) {
  const isFemale = String(member?.gender || '').toLowerCase() === 'female';
  const titlePrefixGujarati = isFemale ? 'મરહૂમા' : 'મરહૂમ';

  const memberName = [member?.first_name, member?.middle_name, member?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || member?.name || member?.full_name || 'Community Member';

  const communityName = options.communityName || options.community_name || 'Shree Halai Memon Jamat';

  const rawDate = formatDateDisplay(member?.death_date) || '-';
  const islamicDate = member?.islamic_date || (member?.death_date ? getAutoIslamicDate(member.death_date) : '');
  const dateDisplay = islamicDate ? `${rawDate} (${islamicDate})` : rawDate;
  const villageText = member?.village || member?.native_place || '-';
  const vaarText = member?.vaar || (member?.death_date ? getGujaratiDay(member.death_date) : '-');
  const janazaTime = member?.janaza_time || '...';
  const janazaPlace = member?.janaza_place ? `${member.janaza_place} માં` : '... માં';
  const addressText = member?.address || member?.death_place || '-';

  const isPdf = options.isPdf || options.format === 'pdf';

  return `
    <div class="vafat-card-wrapper ${isPdf ? 'pdf-page' : ''}">
      <div class="vafat-card-container">
        
        <!-- Header: મૈયત સમાચાર -->
        <div class="header-box">
          <h1 class="header-title">મૈયત સમાચાર</h1>
        </div>

        <!-- Metadata Section: ગામ, તારીખ, વાર -->
        <div class="meta-section">
          <div class="meta-row">
            <span class="meta-label">ગામ -</span>
            <span class="meta-val">${escapeHtml(villageText)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">તારીખ:</span>
            <span class="meta-val">${escapeHtml(dateDisplay)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">વાર:</span>
            <span class="meta-val">${escapeHtml(vaarText)}</span>
          </div>
        </div>

        <!-- Marhum Name Block (Text only, no photo) -->
        <div class="name-block">
          <h2 class="marhum-name">* ${escapeHtml(titlePrefixGujarati)} ${escapeHtml(memberName)} *</h2>
        </div>

        <!-- Janaza Announcement Line -->
        <div class="janaza-line">
          જનાઝા ની નમાઝ નો ટાઇમ <span class="highlight underline">${escapeHtml(janazaTime)}</span> વાગે <span class="highlight">${escapeHtml(janazaPlace)}</span> <span class="highlight">ઇન્શાઅલ્લાહ</span> નક્કી થયેલ છે.
        </div>

        <!-- Address Line -->
        <div class="address-line">
          *એડ્રેસ: ${escapeHtml(addressText)}*
        </div>

        <!-- Calligraphy: Inna Lillahi -->
        <div class="calligraphy-block">
          <div class="arabic-verse">إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</div>
          <div class="gujarati-verse">ઈન્ના લિલ્લાહી વ ઈન્ના ઈલયહી રાજેઊન...</div>
        </div>

        <!-- Dua-e-Magfirat Body -->
        <div class="dua-body">
          અલ્લાહ પાક.. એના પ્યારા હબીબ મોહમ્મદ મુસ્તફા સલ્લલ્લાહુ અલયહી વસલ્લમના સદકામા... બુઝુરગાને દીન રહમતુલ્લાહી તઆલા અલયહીના વસીલાથી મગફીરત ફરમાવે... એમની આગળની મંઝીલો આસાન ફરમાવે... દરજાત બુલંદ ફરમાવે...ઘરવાળાઓને સબ્રે જમીલ અતા ફરમાવે...
        </div>

        <!-- Closing Aameen -->
        <div class="aameen-block">
          <div class="arabic-aameen">آمین بجاه شفیع المذنبین ﷺ</div>
          <div class="gujarati-aameen">આમીન... યા રબ્બુલ આલમીન.</div>
        </div>

        <!-- Community Signature Footer -->
        <div class="card-footer">
          — ${escapeHtml(communityName)} —
        </div>

      </div>
    </div>

    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Sans+Gujarati:wght@500;600;700;800;900&family=Noto+Sans:wght@500;600;700;800;900&display=swap');

      * {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
      }

      body {
        background: #f1f5f9;
        font-family: 'Noto Sans Gujarati', 'Noto Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 24px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .vafat-card-wrapper {
        width: 100%;
        max-width: 660px;
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

      .vafat-card-container {
        width: 100%;
        background: #ffffff !important;
        border: 2.5px solid #1c1917 !important;
        border-radius: 22px;
        padding: 34px 30px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1) !important;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .header-box {
        border-bottom: 2px solid #1c1917;
        padding-bottom: 14px;
        margin-bottom: 22px;
      }

      .header-title {
        font-size: 30px;
        font-weight: 900;
        color: #0c0a09;
        letter-spacing: 0.8px;
        line-height: 1.2;
      }

      .meta-section {
        text-align: left;
        margin-bottom: 20px;
        padding: 0 6px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .meta-row {
        font-size: 17px;
        font-weight: 700;
        color: #1c1917;
        line-height: 1.4;
      }

      .meta-label {
        font-weight: 900;
        color: #0c0a09;
        margin-right: 8px;
      }

      .name-block {
        border-top: 1px dashed #a8a29e;
        border-bottom: 1px dashed #a8a29e;
        padding: 14px 0;
        margin: 18px 0;
      }

      .marhum-name {
        font-size: 26px;
        font-weight: 900;
        color: #0c0a09;
        letter-spacing: -0.2px;
        line-height: 1.3;
      }

      .janaza-line {
        font-size: 16px;
        font-weight: 700;
        color: #1c1917;
        line-height: 1.65;
        margin: 20px 0;
        padding: 0 10px;
      }

      .highlight {
        font-weight: 900;
        color: #000000;
      }

      .underline {
        text-decoration: underline;
        text-underline-offset: 3.5px;
      }

      .address-line {
        font-size: 16px;
        font-weight: 900;
        color: #0c0a09;
        margin: 16px 0;
        padding: 0 10px;
      }

      .calligraphy-block {
        border-top: 1px solid #e7e5e4;
        padding-top: 20px;
        margin-top: 20px;
      }

      .arabic-verse {
        font-family: 'Amiri', 'Traditional Arabic', serif;
        font-size: 25px;
        font-weight: 700;
        color: #0c0a09;
        margin-bottom: 6px;
        line-height: 1.4;
      }

      .gujarati-verse {
        font-size: 16px;
        font-weight: 700;
        color: #292524;
        line-height: 1.4;
      }

      .dua-body {
        font-size: 14.5px;
        font-weight: 600;
        color: #44403c;
        line-height: 1.75;
        margin: 18px 0;
        padding: 0 16px;
      }

      .aameen-block {
        margin: 18px 0 14px;
      }

      .arabic-aameen {
        font-family: 'Amiri', 'Traditional Arabic', serif;
        font-size: 22px;
        font-weight: 700;
        color: #0c0a09;
        line-height: 1.3;
      }

      .gujarati-aameen {
        font-size: 14.5px;
        font-weight: 700;
        color: #292524;
        margin-top: 5px;
      }

      .card-footer {
        border-top: 1px solid #e7e5e4;
        padding-top: 14px;
        margin-top: 18px;
        font-size: 12.5px;
        font-weight: 700;
        color: #78716c;
        letter-spacing: 0.5px;
      }
    </style>
  `;
}

module.exports = {
  renderVafatCardHtml
};
