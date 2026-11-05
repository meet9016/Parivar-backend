const mongoose = require('mongoose');
const Suvichar = require('../models/suvicharModel');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { createAndBroadcast } = require('./notificationController');

const isObjectId = (id) => mongoose.isValidObjectId(id);

const gujaratiVaarList = ['રવિવાર', 'સોમવાર', 'મંગળવાર', 'બુધવાર', 'ગુરુવાર', 'શુક્રવાર', 'શનિવાર'];
const calculateVaar = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return gujaratiVaarList[d.getDay()] || '';
};

const nextPublicId = async (prefix = 'SUV') => {
  const count = await Suvichar.countDocuments();
  return `${prefix}${Date.now()}${count}`;
};

const findById = (id, extraQuery = {}) => Suvichar.findOne({
  ...extraQuery,
  $or: [
    ...(isObjectId(id) ? [{ _id: id }] : []),
    { id: String(id) }
  ]
});

const formatSuvichar = (req, item) => {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : item;
  const suvicharText = doc.suvichar || doc.description || doc.title || '';
  const dateVal = doc.date ? (typeof doc.date === 'string' ? doc.date.split('T')[0] : new Date(doc.date).toISOString().split('T')[0]) : '';
  const varVal = doc.var || doc.vaar || calculateVaar(doc.date || dateVal);
  return {
    _id: String(doc._id || doc.id),
    suvichar: suvicharText,
    author: doc.author || '',
    date: dateVal,
    var: varVal,
    status: Number(doc.status ?? 1)
  };
};

// --- Member / Public ---
const getSuvichars = async (req, res) => {
  try {
    let dateFilter = null;
    let cleanDate = null;
    if (req.query.date) {
      cleanDate = String(req.query.date).trim().split('T')[0];
      const startOfDayUTC = new Date(`${cleanDate}T00:00:00.000Z`);
      const endOfDayUTC = new Date(`${cleanDate}T23:59:59.999Z`);
      const istStart = new Date(startOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));
      const istEnd = new Date(endOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));
      dateFilter = {
        $gte: new Date(Math.min(startOfDayUTC.getTime(), istStart.getTime())),
        $lte: new Date(Math.max(endOfDayUTC.getTime(), istEnd.getTime()))
      };
    }

    const { data: suvichars, pagination } = await queryHelper(Suvichar, req.query, {
      searchFields: ['suvichar', 'description', 'title', 'author', 'var', 'vaar'],
      filterFields: ['status'],
      ...(dateFilter ? { baseQuery: { date: dateFilter } } : {})
    });

    let data = suvichars.map((row) => formatSuvichar(req, row));
    if (cleanDate) {
      data = data.filter(d => d.date === cleanDate);
      return apiResponse(res, 200, 'Suvichar data retrieved successfully', data);
    }
    return apiResponse(res, 200, 'Suvichar data retrieved successfully', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving suvichar', { error: error.message });
  }
};

// --- Get Suvichar by specific date (?date=YYYY-MM-DD or /by-date/:date) ---
const getSuvicharByDate = async (req, res) => {
  try {
    let dateInput = req.query.date || req.params.date;

    // If no date passed, default to today's date in IST
    if (!dateInput) {
      const kolkataParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const kMap = {};
      kolkataParts.forEach(p => { kMap[p.type] = p.value; });
      dateInput = `${kMap.year}-${kMap.month}-${kMap.day}`;
    }

    const cleanDate = String(dateInput).trim().split('T')[0];

    const startOfDayUTC = new Date(`${cleanDate}T00:00:00.000Z`);
    const endOfDayUTC = new Date(`${cleanDate}T23:59:59.999Z`);
    const istStart = new Date(startOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));
    const istEnd = new Date(endOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));

    const minDate = new Date(Math.min(startOfDayUTC.getTime(), istStart.getTime()));
    const maxDate = new Date(Math.max(endOfDayUTC.getTime(), istEnd.getTime()));

    const filter = {
      date: { $gte: minDate, $lte: maxDate }
    };
    if (req.query.status !== undefined) {
      filter.status = Number(req.query.status);
    }

    const docs = await Suvichar.find(filter).sort({ createdAt: -1 }).lean();

    const matched = docs.filter(doc => {
      if (!doc.date) return false;
      const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(doc.date));
      const isoStr = (doc.date instanceof Date ? doc.date.toISOString() : String(doc.date)).split('T')[0];
      return dStr === cleanDate || isoStr === cleanDate;
    });

    const formatted = matched.map(row => formatSuvichar(req, row));

    return apiResponse(res, 200, 'Suvichar data retrieved successfully', formatted);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving suvichar by date', { error: error.message });
  }
};

