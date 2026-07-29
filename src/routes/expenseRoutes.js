const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { getExpenses, adminSaveExpense, adminDeleteExpense, exportExpenses } = require('../controllers/ExpenseController');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

// Member and Admin list
router.get('/', protect, getExpenses);

// Admin Excel Export
router.get('/export', protect, requirePermission('expenses.list'), exportExpenses);

// Admin CRUD
router.post('/', protect, requirePermission('expenses.add'), parseForm, adminSaveExpense);
router.put('/:id', protect, requirePermission('expenses.edit'), parseForm, adminSaveExpense);
router.delete('/:id', protect, requirePermission('expenses.delete'), adminDeleteExpense);

module.exports = router;
