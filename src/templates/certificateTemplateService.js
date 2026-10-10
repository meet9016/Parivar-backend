const fs = require('fs');
const path = require('path');
const certAssets = require('../assets/embeddedCertAssets');
let certData = {};
try {
  certData = require('../data/certificates.json');
} catch (_) {}

/**
 * Escape HTML to prevent XSS while preserving strings
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
 * Render 3D Gold Ribbon Banner SVG (Exact Vector Replica)
 */
function renderGoldRibbonBannerSvg(title, fontSize = 15, maxWidth = 515) {
  const cleanTitle = (title || '').replace(/^[❖•\s*]+|[❖•\s*]+$/g, '').trim();
  const gradId = Math.random().toString(36).substring(2, 7);
  return `
    <div style="width: 96%; max-width: ${maxWidth}px; margin: 4px auto 6px; position: relative; display: flex; align-items: center; justify-content: center;">
      <svg viewBox="0 0 540 56" style="width: 100%; height: auto; display: block; overflow: visible; filter: drop-shadow(0 4px 10px rgba(139,24,27,0.22)) drop-shadow(0 2px 4px rgba(0,0,0,0.12));">
        <defs>
          <linearGradient id="goldRibbonMainGrad_${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fffde6" />
            <stop offset="14%" stop-color="#fde68a" />
            <stop offset="44%" stop-color="#eab308" />
            <stop offset="78%" stop-color="#ca8a04" />
            <stop offset="94%" stop-color="#a16207" />
            <stop offset="100%" stop-color="#78350f" />
          </linearGradient>
          <linearGradient id="goldRibbonTailGrad_${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#b45309" />
            <stop offset="45%" stop-color="#eab308" />
            <stop offset="100%" stop-color="#92400e" />
          </linearGradient>
          <linearGradient id="goldRibbonTailRightGrad_${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#92400e" />
            <stop offset="55%" stop-color="#eab308" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
          <linearGradient id="goldRibbonBorderGrad_${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fef9c3" />
            <stop offset="50%" stop-color="#facc15" />
            <stop offset="100%" stop-color="#854d0e" />
          </linearGradient>
        </defs>
        <path d="M 52,10 L 10,10 L 28,28 L 10,46 L 52,46 Z" fill="url(#goldRibbonTailGrad_${gradId})" stroke="#78350f" stroke-width="1.2" />
        <polygon points="52,38 65,38 52,47" fill="#451a03" />
        <path d="M 488,10 L 530,10 L 512,28 L 530,46 L 488,46 Z" fill="url(#goldRibbonTailRightGrad_${gradId})" stroke="#78350f" stroke-width="1.2" />
        <polygon points="488,38 475,38 488,47" fill="#451a03" />
        <path d="M 52,6 C 48,6 45,9 45,13 L 45,39 C 45,43 48,46 52,46 L 488,46 C 492,46 495,43 495,39 L 495,13 C 495,9 492,6 488,6 Z" fill="url(#goldRibbonMainGrad_${gradId})" stroke="url(#goldRibbonBorderGrad_${gradId})" stroke-width="1.5" />
        <path d="M 54,9 L 486,9 C 489,9 491,11 491,14 L 491,38 C 491,41 489,43 486,43 L 54,43 C 51,43 49,41 49,38 L 49,14 C 49,11 51,9 54,9 Z" fill="none" stroke="#78350f" stroke-width="0.8" opacity="0.38" />
        <line x1="56" y1="10" x2="484" y2="10" stroke="#ffffff" stroke-width="1.3" opacity="0.9" />
        <line x1="56" y1="42" x2="484" y2="42" stroke="#5c2c06" stroke-width="0.8" opacity="0.35" />
        <text x="270" y="26" text-anchor="middle" dominant-baseline="central" fill="#451a03" font-size="${fontSize}" font-weight="900" font-family="'Anek Gujarati', 'Noto Sans Gujarati', sans-serif" letter-spacing="0.8">
          ❖ ${escapeHtml(cleanTitle)} ❖
        </text>
      </svg>
    </div>
  `;
}

/**
 * Render 4 Corner Filigrees
 */
function renderCornerFiligrees(size = 78) {
  const cornerSrc = certAssets.cornerWebpOrnament || certAssets.goldCornerOrnament;
  return `
    <img src="${cornerSrc}" style="position: absolute; width: ${size}px; height: ${size}px; top: 0; left: 0; z-index: 5; pointer-events: none; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));" alt="" />
    <img src="${cornerSrc}" style="position: absolute; width: ${size}px; height: ${size}px; top: 0; right: 0; transform: scaleX(-1); z-index: 5; pointer-events: none; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));" alt="" />
    <img src="${cornerSrc}" style="position: absolute; width: ${size}px; height: ${size}px; bottom: 0; left: 0; transform: scaleY(-1); z-index: 5; pointer-events: none; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));" alt="" />
    <img src="${cornerSrc}" style="position: absolute; width: ${size}px; height: ${size}px; bottom: 0; right: 0; transform: scale(-1, -1); z-index: 5; pointer-events: none; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));" alt="" />
  `;
}

/**
 * Render Section Badge Helper
 */
function renderSectionBadge(num, titleGuj) {
  return `
    <div style="background: linear-gradient(90deg, #fefce8 0%, #f8fafc 100%); color: #854d0e; border: 1px solid #fef08a; border-radius: 5px; padding: 2px 8px; font-size: 12.5px; font-weight: 900; display: flex; align-items: center; gap: 7px; margin-bottom: 5px; height: 26px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
      <span style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; border-radius: 4px; padding: 0 6px; font-size: 11px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; height: 18px; min-width: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">
        ${num}
      </span>
      <span style="display: inline-flex; align-items: center; letter-spacing: 0.3px;">${escapeHtml(titleGuj)}</span>
    </div>
  `;
}

/**
 * Render Underline Input Field Helper
 */
function renderUnderField(val, width = 'auto', flex = '1', textAlign = 'left') {
  return `
    <div style="${flex ? `flex: ${flex};` : ''} ${width !== 'auto' ? `width: ${width}; min-width: ${width};` : 'min-width: 50px;'} border-bottom: 1.2px solid #64748b; height: 21px; display: inline-flex; align-items: center; justify-content: ${textAlign === 'center' ? 'center' : 'flex-start'}; padding: 0 4px; box-sizing: border-box; vertical-align: middle;">
      <span style="font-size: 12.5px; font-weight: 700; color: #0f172a; width: 100%; height: 100%; display: inline-flex; align-items: center; justify-content: ${textAlign === 'center' ? 'center' : 'flex-start'}; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">${escapeHtml(val || '')}</span>
    </div>
  `;
}

/**
 * Render Marriage Certificate HTML (2 Pages) — 100% Authentic Royal Burgundy & Gold Design
 */
