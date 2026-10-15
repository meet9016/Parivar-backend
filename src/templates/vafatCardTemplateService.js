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

/**
 * In-memory cache for downloaded member images as base64
 */
const imageBase64Cache = new Map();

async function resolveImageBase64(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('data:image')) return imageUrl;

  if (imageBase64Cache.has(imageUrl)) {
    return imageBase64Cache.get(imageUrl);
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = `data:${contentType};base64,${Buffer.from(response.data).toString('base64')}`;
    imageBase64Cache.set(imageUrl, base64);
    return base64;
  } catch (_) {
    return imageUrl; // fallback to raw URL
  }
}

/**
 * Render Death / Vafat Notification Card HTML
 * @param {object} member - User / Deceased Member object
 * @param {object} options - Options including communityName, etc.
 * @returns {Promise<string>} Clean HTML string
 */
async function renderVafatCardHtml(member, options = {}) {
  const isFemale = String(member?.gender || '').toLowerCase() === 'female';
  const titlePrefix = isFemale ? 'Marhuma' : 'Marhum';
  const titlePrefixGujarati = isFemale ? 'મરહૂમા' : 'મરહૂમ';

  const memberName = [member?.first_name, member?.middle_name, member?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || member?.name || member?.full_name || 'Community Member';

  const communityName = options.communityName || options.community_name || 'Shree Halai Memon Jamat';

  // Subtitle info
  const subtitleItems = [
    member?.relation,
    member?.village,
    member?.native_place,
    member?.family_head?.name ? `Family Head: ${member.family_head.name}` : (member?.familyHead ? 'Family Head' : '')
  ].filter(Boolean);
  const subtitleText = subtitleItems.join(' • ');

  // Photo
  const rawImage = member?.profile_image || member?.image || '';
  let imageBase64 = '';
  if (rawImage) {
    imageBase64 = await resolveImageBase64(rawImage);
  }

  // Format Dua text: ensure member name is auto-prefixed by default
  const defaultDua = `${titlePrefixGujarati} ${memberName} ગુજરી ગયા છે. બધા સાથીઓ તેમના માટે ખાસ દુઆ કરે, અલ્લાહપાક તેમની મગફિરત કરે અને તેમને જન્નતુલ ફિરદોસમાં આલા મકામ ફરમાવે અને તેમના ઘરવાળાઓને સબર આપે. આમીન!`;
  let displayDua = String(member?.death_note || '').trim();

  if (!displayDua || displayDua === 'અલ્લાહપાક મરહૂમની મગફિરત કરે અને તેમને જન્નતુલ ફિરદોસમાં આલા મકામ ફરમાવે અને તેમના ઘરવાળાઓને સબર આપે. આમીન!') {
    displayDua = defaultDua;
  } else if (displayDua.startsWith('મરહૂમ ગુજરી ગયા છે') || displayDua.startsWith('મરહૂમા ગુજરી ગયા છે')) {
    displayDua = displayDua.replace(/^(મરહૂમ|મરહૂમા)\s+ગુજરી ગયા છે/, `${titlePrefixGujarati} ${memberName} ગુજરી ગયા છે`);
  }

  const vafatDate = formatDateDisplay(member?.death_date);
  const janazaDate = formatDateDisplay(member?.janaza_date);

  const isPdf = options.isPdf || options.format === 'pdf';

  return `
    <div class="vafat-card-wrapper ${isPdf ? 'pdf-page' : ''}">
      <div class="vafat-card-container">
        <!-- Top Ornamental Accent Bar -->
        <div class="top-accent-bar"></div>

        <!-- Ambient Glow Circles -->
        <div class="ambient-glow glow-top"></div>
        <div class="ambient-glow glow-bottom"></div>

        <!-- Profile Section -->
        <div class="profile-section">
          <div class="dp-wrapper">
            <div class="dp-border">
              ${
                imageBase64
                  ? `<img src="${imageBase64}" alt="${escapeHtml(memberName)}" class="dp-img" />`
                  : `<div class="dp-initial">${escapeHtml(memberName.charAt(0) || 'M')}</div>`
              }
            </div>
            <div class="dp-badge-container">
              <span class="dp-badge">${escapeHtml(titlePrefix)}</span>
            </div>
          </div>

          <div class="name-container">
            <h1 class="marhum-name">${escapeHtml(memberName)}</h1>
            ${
              subtitleText
                ? `<p class="marhum-sub">${escapeHtml(subtitleText)}</p>`
                : ''
            }
          </div>
        </div>

        <!-- Details Grid -->
        <div class="details-grid">
          <!-- 1. Vafat Details -->
          <div class="detail-card card-vafat">
            <div class="icon-box icon-vafat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <div class="card-content">
              <span class="card-label label-vafat">VAFAT DETAILS</span>
              <div class="card-val">${escapeHtml(vafatDate || 'Date not specified')}</div>
              ${
                member?.death_place
                  ? `<div class="card-sub place-sub">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span>${escapeHtml(member.death_place)}</span>
                    </div>`
                  : ''
              }
            </div>
          </div>

          <!-- 2. Namaz-e-Janaza -->
          ${
            (janazaDate || member?.janaza_time || member?.janaza_place)
              ? `<div class="detail-card card-janaza">
                  <div class="icon-box icon-janaza">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <div class="card-content">
                    <span class="card-label label-janaza">NAMAZ-E-JANAZA</span>
                    <div class="card-val">
                      ${escapeHtml(janazaDate || 'Janaza Date TBA')}
                      ${member?.janaza_time ? `<span class="janaza-time">(${escapeHtml(member.janaza_time)})</span>` : ''}
                    </div>
                    ${
                      member?.janaza_place
                        ? `<div class="card-sub place-sub">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span>Venue: ${escapeHtml(member.janaza_place)}</span>
                          </div>`
                        : ''
                    }
                  </div>
                </div>`
              : ''
          }

          <!-- 3. Tadfeen / Kabrastan -->
          ${
            member?.kabrastan
              ? `<div class="detail-card card-kabrastan">
                  <div class="icon-box icon-kabrastan">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div class="card-content">
                    <span class="card-label label-kabrastan">TADFEEN / KABRASTAN</span>
                    <div class="card-val">${escapeHtml(member.kabrastan)}</div>
                  </div>
                </div>`
              : ''
          }

          <!-- 4. Dua-e-Magfirat -->
          <div class="card-dua">
            <span class="dua-header">🤲 DUA-E-MAGFIRAT</span>
            <p class="dua-body">${escapeHtml(displayDua)}</p>
          </div>
        </div>

        <!-- Community Footer Signature -->
        <div class="card-footer">
          — ${escapeHtml(communityName)} —
        </div>
      </div>
    </div>

    <style>
      @import url('https://fonts.googleapis.com/css2?family=Anek+Gujarati:wght@500;600;700;800;900&family=Noto+Sans+Gujarati:wght@500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&display=swap');

      * {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        font-family: 'Outfit', 'Noto Sans Gujarati', 'Anek Gujarati', system-ui, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      .vafat-card-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: transparent;
        width: 100%;
        min-height: 100%;
        box-sizing: border-box;
      }

      .pdf-page {
        min-height: 100vh;
        padding: 30px 16px;
      }

      .vafat-card-container {
        width: 520px;
        max-width: 520px;
        background: linear-gradient(180deg, #FCFBF7 0%, #F8F4EC 50%, #F3ECE0 100%) !important;
        color: #1c1917 !important;
        border-radius: 28px !important;
        border: 2px solid rgba(245, 158, 11, 0.35) !important;
        padding: 28px 24px 22px 24px !important;
        box-shadow: 0 20px 30px -10px rgba(120, 53, 15, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
        position: relative !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .top-accent-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        background: linear-gradient(90deg, #d97706, #fbbf24, #d97706) !important;
      }

      .ambient-glow {
        position: absolute;
        border-radius: 9999px;
        pointer-events: none;
        filter: blur(48px);
      }
      .glow-top {
        top: -40px;
        right: -40px;
        width: 180px;
        height: 180px;
        background: rgba(251, 191, 36, 0.18);
      }
      .glow-bottom {
        bottom: -40px;
        left: -40px;
        width: 180px;
        height: 180px;
        background: rgba(16, 185, 129, 0.12);
      }

      .profile-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        margin-top: 6px;
        margin-bottom: 20px;
        position: relative;
        z-index: 2;
      }

      .dp-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .dp-border {
        width: 104px;
        height: 104px;
        border-radius: 22px;
        padding: 3.5px;
        background: linear-gradient(135deg, #d97706 0%, #fde68a 50%, #d97706 100%) !important;
        box-shadow: 0 10px 18px -4px rgba(120, 53, 15, 0.25) !important;
        box-sizing: border-box;
      }

      .dp-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 18px;
        background-color: #fffbeb;
        display: block;
      }

      .dp-initial {
        width: 100%;
        height: 100%;
        border-radius: 18px;
        background-color: #fffbeb;
        border: 1px solid rgba(253, 230, 138, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 38px;
        font-weight: 800;
        color: #78350f;
      }

      .dp-badge-container {
        margin-top: -12px;
        z-index: 5;
      }

      .dp-badge {
        display: inline-block;
        padding: 3px 18px;
        border-radius: 9999px;
        background: linear-gradient(90deg, #1c1917 0%, #292524 100%) !important;
        color: #fde68a !important;
        border: 1px solid rgba(251, 191, 36, 0.45) !important;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2) !important;
      }

      .name-container {
        margin-top: 10px;
      }

      .marhum-name {
        font-size: 24px;
        font-weight: 900;
        color: #1c1917;
        letter-spacing: -0.3px;
        line-height: 1.25;
      }

      .marhum-sub {
        font-size: 12.5px;
        font-weight: 600;
        color: #57534e;
        margin-top: 4px;
        line-height: 1.4;
      }

      .details-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: relative;
        z-index: 2;
      }

      .detail-card {
        background: #ffffff !important;
        border-radius: 18px !important;
        padding: 12px 16px !important;
        display: flex;
        align-items: flex-start;
        gap: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
        box-sizing: border-box;
      }

      .card-vafat {
        border: 1.5px solid rgba(253, 230, 138, 0.85) !important;
      }
      .card-janaza {
        border: 1.5px solid rgba(167, 243, 208, 0.85) !important;
      }
      .card-kabrastan {
        border: 1.5px solid rgba(153, 246, 228, 0.85) !important;
      }

      .icon-box {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .icon-vafat {
        background: rgba(245, 158, 11, 0.12) !important;
        border: 1px solid rgba(245, 158, 11, 0.25) !important;
        color: #92400e !important;
      }
      .icon-janaza {
        background: rgba(16, 185, 129, 0.12) !important;
        border: 1px solid rgba(16, 185, 129, 0.25) !important;
        color: #065f46 !important;
      }
      .icon-kabrastan {
        background: rgba(20, 184, 166, 0.12) !important;
        border: 1px solid rgba(20, 184, 166, 0.25) !important;
        color: #115e59 !important;
      }

      .card-content {
        flex: 1;
        min-width: 0;
      }

      .card-label {
        display: block;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .label-vafat {
        color: #92400e;
      }
      .label-janaza {
        color: #065f46;
      }
      .label-kabrastan {
        color: #115e59;
      }

      .card-val {
        font-size: 14.5px;
        font-weight: 800;
        color: #1c1917;
        line-height: 1.35;
      }

      .janaza-time {
        font-size: 12.5px;
        font-weight: 700;
        color: #065f46;
        margin-left: 6px;
      }

      .place-sub {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: #57534e;
        font-weight: 600;
        margin-top: 3px;
      }

      .card-dua {
        background: linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(236, 253, 245, 0.4) 50%, rgba(254, 243, 199, 0.95) 100%) !important;
        border: 1.5px solid rgba(252, 211, 77, 0.85) !important;
        border-radius: 18px !important;
        padding: 14px 18px !important;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
      }

      .dua-header {
        display: block;
        font-size: 11.5px;
        font-weight: 900;
        color: #78350f;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .dua-body {
        font-size: 13px;
        font-weight: 600;
        color: #292524;
        line-height: 1.6;
      }

      .card-footer {
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        color: #78716c;
        margin-top: 14px;
        letter-spacing: 0.5px;
      }
    </style>
  `;
}

module.exports = {
  renderVafatCardHtml,
  resolveImageBase64
};
