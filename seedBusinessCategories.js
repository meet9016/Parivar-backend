const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BusinessCategory = require('./src/models/businessCategoryModel');

// Load environment variables
dotenv.config();

const mockCategories = [
  {
    id: "cat_001",
    name: "IT Services",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Information Technology"
  },
  {
    id: "cat_002",
    name: "Healthcare",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Medical & Health"
  },
  {
    id: "cat_003",
    name: "Education",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Schools & Universities"
  },
  {
    id: "cat_004",
    name: "Real Estate",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Property Management"
  },
  {
    id: "cat_005",
    name: "Finance",
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Banking & Investment"
  },
  {
    id: "cat_006",
    name: "Retail",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Shopping & Stores"
  },
  {
    id: "cat_007",
    name: "Manufacturing",
    image: "https://images.unsplash.com/photo-1565439387431-7e8c56cc33ce?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Industrial Production"
  },
  {
    id: "cat_008",
    name: "Transportation",
    image: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&q=80&w=800",
    state_id: "active",
    business: "Logistics & Delivery"
  }
];

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected.');
    
    for (let category of mockCategories) {
      await BusinessCategory.findOneAndUpdate(
        { id: category.id },
        category,
        { upsert: true, new: true }
      );
    }
    
    console.log(`Successfully added ${mockCategories.length} mock business categories!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB', err);
    process.exit(1);
  });
