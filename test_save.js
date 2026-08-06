require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('./src/models/expenseModel');

async function test() {
  try {
    console.log('Connecting to MongoDB using URI:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully. Testing saving a new Expense...');

    const expense = new Expense({
      date: '2026-08-06',
      expense_category_id: '123456789012345678901234',
      expense_category_name: 'Electricity',
      committee_member_id: '123456789012345678901234',
      committee_member_name: 'Ravi R',
      amount: 122,
      description: 'asdads',
      image: 'test.jpg'
    });

    const saved = await expense.save();
    console.log('Save SUCCESS! Saved document:', saved);
  } catch (error) {
    console.error('Save FAILED with error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

test();