// --- Admin ---
const adminGetSuvichars = async (req, res) => {
  try {
    let dateFilter = null;
    let cleanDate = null;
    if (req.query.date) {
      cleanDate = String(req.query.date).trim().split('T')[0];
      const startOfDayUTC = new Date(`${cleanDate}T00:00:00.000Z`);
      const endOfDayUTC = new Date(`${cleanDate}T23:59:59.999Z`);
      const istStart = new Date(startOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));
      const istEnd = new Date(endOfDayUTC.getTime() - (5.5 * 60 * 60 * 1000));
      dateFilter = {
        $gte: new Date(Math.min(startOfDayUTC.getTime(), istStart.getTime())),
        $lte: new Date(Math.max(endOfDayUTC.getTime(), istEnd.getTime()))
      };
    }

    const { data, pagination } = await queryHelper(Suvichar, req.query, {
      searchFields: ['suvichar', 'description', 'title', 'author', 'var', 'vaar'],
      filterFields: ['status'],
      ...(dateFilter ? { baseQuery: { date: dateFilter } } : {})
    });

    let formatted = data.map((row) => formatSuvichar(req, row));
    if (cleanDate) {
      formatted = formatted.filter(d => d.date === cleanDate);
      return apiResponse(res, 200, 'Suvichar retrieved successfully', formatted);
    }

    return apiResponse(
      res,
      200,
      'Suvichar retrieved successfully',
      formatted,
      pagination
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving suvichar', { error: error.message });
  }
};

const getSuvicharById = async (req, res) => {
  try {
    const doc = await findById(req.params.id, {});
    if (!doc) return apiResponse(res, 404, 'Suvichar not found');
    return apiResponse(res, 200, 'Suvichar retrieved successfully', formatSuvichar(req, doc));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving suvichar', { error: error.message });
  }
};

const saveSuvichar = async (req, res) => {
  try {
    const existing = req.params.id ? await findById(req.params.id, {}) : null;

    // Handle bulk / multiple suvichar items
    let rawItems = req.body?.items || req.body?.suvichars;
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch (_) {}
    }
    if (!rawItems && Array.isArray(req.body)) {
      rawItems = req.body;
    }

    if (!existing && Array.isArray(rawItems) && rawItems.length > 0) {
      const savedDocs = [];
      for (const item of rawItems) {
        const itemText = item.suvichar !== undefined 
          ? String(item.suvichar).trim() 
          : (item.description !== undefined ? String(item.description).trim() : (item.title !== undefined ? String(item.title).trim() : ''));
        if (!itemText) continue;

        const itemAuthor = item.author !== undefined ? String(item.author).trim() : '';
        const itemDate = item.date ? new Date(item.date) : new Date();
        const itemVar = (item.var !== undefined && String(item.var).trim() !== '')
          ? String(item.var).trim()
          : ((item.vaar !== undefined && String(item.vaar).trim() !== '')
              ? String(item.vaar).trim()
              : calculateVaar(itemDate));
        const itemStatus = item.status !== undefined ? Number(item.status) : 1;

        const doc = new Suvichar({
          id: await nextPublicId('SUV'),
          suvichar: itemText,
          description: itemText,
          title: itemText.slice(0, 50),
          author: itemAuthor,
          date: itemDate,
          var: itemVar,
          vaar: itemVar,
          status: itemStatus,
          notification_sent: false,
          reminder_sent: false
        });

        await doc.save();
        savedDocs.push(formatSuvichar(req, doc));
      }

      if (savedDocs.length === 0) {
        return apiResponse(res, 400, 'At least one valid Suvichar is required');
      }

      return apiResponse(
        res,
        201,
        savedDocs.length === 1 ? 'Suvichar saved successfully' : `${savedDocs.length} Suvichars saved successfully`,
        savedDocs
      );
    }

    const suvicharText = req.body.suvichar !== undefined 
      ? String(req.body.suvichar).trim() 
      : (req.body.description !== undefined ? String(req.body.description).trim() : (req.body.title !== undefined ? String(req.body.title).trim() : (existing?.suvichar || existing?.description || existing?.title || '')));
    const author = req.body.author !== undefined ? String(req.body.author).trim() : (existing?.author || '');
    const date = req.body.date ? new Date(req.body.date) : (existing?.date || new Date());
    const varValue = (req.body.var !== undefined && String(req.body.var).trim() !== '')
      ? String(req.body.var).trim()
      : ((req.body.vaar !== undefined && String(req.body.vaar).trim() !== '')
          ? String(req.body.vaar).trim()
          : (existing?.var || existing?.vaar || calculateVaar(date)));

    if (!suvicharText) {
      return apiResponse(res, 400, 'Suvichar is required');
    }

    const payload = {
      suvichar: suvicharText,
      description: suvicharText,
      title: suvicharText.slice(0, 50),
      author,
      date,
      var: varValue,
      vaar: varValue
    };

    const doc = existing || new Suvichar({ id: await nextPublicId('SUV') });
    doc.set({ ...payload });

    if (!existing) {
      doc.status = req.body.status !== undefined ? Number(req.body.status) : 1;
    } else if (req.body.status !== undefined) {
      doc.status = Number(req.body.status);
    }

    await doc.save();

    // Broadcast notification to ALL members if suvichar is active and scheduled for today
    try {
      const todayKolkataParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const tkMap = {};
      todayKolkataParts.forEach(p => { tkMap[p.type] = p.value; });
      const todayDateStr = `${tkMap.year}-${tkMap.month}-${tkMap.day}`;

      const docDateKolkataParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(doc.date || new Date());
      const dkMap = {};
      docDateKolkataParts.forEach(p => { dkMap[p.type] = p.value; });
      const docDateStr = `${dkMap.year}-${dkMap.month}-${dkMap.day}`;

      const isToday = docDateStr === todayDateStr;
      const shouldNotify = Number(doc.status) === 1 && req.body.send_notification !== false && req.body.send_notification !== 'false';

      if (isToday && shouldNotify && !doc.notification_sent) {
        doc.notification_sent = true;
        doc.reminder_sent = true;
        doc.notified_date = todayDateStr;
        await doc.save();

        const thoughtText = doc.suvichar || doc.description || '';
        const authorText = doc.author ? ` - ${doc.author}` : '';
        const varText = (doc.var || doc.vaar) ? ` (${doc.var || doc.vaar})` : '';

        createAndBroadcast({
          title: `✨ આજનો સુવિચાર${varText}`,
          body: `${thoughtText}${authorText}`.slice(0, 200),
          image: '',
          type: 'suvichar',
          ref_id: String(doc._id || doc.id),
          date: doc.date || new Date(),
          target_type: 'all',
          target_users: []
        });
        console.log(`[Suvichar Notification] Broadcast live notification to ALL members`);
      }
    } catch (notifErr) {
      console.warn('[Suvichar Notification Warning]:', notifErr.message);
    }

    return apiResponse(
      res,
      existing ? 200 : 201,
      'Suvichar saved successfully',
      formatSuvichar(req, doc)
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error saving suvichar', { error: error.message });
  }
};