function renderMarriageCertificateHtml(data = {}) {
  const d = data || {};
  const m = certData.marriage || {};

  const dulhaImg = d.dulhaPhoto || '';
  const dulhanImg = d.dulhanPhoto || '';

  const dateYearStr = d.dateYear ? (d.dateYear.length === 2 ? `૨૦${d.dateYear}` : d.dateYear) : '૨૦૨૬';

  return `
    <div class="certificate-pdf-wrapper" style="display: flex; flex-direction: column; gap: 32px; align-items: center; width: 100%;">
      <!-- ══════════════════════════════════════════════════════════════
         PAGE 1 : નિકાહ નામા — પક્ષકારો અને મહેર વિગત (PREMIUM ROYAL UI)
      ══════════════════════════════════════════════════════════════ -->
      <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; background: #fffdfa; border: 3.5px solid #8b181b; border-radius: 6px; padding: 4px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 35px rgba(139, 24, 27, 0.18), inset 0 0 0 1.5px #b8860b; page-break-after: always; break-after: page;">
        <!-- Premium Inner Gold Border Frame -->
        <div style="border: 2px solid #b8860b; border-radius: 4px; flex: 1; display: flex; flex-direction: column; padding: 8px 12px 28px; position: relative; box-sizing: border-box; background: linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%);">
          ${renderCornerFiligrees(78)}

          <!-- MAIN CONTENT PAGE 1 -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 1px 2px;">
            <!-- TOP HEADER SECTION -->
            <div style="display: flex; flex-direction: column; align-items: center; textAlign: center; width: 100%; padding-top: 1px;">
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 50px; box-sizing: border-box;">
                <!-- Left Medallion Logo -->
                <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <img src="${certAssets.letterpadLogo}" style="width: 64px; height: 64px; object-fit: contain;" alt="Logo" />
                </div>

                <!-- Center Trust, Title & Address -->
                <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                  <div style="font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; font-size: 12px; font-weight: 800; color: #0d2366; line-height: 1.2;">
                    ${escapeHtml(m.trustLine || 'ટ્રસ્ટ રજી. નં. બી-૫૨૯ / મહેસાણા • તા. ૩૦-૦૯-૧૯૫૫')}
                  </div>
                  <div style="font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 22px; font-weight: 900; color: #8b181b; white-space: nowrap; letter-spacing: 0.8px; line-height: 1.2; margin-top: 2px; margin-bottom: 1px;">
                    રાધનપુર થરાદી મેમણ જમાઅત
                  </div>
                  <div style="font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; font-size: 11.5px; font-weight: 800; color: #111111; line-height: 1.2; white-space: nowrap;">
                    ${escapeHtml(m.address || 'ઠેકાણું: મેમન જમાતખાના, જુમ્મા મસ્જિદ પાસે, રાધનપુર')}
                  </div>
                </div>

                <!-- Right Medallion Logo -->
                <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <img src="${certAssets.letterpadLogo}" style="width: 64px; height: 64px; object-fit: contain;" alt="Logo" />
                </div>
              </div>

              <!-- 3D Gold Ribbon Banner -->
              ${renderGoldRibbonBannerSvg('નિકાહ નામા / MARRIAGE CERTIFICATE', 15, 515)}
            </div>

            <!-- Reg No, Date, Hijri & Venue Bar -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 5px 9px; font-size: 11.5px; display: flex; flex-direction: column; gap: 3.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <strong style="color: #0d2366; display: flex; align-items: center; font-weight: 800;">નિકાહ રજીસ્ટ્રેશન નં.:</strong>
                  ${renderUnderField(d.number || '', '110px', null)}
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                  <strong style="color: #0d2366; display: inline-flex; align-items: center; height: 21px; font-size: 11.5px; font-weight: 800;">તારીખ (ઈ.સ.):</strong>
                  <div style="width: 22px; border-bottom: 1.2px solid #64748b; height: 21px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(d.dateDay || '')}</div>
                  <span style="font-weight: 800; font-size: 12px; color: #64748b;">/</span>
                  <div style="width: 22px; border-bottom: 1.2px solid #64748b; height: 21px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(d.dateMonth || '')}</div>
                  <span style="font-weight: 800; font-size: 12px; color: #64748b;">/</span>
                  <div style="width: 36px; border-bottom: 1.2px solid #64748b; height: 21px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(dateYearStr)}</div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <strong style="color: #0d2366; display: flex; align-items: center; font-weight: 800;">જમાઅત રજીસ્ટર પાના નં.:</strong>
                  ${renderUnderField(d.regNumber || '', '90px', null)}
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                  <strong style="color: #0d2366; display: flex; align-items: center; font-weight: 800;">હિજરી સન:</strong>
                  ${renderUnderField(d.hijriYear || '', '75px', null)}
                  <strong style="color: #0d2366; margin-left: 4px; display: flex; align-items: center; font-weight: 800;">માહ:</strong>
                  ${renderUnderField(d.hijriMonth || '', '90px', null)}
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 5px;">
                <strong style="color: #0d2366; flex-shrink: 0; display: flex; align-items: center; font-weight: 800;">નિકાહનું સ્થળ (સરનામું):</strong>
                ${renderUnderField(d.nikahVenue || '', 'auto', '1')}
              </div>
            </div>

            <!-- 1. Groom (દુલ્હા) Section with Photo -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 5px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૧', 'દુલ્હા  ની વિગત :')}
              <div style="display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: 11.5px;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• પૂરું નામ :</span>
                    ${renderUnderField(d.dulhaName || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• પિતા/વાલી :</span>
                    ${renderUnderField(d.dulhaFatherName || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-weight: 800; color: #1e293b;">• જન્મ તારીખ:</span>
                    ${renderUnderField(d.dulhaDob || '', '85px', null, 'center')}
                    <span style="font-weight: 800; color: #1e293b;">ઉંમર:</span>
                    ${renderUnderField(d.dulhaAge || '', '35px', null, 'center')} <span style="font-weight: 700;">વર્ષ</span>
                    <span style="font-weight: 800; color: #1e293b; margin-left: 4px;">મો.:</span>
                    ${renderUnderField(d.dulhaMobile || '', '105px', null)}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• આધાર કાર્ડ નં.:</span>
                    ${renderUnderField(d.dulhaAadhaar || '', '130px', null)}
                    <span style="font-weight: 800; color: #1e293b; margin-left: 4px; flex-shrink: 0;">વતન:</span>
                    ${renderUnderField(d.dulhaVatan || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• સરનામું :</span>
                    ${renderUnderField(d.dulhaAddress || '', 'auto', '1')}
                  </div>
                </div>

                <!-- Groom Photo Box -->
                <div style="width: 76px; height: 94px; border: 1.5px dashed #d97706; border-radius: 4px; background: #fffdf5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; text-align: center;">
                  ${dulhaImg ? `<img src="${dulhaImg}" alt="Groom" style="width: 100%; height: 100%; object-fit: contain; background: #fff;" />` : '<div style="font-size: 9.5px; font-weight: 800; color: #b45309; line-height: 1.2;">દુલ્હાનો ફોટો<br />(પાસપોર્ટ)</div>'}
                </div>
              </div>
            </div>

            <!-- 2. Bride (દુલ્હન) Section with Photo -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 5px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૨', 'દુલ્હન  ની વિગત :')}
              <div style="display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: 11.5px;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• પૂરું નામ :</span>
                    ${renderUnderField(d.dulhanFullName || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• પિતા/વાલી :</span>
                    ${renderUnderField(d.dulhanFatherName || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-weight: 800; color: #1e293b;">• જન્મ તારીખ:</span>
                    ${renderUnderField(d.dulhanDob || '', '85px', null, 'center')}
                    <span style="font-weight: 800; color: #1e293b;">ઉંમર:</span>
                    ${renderUnderField(d.dulhanAge || '', '35px', null, 'center')} <span style="font-weight: 700;">વર્ષ</span>
                    <span style="font-weight: 800; color: #1e293b; margin-left: 4px;">મો.:</span>
                    ${renderUnderField(d.dulhanMobile || '', '105px', null)}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• આધાર કાર્ડ નં.:</span>
                    ${renderUnderField(d.dulhanAadhaar || '', '130px', null)}
                    <span style="font-weight: 800; color: #1e293b; margin-left: 4px; flex-shrink: 0;">વતન:</span>
                    ${renderUnderField(d.dulhanVatan || '', 'auto', '1')}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #1e293b; width: 95px; flex-shrink: 0;">• સરનામું :</span>
                    ${renderUnderField(d.dulhanAddress || '', 'auto', '1')}
                  </div>
                </div>

                <!-- Bride Photo Box -->
                <div style="width: 76px; height: 94px; border: 1.5px dashed #d97706; border-radius: 4px; background: #fffdf5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; text-align: center;">
                  ${dulhanImg ? `<img src="${dulhanImg}" alt="Bride" style="width: 100%; height: 100%; object-fit: contain; background: #fff;" />` : '<div style="font-size: 9.5px; font-weight: 800; color: #b45309; line-height: 1.2;">દુલ્હનનો ફોટો<br />(પાસપોર્ટ)</div>'}
                </div>
              </div>
            </div>

            <!-- 3. Vakil / Vali Details -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 5px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૩', 'વકીલ / વાલીની વિગત :')}
              <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; margin-top: 1px;">
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                  <strong style="color: #854d0e; font-weight: 800;">દુલ્હનના વકીલ:</strong>
                  ${renderUnderField(d.dulhanVakilName || '', 'auto', '1')}
                  <span>પિતા:</span>
                  ${renderUnderField(d.dulhanVakilFather || '', 'auto', '1')}
                  <span>ગામ:</span>
                  ${renderUnderField(d.dulhanVakilVillage || '', '80px', null)}
                  <span>મો.:</span>
                  ${renderUnderField(d.dulhanVakilMo || '', '85px', null)}
                </div>
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                  <strong style="color: #854d0e; font-weight: 800;">દુલ્હાના વાલી/વકીલ:</strong>
                  ${renderUnderField(d.dulhaValiName || '', 'auto', '1')}
                  <span>પિતા:</span>
                  ${renderUnderField(d.dulhaValiFather || '', 'auto', '1')}
                  <span>ગામ:</span>
                  ${renderUnderField(d.dulhaValiVillage || '', '80px', null)}
                  <span>મો.:</span>
                  ${renderUnderField(d.dulhaValiMo || '', '85px', null)}
                </div>
              </div>
            </div>

            <!-- 4. Meher Details -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 5px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૪', 'મહેર (MEHER) ની વિગત :')}
              <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; margin-top: 1px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <strong style="color: #854d0e; flex-shrink: 0; font-weight: 800;">• મહેરની રકમ:</strong>
                  <span>અંકે રૂ.</span>
                  ${renderUnderField(d.maherRakam || '', '110px', null)}
                  <span>(શબ્દોમાં:</span>
                  ${renderUnderField(d.maherRakamWords || '', 'auto', '1')}
                  <span>)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                  <strong style="color: #854d0e; flex-shrink: 0; font-weight: 800;">• સોના/ચાંદીના દાગીના:</strong>
                  ${renderUnderField(d.maherGoldDetails || '', 'auto', '1')}
                  <span>વજન:</span>
                  ${renderUnderField(d.maherGram || '', '70px', null)}
                  <span>ગ્રામ</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 1px;">
                  <strong style="color: #854d0e; font-weight: 800;">• ચૂકવણીનો પ્રકાર:</strong>
                  <span style="font-weight: 800; color: #854d0e; background: #fef08a; padding: 1px 8px; border-radius: 4px; border: 1px solid #fde047;">
                    ${escapeHtml(d.maherType || 'મોઅજ્જલ (નકદ / રોકડ - સ્થળ પર જ ચૂકવી આપેલ છે)')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Page 1 Bottom Indicator -->
            <div style="text-align: center; font-size: 10.5px; color: #166534; font-weight: 800; font-style: italic; margin: 4px 0 0;">
              [ પૃષ્ઠ ૧ / ૨ &bull; પાછળ સાક્ષીઓ, કાનૂની શરતો અને સહીઓ જુઓ ]
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════
         PAGE 2 : સાક્ષીઓ, કાઝી, કાનૂની ઘોષણા, સમાજ શિસ્ત અને સહીઓ
      ══════════════════════════════════════════════════════════════ -->
      <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; background: #fffdfa; border: 3.5px solid #8b181b; border-radius: 6px; padding: 4px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 35px rgba(139, 24, 27, 0.18), inset 0 0 0 1.5px #b8860b; page-break-after: avoid; break-after: avoid;">
        <!-- Premium Inner Gold Border Frame -->
        <div style="border: 2px solid #b8860b; border-radius: 4px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 72px 14px 24px; position: relative; box-sizing: border-box; background: linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%);">
          ${renderCornerFiligrees(78)}

          <!-- MAIN CONTENT PAGE 2 -->
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; padding: 1px 2px;">
            <!-- Page 2 Header Badge -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%); border: 1.2px solid #fde68a; color: #0f172a; padding: 6px 16px; margin: 0 0 4px; border-radius: 6px; font-size: 11.5px; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="color: #0d2366;">નિકાહ રજીસ્ટ્રેશન નં.: <span style="color: #8b181b;">${escapeHtml(d.number || '........')}</span></div>
              <div style="color: #b45309; font-weight: 900; font-size: 12px;">પૃષ્ઠ ૨ : સાક્ષીઓ, નિકાહના અને સહીઓ</div>
              <div style="color: #0d2366;">તા.: ${escapeHtml(d.dateDay || 'DD')}/${escapeHtml(d.dateMonth || 'MM')}/${escapeHtml(dateYearStr)}</div>
            </div>

            <!-- 5. Witnesses (સાક્ષીઓ) Section -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 6px 9px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૫', 'સાક્ષીઓ (ગવાહ) ની વિગત :')}
              <div style="display: flex; flex-direction: column; gap: 4.5px; font-size: 11.5px; margin-top: 3px;">
                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                  <strong style="color: #854d0e; font-weight: 800;">(૧) સાક્ષી નં. ૧:</strong>
                  <span>નામ:</span>
                  ${renderUnderField(d.sakshi1Name || '', 'auto', '1')}
                  <span>પિતા:</span>
                  ${renderUnderField(d.sakshi1Father || '', 'auto', '1')}
                  <span>ગામ:</span>
                  ${renderUnderField(d.sakshi1Village || '', '80px', null)}
                  <span>આધાર:</span>
                  ${renderUnderField(d.sakshi1Aadhaar || '', '90px', null)}
                  <span>મો.:</span>
                  ${renderUnderField(d.sakshi1Mo || '', '85px', null)}
                </div>
                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                  <strong style="color: #854d0e; font-weight: 800;">(૨) સાક્ષી નં. ૨:</strong>
                  <span>નામ:</span>
                  ${renderUnderField(d.sakshi2Name || '', 'auto', '1')}
                  <span>પિતા:</span>
                  ${renderUnderField(d.sakshi2Father || '', 'auto', '1')}
                  <span>ગામ:</span>
                  ${renderUnderField(d.sakshi2Village || '', '80px', null)}
                  <span>આધાર:</span>
                  ${renderUnderField(d.sakshi2Aadhaar || '', '90px', null)}
                  <span>મો.:</span>
                  ${renderUnderField(d.sakshi2Mo || '', '85px', null)}
                </div>
              </div>
            </div>

            <!-- 6. Kazi Saheb Details -->
            <div style="background: #ffffff; border: 1.2px solid #fde047; border-radius: 5px; padding: 6px 9px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              ${renderSectionBadge('૬', 'નિકાહ પઢાવનાર કાઝી સાહેબની વિગત :')}
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; margin-top: 3px;">
                <strong style="color: #854d0e; flex-shrink: 0; font-weight: 800;">• કાઝી સાહેબનું નામ:</strong>
                ${renderUnderField(d.kaziName || '', 'auto', '1')}
                <strong style="color: #854d0e; flex-shrink: 0; margin-left: 8px; font-weight: 800;">• સરનામું / મો. નં.:</strong>
                ${renderUnderField(d.kaziContact || '', 'auto', '1')}
              </div>
            </div>

            <!-- 7. Legal Declarations, Jamaat Constitution & Discipline Clauses -->
            <div style="background: #ffffff; border: 1.5px solid #16a34a; border-radius: 5px; padding: 5px 8px; font-size: 9.8px; line-height: 14px; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="color: #8b181b; font-weight: 900; font-size: 11.5px; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px; letter-spacing: 0.3px;">
                ૭. સમાજનું બંધારણ અને શિસ્ત અંગેની શરતો
              </div>
              <div style="display: flex; flex-direction: column; gap: 2.5px;">
                <div>
                  <strong style="color: #166534; font-weight: 800;">૧. સ્વતંત્ર સંમતિ (Consent):</strong> દુલ્હા તથા દુલ્હને સંપૂર્ણ શુદ્ધિબુદ્ધિમાં, કોઈપણ પ્રકારના ડર, દબાણ, ધાકધમકી કે પ્રલોભન વગર, પોતાની મુક્ત અને રાજીખુશીથી શરીઅતે મુહમ્મદી મુજબ શરઈ સાક્ષીઓની હાજરીમાં ઇજાબ-ઓ-કુબૂલ (કબૂલાત) કરેલ છે.
                </div>
                <div>
                  <strong style="color: #166534; font-weight: 800;">૨. કાયદેસર પુખ્તતા:</strong> બંને પક્ષકારો ભારત સરકારના પ્રવર્તમાન લગ્ન કાયદા મુજબ લગ્નની કાયદેસર ઉંમર ધરાવે છે અને દર્શાવેલ વિગતો તથા ઓળખના પુરાવા સંપૂર્ણ સાચા છે.
                </div>
                <div>
                  <strong style="color: #166534; font-weight: 800;">૩. જમાઅતના બંધારણનું પાલન:</strong> બંને પક્ષકારો તથા તેમના વાલીઓ 'UTMC જમાઅત' ના પ્રવર્તમાન બંધારણ, નીતિ-નિયમો, સામાજિક રિવાજો અને શિસ્તબદ્ધ નિર્ણયોનું ચુસ્તપણે પાલન કરવા સહમત થાય છે.
                </div>
                <div>
                  <strong style="color: #166534; font-weight: 800;">૪. વિવાદ નિવારણ અને સમાધાન:</strong> દાંપત્ય જીવન દરમ્યાન જો કોઈ ગેરસમજ કે પારિવારિક મતભેદ ઉપસ્થિત થાય, તો કોઈપણ પક્ષકાર સીધા પોલીસ સ્ટેશન કે કોર્ટ-કચેરીના પગલાં ભરશે નહીં. સૌપ્રથમ સ્થાનિક જમાઅત ની કારોબારી સમિતિ સમક્ષ લેખિત રજૂઆત કરી આપસી સુખદ સમાધાન મેળવવા બંધાયેલા રહેશે.
                </div>
                <div>
                  <strong style="color: #166534; font-weight: 800;">૫. સત્તાવાર દસ્તાવેજ:</strong> આ પ્રમાણપત્ર મુસ્લિમ પર્સનલ લો (શરીઅત) તથા 'ધ ગુજરાત રજીસ્ટ્રેશન ઓફ મેરેજીસ એક્ટ' અન્વયે જમાઅતના અધિકૃત દસ્તાવેજ તરીકે માન્ય રહેશે.
                </div>
              </div>
            </div>

            <!-- 8. Signatures Block -->
            <div style="background: #ffffff; border: 1.2px solid #cbd5e1; border-radius: 5px; padding: 7px 10px; margin-top: 1px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="color: #8b181b; font-weight: 900; font-size: 11.5px; text-align: center; margin-bottom: 8px; letter-spacing: 0.5px;">
                ૮. સહીઓ અને પ્રમાણીકરણ
              </div>

              <!-- Row 1: Groom, Bride, Vakil -->
              <div style="display: flex; justify-content: space-between; text-align: center; font-size: 11px; margin-bottom: 12px;">
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #0d2366;">દુલ્હાની સહી</strong>
                </div>
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #8b181b;">દુલ્હનની સહી</strong>
                </div>
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #0d2366;">દુલ્હનના વકીલની સહી</strong>
                </div>
              </div>

              <!-- Row 2: Witness 1, Witness 2, Kazi -->
              <div style="display: flex; justify-content: space-between; text-align: center; font-size: 11px; margin-bottom: 10px;">
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #1e293b;">સાક્ષી (૧) ની સહી</strong>
                </div>
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #1e293b;">સાક્ષી (૨) ની સહી</strong>
                </div>
                <div style="width: 30%;">
                  <div style="border-bottom: 1.2px dashed #64748b; height: 22px; margin-bottom: 3px;"></div>
                  <strong style="color: #0d2366;">કાઝી સાહેબની સહી</strong>
                </div>
              </div>

              <!-- Row 3: Jamaat Seal + Pramukh + Secretary -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 5px; border-top: 1px solid #e2e8f0;">
                <div style="text-align: center; width: 35%;">
                  <div style="border-bottom: 1.2px solid #8b181b; height: 18px; margin-bottom: 3px;"></div>
                  <strong style="color: #8b181b; font-size: 11.5px;">પ્રમુખશ્રી</strong>
                  <div style="font-size: 9.5px; color: #475569; font-weight: 700;">રાધનપુર મેમણ જમાત</div>
                </div>

                <!-- Jamaat Stamp Box -->
                <div style="width: 58px; height: 58px; border: 1.5px dashed #b8860b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: #8b181b; text-align: center; line-height: 1.2; background: rgba(184, 134, 11, 0.05); box-shadow: 0 1px 3px rgba(184, 134, 11, 0.15);">
                  જમાતની<br />સત્તાવાર મોહર<br />(Seal)
                </div>

                <div style="text-align: center; width: 35%;">
                  <div style="border-bottom: 1.2px solid #8b181b; height: 18px; margin-bottom: 3px;"></div>
                  <strong style="color: #8b181b; font-size: 11.5px;">સેક્રેટરી</strong>
                  <div style="font-size: 9.5px; color: #475569; font-weight: 700;">રાધનપુર મેમણ જમાત</div>
                </div>
              </div>
            </div>

            <div style="text-align: center; font-size: 9.5px; color: #8b181b; font-weight: 800; margin-top: 1px;">
              પૃષ્ઠ ૨ / ૨ • રાધનપુર મેમણ જમાત — નિકાહ નામા / MARRIAGE CERTIFICATE
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Paginator helper for Official Letterhead
 */
function paginateParagraphs(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return [''];
  }
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const MAX_PAGE_CHARS = 1050;
  const pages = [];
  let currentPage = [];
  let currentCount = 0;

  for (const line of lines) {
    const lineLen = line.length + 35;
    if (currentCount + lineLen > MAX_PAGE_CHARS && currentPage.length > 0) {
      pages.push(currentPage.join('\n'));
      currentPage = [line];
      currentCount = lineLen;
    } else {
      currentPage.push(line);
      currentCount += lineLen;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join('\n'));
  }
  return pages.length > 0 ? pages : [''];
}

/**
 * Render Official Letterhead HTML (Multi-page Dynamic Splitting) — 100% Authentic Royal Design
 */
function renderLetterheadHtml(data = {}) {
  const d = data || {};
  const l = certData.letterhead || {};

  const pagesData = paginateParagraphs(d.body || '');
  const totalPages = pagesData.length;

  return `
    <div class="certificate-pdf-wrapper" style="display: flex; flex-direction: column; gap: 28px; align-items: center; width: 100%;">
      ${pagesData.map((pageText, pageIdx) => {
        const isLastPage = pageIdx === totalPages - 1;

        return `
          <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Noto Sans', Arial, sans-serif; font-size: 12px; background: #fffdfa; border: 3.5px solid #8b181b; border-radius: 6px; padding: 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: 0 10px 35px rgba(139, 24, 27, 0.18), inset 0 0 0 1.5px #b8860b; ${isLastPage ? 'page-break-after: avoid; break-after: avoid;' : 'page-break-after: always; break-after: page;'}">
            <!-- Inner Border Frame -->
            <div style="border: 2px solid #b8860b; border-radius: 4px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; background: linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%); overflow: hidden;">
              ${renderCornerFiligrees(78)}

              <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                <!-- Header Component -->
                <div style="width: 100%; margin-bottom: ${pageIdx === 0 ? '14px' : '10px'};">
                  ${pageIdx === 0 ? `
                    <!-- Top Letterhead Header -->
                    <div style="margin: 16px 62px 4px; box-sizing: border-box; position: relative; background: transparent; padding: 2px 6px; display: flex; flex-direction: column;">
                      <!-- Row 1: Trust Reg No + Email & Website -->
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 0 4px; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">
                        <div style="color: #b91c1c; fontSize: 9.5px; font-weight: 800; line-height: 1.2;">
                          ${escapeHtml(l.trustLine || 'ટ્રસ્ટ રજી નં. બી ૧૨૯-મહેસાણા તા.૩૦-૯-૧૯૫૫')}
                        </div>
                        <div style="text-align: right; font-size: 9px; font-weight: 800; line-height: 1.25; color: #1e293b;">
                          <div>
                            <span style="color: #b91c1c;">ઈ-મેઇલ: </span>
                            <span>${escapeHtml(l.email || 'info.radhanpurmemonjamat@gmail.com')}</span>
                          </div>
                          <div>
                            <span style="color: #b91c1c;">વેબસાઇટ: </span>
                            <span>${escapeHtml(l.website || 'https://memon.parivar.me/')}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Row 2: Logos + Community Title -->
                      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 3px; margin-bottom: 3px; padding: 0 2px;">
                        <div style="width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <img src="${certAssets.letterpadLogo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
                        </div>
                        <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 6px;">
                          <div style="font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 25px; font-weight: 900; color: #0d2366; letter-spacing: 0.8px; line-height: 1.15; white-space: nowrap;">
                            ${escapeHtml(l.communityName || 'રાધનપુર મેમણ જમાત')}
                          </div>
                          <div style="height: 2.5px; background: #0d2366; width: 92%; margin-top: 3px; border-radius: 1px;"></div>
                        </div>
                        <div style="width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <img src="${certAssets.letterpadLogo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
                        </div>
                      </div>

                      <!-- Row 3: Office Address & Contact -->
                      <div style="margin-top: 2px; text-align: center; font-size: 9.5px; font-weight: 800; color: #b91c1c; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; line-height: 1.2; white-space: nowrap;">
                        ${escapeHtml(l.addressLine || 'કાર્યાલય: મેમણ જમાતખાના, મુ. રાધનપુર, જિ. પાટણ, પીન - ૩૮૫૩૪૦ (ઉ.ગુ.)')} | <span>સંપર્ક: ${escapeHtml(l.contactLine || '+૯૧ ૯૯૯૮૦ ૧૬૫૬૬ | +૯૧ ૮૪૯૦૦ ૯૫૨૪૦')}</span>
                      </div>
                    </div>
                  ` : ''}

                  <!-- Ref No & Date Row -->
                  <div style="display: flex; justify-content: space-between; padding: ${pageIdx === 0 ? '6px 62px 2px' : '26px 64px 6px'}; align-items: center; background: transparent; font-size: 11.5px; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; margin-top: ${pageIdx > 0 ? '4px' : '2px'};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <strong style="color: #0d2366; font-weight: 800;">જાવક ક્રમાંક (Ref. No.):</strong>
                      <span style="font-weight: 800; color: #111;">
                        ${d.refNumber ? (d.refNumber.startsWith('RMJ') ? escapeHtml(d.refNumber) : `RMJ / ${escapeHtml(d.refNumber)}`) : 'RMJ / _________'}
                      </span>
                      ${totalPages > 1 ? `
                        <span style="margin-left: 6px; font-size: 10px; font-weight: 800; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 4px; border: 1px solid #fde68a;">
                          (પૃષ્ઠ ${toGujaratiDigits(pageIdx + 1)} / ${toGujaratiDigits(totalPages)})
                        </span>
                      ` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <strong style="color: #0d2366; font-weight: 800;">તારીખ (Date):</strong>
                      <span style="font-weight: 800; color: #111;">${escapeHtml(d.date || '')}</span>
                    </div>
                  </div>

                  <!-- Royal Divider Line -->
                  <div style="margin: ${pageIdx === 0 ? '5px 58px 8px' : '4px 60px 8px'}; display: flex; flex-direction: column; gap: 1.5px;">
                    <div style="height: 2px; background: linear-gradient(90deg, #b8860b 0%, #8b181b 15%, #8b181b 85%, #b8860b 100%); border-radius: 1.5px;"></div>
                    <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #b8860b 12%, #d97706 50%, #b8860b 88%, transparent 100%); opacity: 0.9;"></div>
                  </div>
                </div>

                <!-- Body Writing Area -->
                <div style="position: relative; padding: ${pageIdx === 0 ? '6px 36px 6px' : '10px 36px 6px'}; flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                  <div style="width: 100%; height: 100%; font-family: 'Noto Sans Gujarati', 'Noto Sans', Arial, sans-serif; font-size: 13.5px; font-weight: 600; line-height: 31px; color: #0f172a; padding: 2px 4px; box-sizing: border-box; white-space: pre-wrap; text-align: justify; word-break: break-word; overflow-wrap: break-word; overflow: hidden;">
                    ${escapeHtml(pageText)}
                  </div>
                </div>
              </div>

              <!-- Footer on Last Page OR Forward Note -->
              ${isLastPage ? `
                <div style="page-break-inside: avoid; break-inside: avoid; width: 100%; margin-bottom: 12px;">
                  <!-- Signatures Row -->
                  <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 2px 44px 2px; border-top: 1px solid #e2e8f0; margin-top: 2px;">
                    <div style="text-align: center; min-width: 120px;">
                      <div style="border-top: 1.2px solid #8b181b; padding-top: 2px; margin-bottom: 2px; margin-top: 10px;"></div>
                      <div style="font-weight: 900; font-size: 11.5px; color: #8b181b; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">પ્રમુખશ્રી</div>
                      <div style="font-size: 10px; color: #333; font-weight: 700; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">રાધનપુર મેમણ જમાત</div>
                    </div>
                    <div style="width: 48px; height: 48px; border: 1.5px dashed #b8860b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 900; color: #8b181b; text-align: center; line-height: 1.2; background: rgba(184, 134, 11, 0.04); font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">
                      સહી સિક્કો<br />(Seal)
                    </div>
                    <div style="text-align: center; min-width: 120px;">
                      <div style="border-top: 1.2px solid #8b181b; padding-top: 2px; margin-bottom: 2px; margin-top: 10px;"></div>
                      <div style="font-weight: 900; font-size: 11.5px; color: #8b181b; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">સેક્રેટરીશ્રી</div>
                      <div style="font-size: 10px; color: #333; font-weight: 700; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">રાધનપુર મેમણ જમાત</div>
                    </div>
                  </div>

                  <!-- Footer Terms -->
                  <div style="background: #fffdf8; border: 1px solid #fde68a; border-radius: 3px; margin: 2px 54px 2px; padding: 3px 10px 3px; font-size: 8.5px; color: #333; line-height: 1.3; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif;">
                    <div style="font-weight: 900; font-size: 9.5px; color: #8b181b; margin-bottom: 1px; text-align: center;">
                      પત્ર સંબંધી નિયમો અને સામાજિક શરતો (Terms &amp; Conditions)
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1px;">
                      <div><strong style="color: #0d2366;">૧. અધિકૃતતા:</strong> જમાતના હોદ્દેદારો (પ્રમુખ/સેક્રેટરી) અને સત્તાવાર સહી-સિક્કા વિના આ પત્ર માન્ય ગણાશે નહીં.</div>
                      <div><strong style="color: #0d2366;">૨. બંધારણ:</strong> આ પત્ર રાધનપુર મેમણ જમાતના બંધારણ, શિસ્ત અને Bye-laws ને આધીન છે. સામાજિક નિર્ણયો સર્વ સભ્યો માટે બંધનકર્તા રહેશે.</div>
                      <div><strong style="color: #0d2366;">૩. ન્યાયક્ષેત્ર:</strong> ભવિષ્યના કોઈ વિવાદ માટે અધિકારક્ષેત્ર ફક્ત રાધનપુર મેમણ જમાત, રાધનપુર પૂરતું રહેશે.</div>
                      <div><strong style="color: #0d2366;">૪. દુરુપયોગ પ્રતિબંધ:</strong> આ પત્ર અધિકૃત ઉદ્દેશ સિવાય અન્યત્ર ઉપયોગ કે ચેડાં કરવા સખ્ત પ્રતિબંધિત છે.</div>
                    </div>
                  </div>
                </div>
              ` : `
                <div style="padding: 6px 20px; text-align: center; font-size: 11px; font-weight: 800; color: #15803d; border-top: 1px dashed #cbd5e1; font-style: italic;">
                  [ પૃષ્ઠ ${toGujaratiDigits(pageIdx + 1)} / ${toGujaratiDigits(totalPages)} &bull; આગળનું લખાણ ${pageIdx + 2 === totalPages ? 'તથા સહી-સિક્કો પાછળના પૃષ્ઠ' : 'આગળના પૃષ્ઠ'} ${toGujaratiDigits(pageIdx + 2)} પર જુઓ &rarr; ]
                </div>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render NOC Certificate HTML (2 Pages) — 100% Authentic Royal Burgundy & Gold Design
 */
function renderNocHtml(data = {}) {
  const d = data || {};
  const n = certData.noc || {};

  const dateYearStr = d.dateYear ? (d.dateYear.length === 2 ? `૨૦${d.dateYear}` : d.dateYear) : '૨૦૨૬';

  return `
    <div class="certificate-pdf-wrapper" style="display: flex; flex-direction: column; gap: 32px; align-items: center; width: 100%;">
      <!-- ══════════════════════════════════════════════════════════════
         PAGE 1 : મુખ્ય વિગત અને નિકાહ કાર્યક્રમ (ROYAL THEME REPLICA)
      ══════════════════════════════════════════════════════════════ -->
      <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; background: #fffdf9; border: 3.5px solid #8b181b; border-radius: 4px; padding: 4px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; box-shadow: 0 8px 30px rgba(139,24,27,0.18), inset 0 0 0 2px #d4af37; page-break-after: always; break-after: page;">
        <!-- Double Gold & Royal Maroon Inner Frame -->
        <div style="border: 2px solid #b8860b; border-radius: 2px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 7px 11px 5px; position: relative; box-sizing: border-box; background: linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%);">
          ${renderCornerFiligrees(78)}

          <!-- TOP HEADER SECTION -->
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; padding-top: 1px;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 52px; box-sizing: border-box;">
              <!-- Left Medallion Logo -->
              <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <img src="${certAssets.letterpadLogo}" style="width: 64px; height: 64px; object-fit: contain;" alt="Logo" />
              </div>

              <!-- Center Quotes & Community Title -->
              <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                <div style="color: #8b181b; font-weight: 900; font-size: 11.5px; line-height: 1.15;">
                  ${escapeHtml(n.quoteLine || '“વિના સહકાર નહિ ઉધ્ધાર”')}
                </div>
                <div style="font-size: 9.5px; font-weight: 800; color: #0d2366; margin-top: 1px; line-height: 1.15;">
                  ${escapeHtml(n.trustLine || 'રાધનપુર મેમન જમાત, ટ્રસ્ટ રજી. નં. બી-૫૨૯-મહેસાણા તા. ૩૦-૯-૧૯૫૫')}
                </div>
                <div style="font-size: 9px; color: #8b0000; font-weight: 800; margin-top: 1px; line-height: 1.15;">
                  ${escapeHtml(n.ayatLine1 || 'જમાઅતોના (જોડ સંગઠન) ઉપર અલ્લાહનો હાથ હોય છે. - કુર્આન શરીફ')}
                </div>
                <div style="font-size: 8.5px; color: #4a154b; font-weight: 700; margin-top: 1px; line-height: 1.15;">
                  ${escapeHtml(n.ayatLine2 || 'માનવ માત્ર સમાજનો કરજદાર છે અન્યને ઉપયોગી થવું તે માનવ જીવનનું સર્વોત્તમ કાર્ય છે.')}
                </div>
                <div style="font-family: 'Anek Gujarati', 'Noto Sans Gujarati', sans-serif; font-size: 22px; font-weight: 900; color: #8b181b; white-space: nowrap; line-height: 1.2; margin-top: 2px; margin-bottom: 1px; letter-spacing: 0.8px;">
                  ${escapeHtml(n.communityName || 'રાધનપુર થરાદી મેમણ જમાઅત')}
                </div>
              </div>

              <!-- Right Medallion Logo -->
              <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <img src="${certAssets.letterpadLogo}" style="width: 64px; height: 64px; object-fit: contain;" alt="Logo" />
              </div>
            </div>

            <!-- Slogan & Address Lines -->
            <div style="text-align: center; font-size: 11px; font-weight: 800; color: #111111; margin-top: 2px; line-height: 1.2;">
              ${escapeHtml(n.slogan || 'સફળતા સંગઠનમાં છુપાયેલી છે. એક બનો, નેક બનો.')}
            </div>
            <div style="text-align: center; color: #8b181b; font-size: 10.5px; font-weight: 800; margin-top: 1px; margin-bottom: 2px; letter-spacing: 0.3px; white-space: nowrap;">
              ${escapeHtml(n.address || 'ઠે. મેમન જમાતખાના, જુમ્મા મસ્જીદ પાસે, મુ. રાધનપુર. જી. પાટણ પીન-૩૮૫૩૪૦ (ઉ.ગુ.)')}
            </div>
          </div>

          <!-- NUMBER & DATE BAR -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 8px; background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 5px; font-size: 12px; font-weight: 800; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-weight: 900; color: #0d2366; font-size: 12.5px;">નંબર :</span>
              ${renderUnderField(d.number || '', '120px', null)}
            </div>
            <div style="display: flex; align-items: center; gap: 2px;">
              <span style="font-weight: 900; color: #0d2366; font-size: 12.5px;">તારીખ :</span>
              <div style="width: 22px; border-bottom: 1.2px solid #64748b; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(d.dateDay || '')}</div>
              <span style="font-weight: 800; font-size: 12px; color: #64748b;">/</span>
              <div style="width: 22px; border-bottom: 1.2px solid #64748b; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(d.dateMonth || '')}</div>
              <span style="font-weight: 800; font-size: 12px; color: #64748b;">/</span>
              <div style="width: 36px; border-bottom: 1.2px solid #64748b; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${escapeHtml(dateYearStr)}</div>
            </div>
          </div>

          <!-- 3D GOLD RIBBON BANNER -->
          <div style="width: 100%; display: flex; justify-content: center; margin: 4px 0 6px;">
            ${renderGoldRibbonBannerSvg('ના-વાંધા પ્રમાણપત્ર (N.O.C.)', 17, 495)}
          </div>

          <!-- BODY CONTENT -->
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 3px 4px 4px;">
            <!-- FIRST PARTY DETAILS -->
            <div style="font-size: 12.5px; font-weight: 700; color: #111; display: flex; flex-direction: column; gap: 6px;">
              <div style="color: #8b181b; font-weight: 900; font-size: 13.5px;">
                ${escapeHtml(n.salutation || 'મોહતરમ જનાબ,')}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; min-height: 24px;">
                <div style="color: #8b181b; font-weight: 900; padding-left: 24px; font-size: 12.5px;">
                  ${escapeHtml(n.pramukhLineLabel || 'પ્રમુખ સાહેબ / સેક્રેટરી સાહેબ,')}
                </div>
                <div style="display: flex; align-items: center;">
                  <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; margin-right: 4px;">
                    ${escapeHtml(n.localJamatLabel || 'સ્થાનિક મેમન જમાઅત')}
                  </span>
                  ${renderUnderField(d.localJamat || '', '140px', null)}
                </div>
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.muqamLabel || 'મુકામ :')}</span>
                ${renderUnderField(d.muqam || '', '170px', null)}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 6px;">${escapeHtml(n.talukaLabel || 'તાલુકો :')}</span>
                ${renderUnderField(d.taluka || '', '140px', null)}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 6px;">${escapeHtml(n.jilaLabel || 'જિલ્લો :')}</span>
                ${renderUnderField(d.jila || '', 'auto', '1')}
              </div>

              <div style="color: #8b181b; font-weight: 900; font-size: 12.5px;">
                ${escapeHtml(n.assalam || 'અસ્સલામુ અલયકુમ વ.વ..')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.salamText || 'સલામ બાદ જણાવવાનું કે અમારી જમાઅતના સભ્ય (આસામી) જનાબ')}</span>
                ${renderUnderField(d.memberName || '', 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 4px;">${escapeHtml(n.haale || 'હાલે')}</span>
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.janaab || 'જનાબ')}</span>
                ${renderUnderField(d.have || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.rehvaasi || 'રહેવાસી :')}</span>
                ${renderUnderField(d.rehvasi || '', 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin: 0 4px;">,</span>
                ${renderUnderField(d.gram || '', '120px', null)}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 4px;">ના</span>
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* વર / દીકરા પૂરું નામ:</span>
                ${renderUnderField(d.dikraDikri || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* જન્મ તારીખ / ઉંમર:</span>
                ${renderUnderField(d.candidateDob || (d.candidateAge ? `${d.candidateAge} વર્ષ` : ''), 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0; margin-left: 8px;">આધાર કાર્ડ નં.:</span>
                ${renderUnderField(d.candidateAadhaar || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* વૈવાહિક સ્થિતિ:</span>
                ${renderUnderField(d.candidateMaritalStatus || '', '180px', null)}
              </div>
            </div>

            <!-- CENTER ACCENT 1 -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 3px 0 4px; width: 100%;">
              <div style="flex: 1; height: 1.5px; background: linear-gradient(90deg, transparent, #b8860b 80%, #8b181b 100%); border-radius: 1px;"></div>
              <span style="color: #8b181b; font-weight: 900; font-size: 13.5px; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; letter-spacing: 0.6px; white-space: nowrap; padding: 0 4px;">
                ${escapeHtml(n.niNikahSection || 'ની નિકાહખ્વાની')}
              </span>
              <div style="flex: 1; height: 1.5px; background: linear-gradient(90deg, #8b181b 0%, #b8860b 20%, transparent 100%); border-radius: 1px;"></div>
            </div>

            <!-- SECOND PARTY DETAILS -->
            <div style="font-size: 12.5px; font-weight: 700; color: #111; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.aapniJamatText || 'આપની જમાઅતના સભ્ય (આસામી) જનાબ')}</span>
                ${renderUnderField(d.apniJamatGram || '', 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 4px;">${escapeHtml(n.talukaLabel || 'તાલુકો :')}</span>
                ${renderUnderField(d.apniTaluka || '', 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 4px;">${escapeHtml(n.jilaLabel || 'જિલ્લો :')}</span>
                ${renderUnderField(d.apniJila || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.janaab || 'જનાબ')}</span>
                ${renderUnderField(d.apniJawab || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.rehvaasi || 'રહેવાસી :')}</span>
                ${renderUnderField(d.apniRehvasi || '', 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 4px;">ના</span>
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* દુલ્હન / દીકરી પૂરું નામ:</span>
                ${renderUnderField(d.apniDikraDikri || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* જન્મ તારીખ / ઉંમર:</span>
                ${renderUnderField(d.apniCandidateDob || (d.apniCandidateAge ? `${d.apniCandidateAge} વર્ષ` : ''), 'auto', '1')}
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0; margin-left: 8px;">આધાર કાર્ડ નં.:</span>
                ${renderUnderField(d.apniCandidateAadhaar || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; font-size: 12.5px; flex-shrink: 0;">* વૈવાહિક સ્થિતિ:</span>
                ${renderUnderField(d.apniCandidateMaritalStatus || '', '180px', null)}
              </div>

              <div style="color: #8b181b; font-weight: 900; font-size: 12.5px; margin-top: 1px;">
                ${escapeHtml(n.inshaAllah || 'સાથે ઈન્શાઅલ્લાહ નક્કી થયેલ છે.')}
              </div>
            </div>

            <!-- CENTER ACCENT 2 -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 3px 0 4px; width: 100%;">
              <div style="flex: 1; height: 1.5px; background: linear-gradient(90deg, transparent, #b8860b 80%, #8b181b 100%); border-radius: 1px;"></div>
              <span style="color: #8b181b; font-weight: 900; font-size: 13.5px; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; letter-spacing: 0.6px; white-space: nowrap; padding: 0 4px;">
                ${escapeHtml(n.programTitle || 'નિકાહખ્વાનીના પ્રોગ્રામની વિગત')}
              </span>
              <div style="flex: 1; height: 1.5px; background: linear-gradient(90deg, #8b181b 0%, #b8860b 20%, transparent 100%); border-radius: 1px;"></div>
            </div>

            <!-- PROGRAM DETAILS -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; width: 100%; font-size: 12.5px; font-weight: 700; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.engDateLabel || 'તારીખ અને વાર : તા.')}</span>
                <div style="width: 22px; border-bottom: 1.2px solid #555; height: 22px; display: inline-flex; align-items: center; justify-content: center; margin-left: 2px;">
                  ${escapeHtml(d.engDateDay || '')}
                </div>
                <span style="font-weight: 800; font-size: 12px; color: #475569; margin: 0 1px;">/</span>
                <div style="width: 22px; border-bottom: 1.2px solid #555; height: 22px; display: inline-flex; align-items: center; justify-content: center;">
                  ${escapeHtml(d.engDateMonth || '')}
                </div>
                <span style="font-weight: 800; font-size: 12px; color: #475569; margin: 0 1px;">/</span>
                <div style="width: 36px; border-bottom: 1.2px solid #555; height: 22px; display: inline-flex; align-items: center; justify-content: center;">
                  ${escapeHtml(d.engDateYear ? (d.engDateYear.length === 2 ? `૨૦${d.engDateYear}` : d.engDateYear) : '૨૦૨૬')}
                </div>
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0; margin-left: 8px; margin-right: 4px;">${escapeHtml(n.neVar || 'વાર :')}</span>
                ${renderUnderField(d.engDayName || '', 'auto', '1')}
              </div>

              <div style="display: flex; align-items: center; width: 100%; font-size: 12.5px; font-weight: 700; padding-left: 30px; min-height: 24px;">
                <span style="color: #8b181b; font-weight: 900; flex-shrink: 0;">${escapeHtml(n.muqamLine || 'સ્થળ (મુકામ) :')}</span>
                ${renderUnderField(d.muqamPlace || '', 'auto', '1')}
              </div>
            </div>

            <!-- CLOSING DECLARATION & INDICATOR -->
            <div style="padding-top: 3px;">
              <div style="font-size: 11.5px; font-weight: 800; line-height: 17px; text-align: center; color: #000000; padding: 5px 12px; background: linear-gradient(180deg, #ffffff 0%, #fffdf5 100%); border-radius: 5px; border: 1.2px solid #b8860b; box-shadow: 0 1px 3px rgba(184,134,11,0.1); margin-bottom: 3px;">
                ${escapeHtml(n.bodyText || "આથી સદર નિકાહખ્વાની સંપન્ન કરવા માટે આ 'ના-વાંધા પ્રમાણપત્ર' (N.O.C.) આપવામાં આવે છે.")}
              </div>
              <div style="display: flex; justify-content: center; align-items: center; padding: 1px 10px; font-size: 10px; color: #166534; font-weight: 800; text-align: center;">
                [ પૃષ્ઠ ૧ / ૨ &bull; પાછળ કાનૂની શરતો તથા સંમતિ પત્ર જુઓ ]
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════
         PAGE 2 : ખાતરી, પરવાનગી તથા કાનૂની સંમતિ પત્ર (ROYAL THEME REPLICA)
      ══════════════════════════════════════════════════════════════ -->
      <div class="certificate-page" style="width: 650px; height: 920px; min-height: 920px; max-height: 920px; max-width: 650px; min-width: 650px; margin: 0 auto; font-family: 'Noto Sans Gujarati', 'Anek Gujarati', sans-serif; background: #fffdf9; border: 3.5px solid #8b181b; border-radius: 4px; padding: 4px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; box-shadow: 0 8px 30px rgba(139,24,27,0.18), inset 0 0 0 2px #d4af37; page-break-after: avoid; break-after: avoid;">
        <!-- Double Gold & Royal Maroon Inner Frame -->
        <div style="border: 2px solid #b8860b; border-radius: 2px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 56px 20px 42px; position: relative; box-sizing: border-box; background: linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%);">
          ${renderCornerFiligrees(78)}

          <!-- PAGE 2 TOP REFERENCE BADGE BAR -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, #ffffff 0%, #fffcf5 100%); border: 1.2px solid #b8860b; color: #0f172a; padding: 6px 16px; border-radius: 6px; font-size: 11.5px; font-weight: 900; box-shadow: 0 2px 4px rgba(184, 134, 11, 0.08); margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #8b181b;">NOC નં.:</span> <span style="color: #0d2366; font-weight: 900;">${escapeHtml(d.number || '........')}</span>
            </div>
            <div style="color: #8b181b; font-weight: 900; font-size: 12.5px; letter-spacing: 0.2px;">
              પૃષ્ઠ ૨ : ખાતરી, પરવાનગી તથા કાનૂની સંમતિ પત્ર
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #8b181b;">તા.:</span> <span style="color: #0d2366; font-weight: 900;">${escapeHtml(d.dateDay || 'DD')}/${escapeHtml(d.dateMonth || 'MM')}/${escapeHtml(dateYearStr)}</span>
            </div>
          </div>

          <!-- 4 LEGAL & SOCIAL UNDERTAKING CLAUSES BOX -->
          <div style="background: #ffffff; border: 1.4px solid #b8860b; border-radius: 6px; padding: 9px 14px; font-size: 11px; line-height: 16.5px; color: #111; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px;">
            <div style="display: flex; gap: 6px; align-items: flex-start;">
              <div style="color: #8b181b; font-weight: 900; min-width: 14px;">૧.</div>
              <div><strong style="color: #8b0000;">કોઈ લેણદેણ / વાંધો નથી:</strong> સદર નિકાહખ્વાની બાબતે અમારી જમાઅતના સભ્ય (આસામી) સામે કોઈ સામાજિક વાંધો, તકરાર અને જમાઅતનું કોઈ લ્હેણું બાકી નથી.</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: flex-start;">
              <div style="color: #8b181b; font-weight: 900; min-width: 14px;">૨.</div>
              <div><strong style="color: #8b0000;">પુખ્ત વયની કાનૂની ખાતરી:</strong> બાળવિવાહ પ્રતિબંધક કાયદા અંતર્ગત બંને પક્ષકારો કાયદેસર લગ્ન વય (દીકરો ૨૧ વર્ષ કે તેથી વધુ અને દીકરી ૧૮ વર્ષ કે તેથી વધુ) ધરાવે છે અને આ નિકાહ બંને પક્ષકારોની મુક્ત અને પરસ્પર સંમતિથી થાય છે.</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: flex-start;">
              <div style="color: #8b181b; font-weight: 900; min-width: 14px;">૩.</div>
              <div><strong style="color: #8b0000;">સમાજના બંધારણ અને શિસ્તનું ચુસ્ત પાલન:</strong> U T M C મેમન જમાઅતના બંધારણ મુજબ લગ્ન પ્રસંગના તમામ સામાજિક નિયમો અને U T M C જમાઅત (વરઘોડામાં ડીજે, ફટાકડા, બિનજરૂરી દેખાડો કે કુરિવાજો પરનો પ્રતિબંધ) માન્ય રાખવાના રહેશે. જો કોઈ સભ્ય નિયમભંગ કરશે તો સમાજના બંધારણ મુજબ કડક પગલાં લેવાશે.</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: flex-start;">
              <div style="color: #8b181b; font-weight: 900; min-width: 14px;">૪.</div>
              <div><strong style="color: #8b0000;">હેતુ અને મર્યાદા:</strong> આ પ્રમાણપત્ર માત્ર સામાજિક શિસ્ત, ઓળખ અને અધિકૃત લગ્ન નોંધણીના હેતુ માટે આપવામાં આવેલ છે.</div>
            </div>
          </div>

          <!-- NOTE BANNER -->
          <div style="background: linear-gradient(135deg, #5c1044 0%, #4a0e35 100%); color: #ffffff; border-radius: 6px; padding: 6px 14px; font-size: 10.5px; font-weight: 800; text-align: center; line-height: 15.5px; box-shadow: 0 2px 5px rgba(92,16,68,0.2); margin-bottom: 8px;">
            <div>
              <span style="color: #ffd600;">${escapeHtml(n.noteTitle || 'ખાતરી તથા પરવાનગી :-')} </span>
              U T M C મેમન જમાઅતના બંધારણ મુજબ શા દી પ્રસંગના નિયમોનું ચુસ્તપણે પાલન કરવાની સમાજના દરેક સભ્યની નૈતિક ફરજમાં આવે છે.
            </div>
          </div>

          <!-- LEGAL DISCLAIMER BOX -->
          <div style="background: #fffdf4; border: 1.4px solid #fbc02d; border-left: 5px solid #e65100; border-radius: 6px; padding: 7px 14px; font-size: 11px; line-height: 16px; color: #4a1505; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 8px;">
            <span style="color: #b71c1c; font-weight: 900;">કાનૂની જવાબદારી મુક્તિ નોંધ (Legal Disclaimer): </span>
            "આ એન.ઓ.સી. (N.O.C.) માત્ર સામાજિક ઓળખ, શિસ્ત અને જમાતના બંધારણ પૂરતી મર્યાદિત છે. પક્ષકારોના અંગત વ્યવહાર, આપ-લે (દહેજ વગેરે) કે ભવિષ્યના કોઈ પારિવારિક વિવાદ માટે રાધનપુર થરાદી મેમણ જમાઅત કાનૂની રીતે જવાબદાર રહેશે નહીં."
          </div>

          <!-- MEMBER / GUARDIAN UNDERTAKING -->
          <div style="background: #ffffff; border: 1.4px solid #16a34a; border-radius: 8px; padding: 10px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 8px;">
            <div style="color: #166534; font-weight: 900; font-size: 12px; border-bottom: 1.2px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
              આસામી / વાલી તથા વર-કન્યાની સંમતિ અને કબૂલાત:
            </div>
            <div style="fontSize: 11px; color: #222; line-height: 16px; font-weight: 600;">
              અમે નીચે સહી કરનાર ખાતરી આપીએ છીએ કે ઉપર જણાવેલ તમામ વિગતો સાચી છે અને અમે રાધનપુર થરાદી મેમણ જમાઅતના તમામ સામાજિક નિયમો અને બંધારણનું પાલન કરવા સંપૂર્ણ બંધાયેલા છીએ.
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; padding: 0 16px;">
              <div style="text-align: center; width: 42%;">
                <div style="border-top: 1.2px dashed #444; padding-top: 3px; font-size: 11.5px; font-weight: 900; color: #111;">
                  આસામી / વાલીની સહી
                </div>
                <div style="font-size: 10.5px; color: #555; font-weight: 700; margin-top: 1px;">
                  (${escapeHtml(d.memberName || '')})
                </div>
              </div>

              <div style="text-align: center; width: 42%;">
                <div style="border-top: 1.2px dashed #444; padding-top: 3px; font-size: 11.5px; font-weight: 900; color: #111;">
                  વર / કન્યાની સહી
                </div>
                <div style="font-size: 10.5px; color: #555; font-weight: 700; margin-top: 1px;">
                  (${escapeHtml(d.dikraDikri || '')})
                </div>
              </div>
            </div>
          </div>

          <!-- OFFICIAL SEAL & JAMAAT SIGNATURES FOOTER -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 6px 24px 2px; font-size: 12.5px; font-weight: 900; color: #8b0000; margin-top: 4px;">
            <div style="text-align: center; min-width: 140px;">
              <div style="border-top: 1.5px solid #8b0000; padding-top: 4px; margin-bottom: 2px;"></div>
              <div>પ્રમુખશ્રી</div>
              <div style="font-size: 10px; color: #555; font-weight: 700;">રાધનપુર થરાદી મેમણ જમાઅત</div>
            </div>

            <!-- Official Seal Box -->
            <div style="width: 58px; height: 58px; border: 1.5px dashed #b8860b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: #8b181b; text-align: center; line-height: 1.2; background: rgba(184, 134, 11, 0.05); box-shadow: 0 1px 3px rgba(184, 134, 11, 0.15);">
              જમાતની<br />સત્તાવાર મોહર<br />(Seal)
            </div>

            <div style="text-align: center; min-width: 140px;">
              <div style="border-top: 1.5px solid #8b0000; padding-top: 4px; margin-bottom: 2px;"></div>
              <div>સેક્રેટરી</div>
              <div style="font-size: 10px; color: #555; font-weight: 700;">રાધનપુર થરાદી મેમણ જમાઅત</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Main dispatcher to render certificate HTML based on document type
 */
function renderCertificateHtml(type, data = {}) {
  switch (type) {
    case 'marriage':
      return renderMarriageCertificateHtml(data);
    case 'letterhead':
      return renderLetterheadHtml(data);
    case 'noc':
      return renderNocHtml(data);
    default:
      return renderMarriageCertificateHtml(data);
  }
}

module.exports = {
  renderCertificateHtml,
  renderMarriageCertificateHtml,
  renderLetterheadHtml,
  renderNocHtml,
  escapeHtml,
};
