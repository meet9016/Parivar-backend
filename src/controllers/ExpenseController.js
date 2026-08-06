const mongoose = require('mongoose');
const Expense = require('../models/expenseModel');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getExpenses = async (req, res) => {
  try {
    const { data: expenses, pagination } = await queryHelper(Expense, requestData(req), {
      searchFields: ['expense_category_name', 'committee_member_name', 'description'],
      filterFields: ['date', 'expense_category_id', 'committee_member_id']
    });

    // Optionally handle monthwise filtering here if passed as 'month' (e.g. '2023-10')
    let filteredExpenses = expenses;
    const { month } = req.query;
    if (month) {
      filteredExpenses = filteredExpenses.filter(e => e.date && e.date.startsWith(month));
    }

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
      image
    } = requestData(req);

    if (!existing && (!date || amount === undefined || amount === null || String(amount).trim() === '' || (!req.file && !image))) {
      return res.status(400).json({
        status: 400,
        message: 'Date, Amount, and Proof / Receipt are required',
        data: []
      });
    }

    const expense = existing || new Expense({});

    const updateFields = {};
    if (date !== undefined) updateFields.date = date;
    if (expense_category_id !== undefined) updateFields.expense_category_id = expense_category_id;
    if (expense_category_name !== undefined) updateFields.expense_category_name = expense_category_name;
    if (committee_member_id !== undefined) updateFields.committee_member_id = committee_member_id;
    if (committee_member_name !== undefined) updateFields.committee_member_name = committee_member_name;
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (description !== undefined) updateFields.description = description;
    if (image !== undefined) updateFields.image = image;

    expense.set(updateFields);
    await expense.save();

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
    } catch (e) {}
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
    const { search, month } = req.query;
    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ description: regex }, { expense_category_name: regex }, { committee_member_name: regex }];
    }
    
    const expenses = await Expense.find(query).sort({ _id: -1 }).lean();
    
    let filteredExpenses = expenses;
    if (month) {
      filteredExpenses = filteredExpenses.filter(e => e.date && e.date.startsWith(month));
    }

    const rows = filteredExpenses.map(e => ({
      'Date': e.date || '',
      'Category': e.expense_category_name || '',
      'Committee Member': e.committee_member_name || '',
      'Description': e.description || '',
      'Amount (₹)': Number(e.amount || 0)
    }));
    
    const header = Object.keys(rows[0] || { 'Date': '', 'Category': '', 'Committee Member': '', 'Description': '', 'Amount (₹)': '' });
    const csv = [
      header.join(','),
      ...rows.map(row => header.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Export failed', error: error.message });
  }
};

module.exports = {
  getExpenses,
  adminSaveExpense,
  adminDeleteExpense,
  exportExpenses
};
