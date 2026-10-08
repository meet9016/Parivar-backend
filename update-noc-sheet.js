const fs = require('fs');
const path = require('path');

const certPagePath = path.join(__dirname, '../Privar-frontend/src/pages/CertificatePage.jsx');
let content = fs.readFileSync(certPagePath, 'utf8');

const startMarker = 'const NocSheet = memo(function NocSheet({ data, onChange, printRef }) {';
const endMarker = 'export default function CertificatePage';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const newNocSheet = `const NocSheet = memo(function NocSheet({ data, onChange, printRef }) {
  const n = certData.noc

  // Authentic printed form underline input for NOC
  const underlineField = (field, width = 'auto', flex = null, textAlign = 'left', placeholder = '') => (
    <div
      style={{
        flex: flex ? flex : undefined,
        width: width !== 'auto' ? width : undefined,
        minWidth: width !== 'auto' ? width : 45,
        borderBottom: '1.2px solid #555',
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: textAlign === 'center' ? 'center' : 'flex-start',
        padding: '0 4px',
        margin: '0 2px',
        boxSizing: 'border-box',
        verticalAlign: 'middle',
      }}
    >
      <CertInput
        section="noc"
        field={field}
        value={data[field]}
        onChange={onChange}
        textAlign={textAlign}
        placeholder={placeholder}
        style={{ fontSize: 12.5, fontWeight: 700, color: '#111', padding: 0 }}
      />
    </div>
  )

  return (
    <div
      ref={printRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        alignItems: 'center',
        width: '100%',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════
         PAGE 1 : મુખ્ય વિગત અને નિકાહ કાર્યક્રમ (ROYAL THEME REPLICA)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="certificate-page"
        style={{
          width: 650,
          height: 920,
          minHeight: 920,
          maxHeight: 920,
          maxWidth: 650,
          minWidth: 650,
          margin: '0 auto',
          fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", "Noto Sans", Arial, sans-serif',
          background: '#fffdf9',
          border: '3.5px solid #8b181b',
          borderRadius: 4,
          padding: '4px',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(139,24,27,0.18), inset 0 0 0 2px #d4af37',
        }}
      >
        {/* Double Gold & Royal Maroon Inner Frame */}
        <div
          style={{
            border: '2px solid #b8860b',
            borderRadius: 2,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '7px 11px 5px',
            position: 'relative',
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%)',
          }}
        >
          {/* Royal Corner Filigrees on All 4 Corners */}
          <RoyalCornerFiligree position="top-left" size={82} />
          <RoyalCornerFiligree position="top-right" size={82} />
          <RoyalCornerFiligree position="bottom-left" size={82} />
          <RoyalCornerFiligree position="bottom-right" size={82} />

          {/* ── TOP HEADER SECTION: LOGOS + QUOTES + COMMUNITY NAME + ADDRESS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', paddingTop: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0 4px',
              }}
            >
              {/* Left Official Medallion Logo */}
              <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogoMedallion size={64} logoSrc={letterpadLogo} />
              </div>

              {/* Center Quotes & Community Title */}
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                }}
              >
                <div style={{ color: '#8b181b', fontWeight: 900, fontSize: 11.5, lineHeight: 1.15 }}>
                  {n.quoteLine || '“વિના સહકાર નહિ ઉધ્ધાર”'}
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0d2366', marginTop: 1, lineHeight: 1.15 }}>
                  {n.trustLine || 'રાધનપુર મેમન જમાત, ટ્રસ્ટ રજી. નં. બી-૫૨૯-મહેસાણા તા. ૩૦-૯-૧૯૫૫'}
                </div>
                <div style={{ fontSize: 9, color: '#8b0000', fontWeight: 800, marginTop: 1, lineHeight: 1.15 }}>
                  {n.ayatLine1 || 'જમાઅતોના (જોડ સંગઠન) ઉપર અલ્લાહનો હાથ હોય છે. - કુર્આન શરીફ'}
                </div>
                <div style={{ fontSize: 8.5, color: '#4a154b', fontWeight: 700, marginTop: 1, lineHeight: 1.15 }}>
                  {n.ayatLine2 || 'માનવ માત્ર સમાજનો કરજદાર છે અન્યને ઉપયોગી થવું તે માનવ જીવનનું સર્વોત્તમ કાર્ય છે.'}
                </div>

                {/* 3D Gujarati Community Title */}
                <div
                  style={{
                    fontFamily: '"Anek Gujarati", "Noto Sans Gujarati", sans-serif',
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#8b181b',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                    marginTop: 2,
                    marginBottom: 1,
                    letterSpacing: 0.8,
                    textShadow: '0 1px 0 rgba(255,255,255,0.85)',
                  }}
                >
                  {n.communityName || 'રાધનપુર થરાદી મેમણ જમાઅત'}
                </div>
              </div>

              {/* Right Official Medallion Logo */}
              <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogoMedallion size={64} logoSrc={letterpadLogo} />
              </div>
            </div>

            {/* Slogan Line */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: '#111111',
                marginTop: 2,
                lineHeight: 1.2,
              }}
            >
              {n.slogan || 'સફળતા સંગઠનમાં છુપાયેલી છે. એક બનો, નેક બનો.'}
            </div>

            {/* Address Line */}
            <div
              style={{
                textAlign: 'center',
                color: '#8b181b',
                fontSize: 10.5,
                fontWeight: 800,
                marginTop: 1,
                marginBottom: 2,
                letterSpacing: 0.3,
                whiteSpace: 'nowrap',
              }}
            >
              {n.address || 'ઠે. મેમણ જમાતખાના, જુમ્મા મસ્જીદ પાસે, મુ. રાધનપુર. જી. પાટણ પીન-૩૮૫૩૪૦ (ઉ.ગુ.)'}
            </div>
          </div>

          {/* ── NUMBER & DATE BAR (Strict Alignment) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 8px',
              background: '#f8fafc',
              border: '1.2px solid #cbd5e1',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 800,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 900, color: '#0d2366', fontSize: 12.5 }}>નંબર :</span>
              {underlineField('number', '120px')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontWeight: 900, color: '#0d2366', fontSize: 12.5 }}>તારીખ :</span>
              <div style={{ width: 22, borderBottom: '1.2px solid #64748b', height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <CertInput section="noc" field="dateDay" value={data.dateDay} onChange={onChange} textAlign="center" placeholder="DD" style={{ fontSize: 12, fontWeight: 700, padding: 0 }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#64748b' }}>/</span>
              <div style={{ width: 22, borderBottom: '1.2px solid #64748b', height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <CertInput section="noc" field="dateMonth" value={data.dateMonth} onChange={onChange} textAlign="center" placeholder="MM" style={{ fontSize: 12, fontWeight: 700, padding: 0 }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#64748b' }}>/</span>
              <div style={{ width: 36, borderBottom: '1.2px solid #64748b', height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={data.dateYear ? (data.dateYear.length === 2 ? \`૨૦\${data.dateYear}\` : data.dateYear) : ''}
                  onChange={(e) => {
                    const v = toGujaratiDigits(e.target.value).replace(/[^૦-૯]/g, '').slice(0, 4)
                    onChange('noc', 'dateYear', v.length === 4 ? v.slice(2) : v)
                  }}
                  placeholder="૨૦૨૬"
                  maxLength={4}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: 12,
                    color: '#0f172a',
                    textAlign: 'center',
                    padding: 0,
                    margin: 0,
                    fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", sans-serif',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── 3D GOLD RIBBON BANNER: ના-વાંધા પ્રમાણપત્ર (N.O.C.) ── */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1px 0' }}>
            <GoldFiligreeDivider width="68%" maxWidth={450} height={12} style={{ margin: '1px auto' }} />
            <GoldRibbonBanner title="❖ ના-વાંધા પ્રમાણપત્ર (N.O.C.) ❖" fontSize={16} maxWidth={520} style={{ margin: '2px auto 3px' }} />
            <GoldFiligreeDivider width="58%" maxWidth={380} height={11} style={{ margin: '2px auto 3px' }} />
          </div>

          {/* ── FIRST PARTY DETAILS (અમારી જમાઅત) ── */}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', display: 'flex', flexDirection: 'column', gap: 2.5, padding: '0 4px' }}>
            {/* Salutation */}
            <div style={{ color: '#8b181b', fontWeight: 900, fontSize: 13.5, textShadow: '0 1px 0 rgba(255,255,255,0.9)' }}>
              {n.salutation || 'મોહતરમ જનાબ,'}
            </div>

            {/* Pramukh Saheb / Secretary Saheb & Local Jamat */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#8b181b', fontWeight: 900, paddingLeft: 24, fontSize: 12.5 }}>
                {n.pramukhLineLabel || 'પ્રમુખ સાહેબ / સેક્રેટરી સાહેબ,'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, marginRight: 4 }}>
                  {n.localJamatLabel || 'સ્થાનિક મેમન જમાઅત'}
                </span>
                {underlineField('localJamat', '140px')}
              </div>
            </div>

            {/* Mukam, Taluka, Jila */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.muqamLabel || 'મુકામ :'}
              </span>
              {underlineField('muqam', '170px')}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 6 }}>
                {n.talukaLabel || 'તાલુકો :'}
              </span>
              {underlineField('taluka', '140px')}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 6 }}>
                {n.jilaLabel || 'જિલ્લો :'}
              </span>
              {underlineField('jila', 'auto', 1)}
            </div>

            {/* Assalamo Alaykum */}
            <div style={{ color: '#8b181b', fontWeight: 900, fontSize: 12 }}>
              {n.assalam || 'અસ્સલામુ અલયકુમ વ.વ..'}
            </div>

            {/* Salam baad gram haale */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.salamText || 'સલામ બાદ જણાવવાનું કે અમારી જમાઅતના સભ્ય (આસામી) જનાબ'}
              </span>
              {underlineField('memberName', 'auto', 1)}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>
                {n.haale || 'હાલે'}
              </span>
            </div>

            {/* Janaab & Rehvasi */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.janaab || 'જનાબ'}
              </span>
              {underlineField('have', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.rehvaasi || 'રહેવાસી :'}
              </span>
              {underlineField('rehvasi', 'auto', 1)}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, margin: '0 4px' }}>,</span>
              {underlineField('gram', '120px')}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>ના</span>
            </div>

            {/* Candidate 3 Detailed Lines */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * વર / દીકરા પૂરું નામ:
              </span>
              {underlineField('dikraDikri', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * જન્મ તારીખ / ઉંમર:
              </span>
              {underlineField('candidateDob', 'auto', 1, 'left', data.candidateAge ? \`\${data.candidateAge} વર્ષ\` : '')}
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0, marginLeft: 8 }}>
                આધાર કાર્ડ નં.:
              </span>
              {underlineField('candidateAadhaar', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * વૈવાહિક સ્થિતિ:
              </span>
              {underlineField('candidateMaritalStatus', '180px', null, 'left', '')}
            </div>
          </div>

          {/* ── CENTER SECTION DIVIDER 1: ❖ ની નિકાહખ્વાની ❖ ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '3px 0' }}>
            <div style={{ width: 45, height: 1.5, background: 'linear-gradient(90deg, transparent, #0d2366)' }} />
            <span style={{ color: '#d97706', fontSize: 12, lineHeight: 1 }}>❖</span>
            <span
              style={{
                color: '#0d2366',
                fontWeight: 900,
                fontSize: 14.5,
                fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", sans-serif',
                letterSpacing: 0.6,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {n.niNikahSection || 'ની નિકાહખ્વાની'}
            </span>
            <span style={{ color: '#d97706', fontSize: 12, lineHeight: 1 }}>❖</span>
            <div style={{ width: 45, height: 1.5, background: 'linear-gradient(90deg, #0d2366, transparent)' }} />
          </div>

          {/* ── SECOND PARTY DETAILS (આપની જમાઅત) ── */}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', display: 'flex', flexDirection: 'column', gap: 2.5, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.aapniJamatText || 'આપની જમાઅતના સભ્ય (આસામી) જનાબ'}
              </span>
              {underlineField('apniJamatGram', 'auto', 1)}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>
                {n.talukaLabel || 'તાલુકો :'}
              </span>
              {underlineField('apniTaluka', 'auto', 1)}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>
                {n.jilaLabel || 'જિલ્લો :'}
              </span>
              {underlineField('apniJila', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.janaab || 'જનાબ'}
              </span>
              {underlineField('apniJawab', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.rehvaasi || 'રહેવાસી :'}
              </span>
              {underlineField('apniRehvasi', 'auto', 1)}
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>ના</span>
            </div>

            {/* Second Party Candidate 3 Detailed Lines */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * દુલ્હન / દીકરી પૂરું નામ:
              </span>
              {underlineField('apniDikraDikri', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * જન્મ તારીખ / ઉંમર:
              </span>
              {underlineField('apniCandidateDob', 'auto', 1, 'left', data.apniCandidateAge ? \`\${data.apniCandidateAge} વર્ષ\` : '')}
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0, marginLeft: 8 }}>
                આધાર કાર્ડ નં.:
              </span>
              {underlineField('apniCandidateAadhaar', 'auto', 1)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ color: '#8b181b', fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>
                * વૈવાહિક સ્થિતિ:
              </span>
              {underlineField('apniCandidateMaritalStatus', '180px', null, 'left', '')}
            </div>

            <div style={{ color: '#8b181b', fontWeight: 900, fontSize: 12, marginTop: 1 }}>
              {n.inshaAllah || 'સાથે ઈન્શાઅલ્લાહ નક્કી થયેલ છે.'}
            </div>
          </div>

          {/* ── CENTER SECTION DIVIDER 2: ❖ નિકાહખ્વાનીના પ્રોગ્રામની વિગત ❖ ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '3px 0' }}>
            <div style={{ width: 45, height: 1.5, background: 'linear-gradient(90deg, transparent, #0d2366)' }} />
            <span style={{ color: '#d97706', fontSize: 12, lineHeight: 1 }}>❖</span>
            <span
              style={{
                color: '#0d2366',
                fontWeight: 900,
                fontSize: 14.5,
                fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", sans-serif',
                letterSpacing: 0.6,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {n.programTitle || 'નિકાહખ્વાનીના પ્રોગ્રામની વિગત'}
            </span>
            <span style={{ color: '#d97706', fontSize: 12, lineHeight: 1 }}>❖</span>
            <div style={{ width: 45, height: 1.5, background: 'linear-gradient(90deg, #0d2366, transparent)' }} />
          </div>

          {/* ── PROGRAM DETAILS (તારીખ/વાર/સ્થળ) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', fontSize: 12.5, fontWeight: 700, height: 21 }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.engDateLabel || 'તારીખ અને વાર : તા.'}
              </span>
              <div style={{ width: 22, borderBottom: '1.2px solid #555', height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>
                <CertInput section="noc" field="engDateDay" value={data.engDateDay} onChange={onChange} textAlign="center" placeholder="DD" style={{ fontSize: 12, fontWeight: 600, padding: 0 }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#475569', margin: '0 1px' }}>/</span>
              <div style={{ width: 22, borderBottom: '1.2px solid #555', height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <CertInput section="noc" field="engDateMonth" value={data.engDateMonth} onChange={onChange} textAlign="center" placeholder="MM" style={{ fontSize: 12, fontWeight: 600, padding: 0 }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#475569', margin: '0 1px' }}>/</span>
              <div style={{ width: 36, borderBottom: '1.2px solid #555', height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={data.engDateYear ? (data.engDateYear.length === 2 ? \`૨૦\${data.engDateYear}\` : data.engDateYear) : ''}
                  onChange={(e) => {
                    const v = toGujaratiDigits(e.target.value).replace(/[^૦-૯]/g, '').slice(0, 4)
                    onChange('noc', 'engDateYear', v.length === 4 ? v.slice(2) : v)
                  }}
                  placeholder="૨૦૨૬"
                  maxLength={4}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#111',
                    textAlign: 'center',
                    padding: 0,
                    margin: 0,
                    fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", sans-serif',
                  }}
                />
              </div>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0, marginLeft: 8, marginRight: 4 }}>
                {n.neVar || 'વાર :'}
              </span>
              {underlineField('engDayName', 'auto', 1, 'left', 'દા.ત. રવિવાર')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%', fontSize: 12.5, fontWeight: 700, paddingLeft: 30 }}>
              <span style={{ color: '#8b181b', fontWeight: 900, flexShrink: 0 }}>
                {n.muqamLine || 'સ્થળ (મુકામ) :'}
              </span>
              {underlineField('muqamPlace', 'auto', 1)}
            </div>
          </div>

          {/* ── BOLD CLOSING DECLARATION & BOTTOM INDICATOR ── */}
          <div style={{ marginTop: 'auto', paddingTop: 2 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                lineHeight: '16px',
                textAlign: 'center',
                color: '#000000',
                padding: '4px 10px',
                background: 'rgba(255, 255, 255, 0.85)',
                borderRadius: 5,
                border: '1.2px solid #b8860b',
                boxShadow: '0 1px 2px rgba(184,134,11,0.08)',
                marginBottom: 2,
              }}
            >
              {n.bodyText || "આથી સદર નિકાહખ્વાની સંપન્ન કરવા માટે આ 'ના-વાંધા પ્રમાણપત્ર' (N.O.C.) આપવામાં આવે છે."}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2px 10px',
                fontSize: 10,
                color: '#166534',
                fontWeight: 800,
                textAlign: 'center',
              }}
            >
              [ પૃષ્ઠ ૧ / ૨ &bull; પાછળ કાનૂની શરતો તથા સંમતિ પત્ર જુઓ ]
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
         PAGE 2 : ખાતરી, પરવાનગી તથા કાનૂની સંમતિ પત્ર (ROYAL THEME REPLICA)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="certificate-page"
        style={{
          width: 650,
          height: 920,
          minHeight: 920,
          maxHeight: 920,
          maxWidth: 650,
          minWidth: 650,
          margin: '0 auto',
          fontFamily: '"Noto Sans Gujarati", "Anek Gujarati", "Noto Sans", Arial, sans-serif',
          background: '#fffdf9',
          border: '3.5px solid #8b181b',
          borderRadius: 4,
          padding: '4px',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(139,24,27,0.18), inset 0 0 0 2px #d4af37',
        }}
      >
        {/* Double Gold & Royal Maroon Inner Frame */}
        <div
          style={{
            border: '2px solid #b8860b',
            borderRadius: 2,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '9px 12px 6px',
            position: 'relative',
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #ffffff 0%, #fffdfa 60%, #fffbf5 100%)',
          }}
        >
          {/* Royal Corner Filigrees on All 4 Corners */}
          <RoyalCornerFiligree position="top-left" size={82} />
          <RoyalCornerFiligree position="top-right" size={82} />
          <RoyalCornerFiligree position="bottom-left" size={82} />
          <RoyalCornerFiligree position="bottom-right" size={82} />

          {/* ── PAGE 2 TOP REFERENCE BADGE BAR ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              border: '1.2px solid #cbd5e1',
              color: '#0f172a',
              padding: '5px 12px',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 900,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div>NOC નં.: <span style={{ color: '#0d2366' }}>{data.number || '........'}</span></div>
            <div style={{ color: '#8b181b', fontWeight: 900 }}>પૃષ્ઠ ૨ : ખાતરી, પરવાનગી તથા કાનૂની સંમતિ પત્ર</div>
            <div>તા.: {data.dateDay || 'DD'}/{data.dateMonth || 'MM'}/૨૦{data.dateYear || 'YY'}</div>
          </div>

          {/* ── 4 LEGAL & SOCIAL UNDERTAKING CLAUSES BOX ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1.4px solid #b8860b',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              lineHeight: '16px',
              color: '#111',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ color: '#8b181b', fontWeight: 900, minWidth: 14 }}>૧.</div>
              <div>
                <strong style={{ color: '#8b0000' }}>કોઈ લેણદેણ / વાંધો નથી:</strong> સદર નિકાહખ્વાની બાબતે અમારી જમાઅતના સભ્ય (આસામી) સામે કોઈ સામાજિક વાંધો, તકરાર અને જમાઅતનું કોઈ લ્હેણું બાકી નથી.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ color: '#8b181b', fontWeight: 900, minWidth: 14 }}>૨.</div>
              <div>
                <strong style={{ color: '#8b0000' }}>પુખ્ત વયની કાનૂની ખાતરી:</strong> બાળવિવાહ પ્રતિબંધક કાયદા અંતર્ગત બંને પક્ષકારો કાયદેસર લગ્ન વય (દીકરો ૨૧ વર્ષ કે તેથી વધુ અને દીકરી ૧૮ વર્ષ કે તેથી વધુ) ધરાવે છે અને આ નિકાહ બંને પક્ષકારોની મુક્ત અને પરસ્પર સંમતિથી થાય છે.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ color: '#8b181b', fontWeight: 900, minWidth: 14 }}>૩.</div>
              <div>
                <strong style={{ color: '#8b0000' }}>સમાજના બંધારણ અને શિસ્તનું ચુસ્ત પાલન:</strong> U T M C મેમન જમાઅતના બંધારણ મુજબ લગ્ન પ્રસંગના તમામ સામાજિક નિયમો અને U T M C જમાઅત (વરઘોડામાં ડીજે, ફટાકડા, બિનજરૂરી દેખાડો કે કુરિવાજો પરનો પ્રતિબંધ) માન્ય રાખવાના રહેશે. જો કોઈ સભ્ય નિયમભંગ કરશે તો સમાજના બંધારણ મુજબ કડક પગલાં લેવાશે.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ color: '#8b181b', fontWeight: 900, minWidth: 14 }}>૪.</div>
              <div>
                <strong style={{ color: '#8b0000' }}>હેતુ અને મર્યાદા:</strong> આ પ્રમાણપત્ર માત્ર સામાજિક શિસ્ત, ઓળખ અને અધિકૃત લગ્ન નોંધણીના હેતુ માટે આપવામાં આવેલ છે.
              </div>
            </div>
          </div>

          {/* ── PURPLE / DEEP MAROON NOTE BANNER ── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #5c1044 0%, #4a0e35 100%)',
              color: '#ffffff',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 10.5,
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: '15px',
              boxShadow: '0 2px 5px rgba(92,16,68,0.2)',
            }}
          >
            <div>
              <span style={{ color: '#ffd600' }}>{n.noteTitle || 'ખાતરી તથા પરવાનગી :-'} </span>
              U T M C મેમન જમાઅતના બંધારણ મુજબ શા દી પ્રસંગના નિયમોનું ચુસ્તપણે પાલન કરવાની સમાજના દરેક સભ્યની નૈતિક ફરજમાં આવે છે.
            </div>
          </div>

          {/* ── LEGAL DISCLAIMER BOX ── */}
          <div
            style={{
              background: '#fffdf4',
              border: '1.4px solid #fbc02d',
              borderLeft: '5px solid #e65100',
              borderRadius: 6,
              padding: '7px 12px',
              fontSize: 11,
              lineHeight: '16px',
              color: '#4a1505',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ color: '#b71c1c', fontWeight: 900 }}>કાનૂની જવાબદારી મુક્તિ નોંધ (Legal Disclaimer): </span>
            "આ એન.ઓ.સી. (N.O.C.) માત્ર સામાજિક ઓળખ, શિસ્ત અને જમાતના બંધારણ પૂરતી મર્યાદિત છે. પક્ષકારોના અંગત વ્યવહાર, આપ-લે (દહેજ વગેરે) કે ભવિષ્યના કોઈ પારિવારિક વિવાદ માટે રાધનપુર થરાદી મેમન જમાઅત કાનૂની રીતે જવાબદાર રહેશે નહીં."
          </div>

          {/* ── MEMBER / GUARDIAN UNDERTAKING & SIGNATURE SECTION ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1.4px solid #16a34a',
              borderRadius: 8,
              padding: '10px 14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ color: '#166534', fontWeight: 900, fontSize: 12, borderBottom: '1.2px solid #e2e8f0', paddingBottom: 3, marginBottom: 4 }}>
              આસામી / વાલી તથા વર-કન્યાની સંમતિ અને કબૂલાત:
            </div>
            <div style={{ fontSize: 11, color: '#222', lineHeight: '16px', fontWeight: 600 }}>
              અમે નીચે સહી કરનાર ખાતરી આપીએ છીએ કે ઉપર જણાવેલ તમામ વિગતો સાચી છે અને અમે રાધનપુર થરાદી મેમન જમાઅતના તમામ સામાજિક નિયમો અને બંધારણનું પાલન કરવા સંપૂર્ણ બંધાયેલા છીએ.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, padding: '0 12px' }}>
              <div style={{ textAlign: 'center', width: '42%' }}>
                <div style={{ borderTop: '1.2px dashed #444', paddingTop: 3, fontSize: 11.5, fontWeight: 900, color: '#111' }}>
                  આસામી / વાલીની સહી
                </div>
                <div style={{ fontSize: 10.5, color: '#555', fontWeight: 700, marginTop: 1 }}>
                  ({data.memberName || 'અસદસદ'})
                </div>
              </div>

              <div style={{ textAlign: 'center', width: '42%' }}>
                <div style={{ borderTop: '1.2px dashed #444', paddingTop: 3, fontSize: 11.5, fontWeight: 900, color: '#111' }}>
                  વર / કન્યાની સહી
                </div>
                <div style={{ fontSize: 10.5, color: '#555', fontWeight: 700, marginTop: 1 }}>
                  ({data.dikraDikri || 'સદસદ'})
                </div>
              </div>
            </div>
          </div>

          {/* ── OFFICIAL SEAL & JAMAAT SIGNATURES FOOTER ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              padding: '6px 14px 2px',
              fontSize: 12.5,
              fontWeight: 900,
              color: '#8b0000',
            }}
          >
            {/* Secretary Signature */}
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ borderTop: '1.5px solid #8b0000', paddingTop: 2, marginBottom: 2 }}>
                {n.secretarySign || 'સેક્રેટરી'}
              </div>
              <div style={{ fontSize: 10.5, color: '#111', fontWeight: 800 }}>{n.footerCommunity || 'રાધનપુર મેમન જમાઅત'}</div>
            </div>

            {/* Official Jamaat Seal Circle */}
            <div
              style={{
                width: 66,
                height: 66,
                border: '2px dashed #166534',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
                color: '#166534',
                textAlign: 'center',
                lineHeight: 1.15,
                background: 'rgba(22, 101, 52, 0.04)',
              }}
            >
              જમાઅત<br />સિક્કો
            </div>

            {/* Pramukh Signature */}
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ borderTop: '1.5px solid #8b0000', paddingTop: 2, marginBottom: 2 }}>
                {n.pramukhSign || 'પ્રમુખ'}
              </div>
              <div style={{ fontSize: 10.5, color: '#111', fontWeight: 800 }}>{n.footerCommunity || 'રાધનપુર મેમન જમાઅત'}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 10, color: '#166534', fontWeight: 800, marginTop: 'auto' }}>
            પૃષ્ઠ ૨ / ૨ &bull; રાધનપુર થરાદી મેમન જમાઅત N.O.C. પ્રમાણપત્ર
          </div>
        </div>
      </div>
    </div>
  )
})
\n`;

content = content.substring(0, startIndex) + newNocSheet + content.substring(endIndex);
fs.writeFileSync(certPagePath, content, 'utf8');
console.log('NocSheet updated successfully in CertificatePage.jsx!');
