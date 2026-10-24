const mongoose = require('mongoose');
const Expense = require('../models/expenseModel');
const queryHelper = require('../utils/queryHelper');
const { generateExcelExport, sendExportedExcelFile } = require('../utils/excelHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getExpenses = async (req, res) => {
  try {
    let baseQuery = {};
    if (req.query.category) {
      baseQuery.expense_category_id = req.query.category;
    }
    if (req.query.month) {
      baseQuery.date = { $regex: `^${req.query.month}` };
    }

    const { data: expenses, pagination } = await queryHelper(Expense, requestData(req), {
      baseQuery,
      searchFields: ['expense_category_name', 'committee_member_name', 'description'],
      filterFields: ['date', 'expense_category_id', 'committee_member_id'],
      defaultSort: { date: -1, createdAt: -1 }
    });

    let filteredExpenses = expenses;

    return res.status(200).json({
      status: 200,
      message: 'Expenses retrieved successfully',
      data: filteredExpenses.map(e => ({
        id: e._id || String(e._id),
        date: e.date || '',
        expense_category_id: e.expense_category_id || '',
        expense_category_name: e.expense_category_name || '',
        committee_member_id: e.committee_member_id || '',
        committee_member_name: e.committee_member_name || '',
        amount: Number(e.amount || 0),
        description: e.description || '',
        image: e.image || ''
      })),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error retrieving expenses',
      data: [],
      error: error.message
    });
  }
};

const adminSaveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;
    if (id) {
      if (mongoose.isValidObjectId(id)) {
        existing = await Expense.findById(id);
      } else {
        return res.status(400).json({ status: 400, message: 'Invalid expense ID', data: [] });
      }
    }

    if (id && !existing) {
      return res.status(404).json({
        status: 404,
        message: 'Expense not found',
        data: []
      });
    }

    const {
      date,
      expense_category_id,
      expense_category_name,
      committee_member_id,
      committee_member_name,
      amount,
      description,
      image,
      remove_image
    } = requestData(req);

    if (!existing && (!date || amount === undefined || amount === null || String(amount).trim() === '' || (!req.file && !image))) {
      return res.status(400).json({
        status: 400,
        message: 'Date, Amount, and Proof / Receipt are required',
        data: []
      });
    }

    const expense = existing || new Expense({});
    if (!expense._id) {
      expense._id = new mongoose.Types.ObjectId();
    }

    const updateFields = {};
    if (date !== undefined) updateFields.date = date;
    if (expense_category_id !== undefined) updateFields.expense_category_id = expense_category_id;
    if (expense_category_name !== undefined) updateFields.expense_category_name = expense_category_name;
    if (committee_member_id !== undefined) updateFields.committee_member_id = committee_member_id;
    if (committee_member_name !== undefined) updateFields.committee_member_name = committee_member_name;
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (description !== undefined) updateFields.description = description;

    if (image !== undefined) {
      updateFields.image = image;
    } else if (remove_image === 'true' || remove_image === true) {
      updateFields.image = '';
    }
    updateFields.id = String(expense._id);

    expense.set(updateFields);
    try {
      await expense.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        try {
          await Expense.collection.dropIndex('id_1');
        } catch (dropErr) { }
        await expense.save();
      } else {
        throw saveError;
      }
    }

    return res.status(existing ? 200 : 201).json({
      status: existing ? 200 : 201,
      message: `Expense ${existing ? 'updated' : 'saved'} successfully`,
      data: {
        id: expense._id,
        date: expense.date || '',
        expense_category_id: expense.expense_category_id || '',
        expense_category_name: expense.expense_category_name || '',
        committee_member_id: expense.committee_member_id || '',
        committee_member_name: expense.committee_member_name || '',
        amount: Number(expense.amount || 0),
        description: expense.description || '',
        image: expense.image || ''
      }
    });
  } catch (error) {
    try {
      require('fs').writeFileSync(
        require('path').join(__dirname, '../../backend_error.log'),
        `Error: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\n`
      );
    } catch (e) { }
    return res.status(500).json({
      status: 500,
      message: 'Error saving expense',
      data: [],
      error: error.message
    });
  }
};

const adminDeleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ status: 400, message: 'Invalid expense ID', data: [] });
    }

    const result = await Expense.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        message: 'Expense not found',
        data: []
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Expense deleted successfully',
      data: []
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error deleting expense',
      data: [],
      error: error.message
    });
  }
};

const exportExpenses = async (req, res) => {
  try {
    const { search, month, category, expense_category_id } = req.query;
    const query = {};

    if (search && String(search).trim()) {
      const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegExp(String(search).trim()), 'i');
      query.$or = [
        { description: regex },
        { expense_category_name: regex },
        { committee_member_name: regex }
      ];
    }

    const catId = category || expense_category_id;
    if (catId) {
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { expense_category_id: String(catId) }];
        delete query.$or;
      } else {
        query.expense_category_id = String(catId);
      }
    }

    if (month) {
      query.date = { $regex: `^${month}` };
    }

    const filteredExpenses = await Expense.find(query).sort({ date: -1, createdAt: -1 }).lean();

    const formatDate = (val) => {
      if (!val) return '-';
      try {
        const str = String(val).trim();
        if (!str) return '-';
        if (str.includes('/')) {
          const parts = str.split('/');
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            return `${d}/${m}/${y}`;
          }
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val || '-');
      }
    };

    const columns = [
      { header: 'DATE', key: 'date', width: 16, align: 'center' },
      { header: 'CATEGORY', key: 'expense_category_name', width: 26, align: 'left', bold: true },
      { header: 'COMMITTEE MEMBER', key: 'committee_member_name', width: 30, align: 'left' },
      { header: 'AMOUNT (₹)', key: 'amount', width: 18, align: 'right' },
      { header: 'DESCRIPTION', key: 'description', width: 42, align: 'left' }
    ];

    const rows = filteredExpenses.map(e => ({
      date: formatDate(e.date),
      expense_category_name: e.expense_category_name || '-',
      committee_member_name: e.committee_member_name || '-',
      amount: Number(e.amount || 0),
      description: e.description || '-'
    }));

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Expenses',
      sheetName: 'Expenses',
      columns,
      rows
    });

    return res.status(200).json({
      status: 200,
      message: 'Expenses exported successfully',
      data: {
        download_url,
        filename
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Export failed', error: error.message });
  }
};

const downloadExportedExpenses = (req, res) => {
  return sendExportedExcelFile(req, res);
};

module.exports = {
  getExpenses,
  adminSaveExpense,
  adminDeleteExpense,
  exportExpenses,
  downloadExportedExpenses
};