const deleteSuvichar = async (req, res) => {
  try {
    const existing = await findById(req.params.id, {});
    if (!existing) return apiResponse(res, 404, 'Suvichar not found');
    await existing.deleteOne();
    return apiResponse(res, 200, 'Suvichar deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting suvichar', { error: error.message });
  }
};

const duplicateSingleDoc = async (id, overrides = {}) => {
  const doc = await findById(id);
  if (!doc) return null;

  const suvicharText = overrides.suvichar !== undefined 
    ? String(overrides.suvichar).trim() 
    : (doc.suvichar || doc.description || doc.title || '');
  const author = overrides.author !== undefined ? String(overrides.author).trim() : (doc.author || '');
  const date = overrides.date ? new Date(overrides.date) : (doc.date ? new Date(doc.date) : new Date());
  const varValue = overrides.var !== undefined 
    ? String(overrides.var).trim() 
    : (doc.var || doc.vaar || calculateVaar(date));
  const status = overrides.status !== undefined ? Number(overrides.status) : Number(doc.status ?? 1);

  const newDoc = new Suvichar({
    id: await nextPublicId('SUV'),
    suvichar: suvicharText,
    description: suvicharText,
    title: doc.title || (suvicharText ? suvicharText.slice(0, 50) : ''),
    author,
    date,
    var: varValue,
    vaar: varValue,
    status,
    notification_sent: false,
    reminder_sent: false
  });

  await newDoc.save();
  return newDoc;
};

const duplicateSuvichar = async (req, res) => {
  try {
    const targetId = req.params.id || req.body.id;
    if (!targetId) {
      if (req.body.ids && Array.isArray(req.body.ids)) {
        return bulkDuplicateSuvichars(req, res);
      }
      return apiResponse(res, 400, 'Suvichar ID is required');
    }

    const newDoc = await duplicateSingleDoc(targetId, req.body || {});
    if (!newDoc) return apiResponse(res, 404, 'Suvichar not found to duplicate');

    return apiResponse(
      res,
      201,
      'Suvichar duplicated successfully',
      formatSuvichar(req, newDoc)
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error duplicating suvichar', { error: error.message });
  }
};

const bulkDuplicateSuvichars = async (req, res) => {
  try {
    const rawIds = req.body.ids || req.body.id || req.body.selected_ids || [];
    const ids = Array.isArray(rawIds) ? rawIds : [rawIds];

    if (!ids || ids.length === 0) {
      return apiResponse(res, 400, 'No suvichar IDs provided for duplication');
    }

    const createdDocs = [];
    for (const id of ids) {
      const newDoc = await duplicateSingleDoc(id);
      if (newDoc) {
        createdDocs.push(formatSuvichar(req, newDoc));
      }
    }

    if (createdDocs.length === 0) {
      return apiResponse(res, 404, 'No matching suvichars found to duplicate');
    }

    return apiResponse(
      res,
      201,
      `${createdDocs.length} Suvichar duplicated successfully`,
      createdDocs
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error duplicating suvichars', { error: error.message });
  }
};

const XLSX = require('xlsx');

const cleanHeader = (str) => String(str || '').replace(/[\*:\(\)]/g, '').replace(/[\s_-]+/g, ' ').trim().toLowerCase();

const getVal = (row, ...keys) => {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const target = cleanHeader(key);
    // 1. Exact match
    let found = rowKeys.find(k => cleanHeader(k) === target);
    // 2. Substring match
    if (!found) {
      found = rowKeys.find(k => {
        const cleaned = cleanHeader(k);
        return cleaned.includes(target) || target.includes(cleaned);
      });
    }
    if (found !== undefined && row[found] !== undefined && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
};

const parseExcelDate = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const str = String(val).trim();
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/]/);
    return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

const bulkImportSuvichars = async (req, res) => {
  try {
    let rows = [];

    const file = req.file || (req.files && req.files[0]);
    if (file && file.buffer) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else if (Array.isArray(req.body?.items)) {
      rows = req.body.items;
    }

    if (!rows || rows.length === 0) {
      return apiResponse(res, 400, 'Excel file is empty or has no data rows');
    }

    const savedDocs = [];
    for (const row of rows) {
      const suvicharText = getVal(row, 'suvichar', 'thought', 'સુવિચાર', 'quote', 'description', 'title');
      if (!suvicharText || suvicharText.startsWith('*')) continue;

      const author = getVal(row, 'author', 'by', 'લેખક');
      const rawDate = getVal(row, 'date', 'તારીખ');
      const date = rawDate ? parseExcelDate(rawDate) : new Date();
      const rawVar = getVal(row, 'var', 'vaar', 'day', 'વાર');
      const varValue = rawVar || calculateVaar(date);
      const rawStatus = getVal(row, 'status');
      const status = rawStatus === '' || rawStatus === '1' || String(rawStatus).toLowerCase() === 'active' ? 1 : 0;

      const doc = new Suvichar({
        id: await nextPublicId('SUV'),
        suvichar: suvicharText,
        description: suvicharText,
        title: suvicharText.slice(0, 50),
        author,
        date,
        var: varValue,
        vaar: varValue,
        status,
        notification_sent: false,
        reminder_sent: false
      });

      await doc.save();
      savedDocs.push(formatSuvichar(req, doc));
    }

    if (savedDocs.length === 0) {
      return apiResponse(res, 400, 'No valid Suvichar rows found to import');
    }

    return apiResponse(
      res,
      200,
      `${savedDocs.length} Suvichar(s) imported successfully`,
      { count: savedDocs.length, suvichars: savedDocs }
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error importing suvichars from Excel', { error: error.message });
  }
};

const getSampleExcelTemplate = async (req, res) => {
  try {
    const data = [
      {
        'Suvichar*': 'Learn from yesterday, live for today, hope for tomorrow.',
        'Author': 'Albert Einstein',
        'Date': new Date().toISOString().split('T')[0],
        'Day': calculateVaar(new Date()),
        'Status (1 = Active, 0 = Inactive)': 1
      },
      {
        'Suvichar*': 'જેનું મન શુદ્ધ છે, તેનું સમગ્ર જીવન ઉત્સવ છે.',
        'Author': 'ગાંધીજી',
        'Date': new Date(Date.now() + 86400000).toISOString().split('T')[0],
        'Day': calculateVaar(new Date(Date.now() + 86400000)),
        'Status (1 = Active, 0 = Inactive)': 1
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suvichar');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Suvichar_Import_Template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    return apiResponse(res, 500, 'Error generating sample Excel template', { error: error.message });
  }
};

module.exports = {
  getSuvichars,
  getSuvicharByDate,
  adminGetSuvichars,
  getSuvicharById,
  saveSuvichar,
  deleteSuvichar,
  duplicateSuvichar,
  bulkDuplicateSuvichars,
  bulkImportSuvichars,
  getSampleExcelTemplate
};
