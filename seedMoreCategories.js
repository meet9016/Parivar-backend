const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const BusinessCategory = require('./src/models/businessCategoryModel');

// Load environment variables
dotenv.config();

const categoriesList = [
  { name: 'Advertising Services', keyword: 'advertising' },
  { name: 'Agriculture and Agro', keyword: 'agriculture' },
  { name: 'Art', keyword: 'art' },
  { name: 'Automobile', keyword: 'automobile' },
  { name: 'Beauty Care and Cosmetics', keyword: 'cosmetics' },
  { name: 'Chemicals', keyword: 'chemistry' },
  { name: 'Computer and Hardware', keyword: 'computer hardware' },
  { name: 'Construction Materials', keyword: 'construction materials' },
  { name: 'Consultancy and Services', keyword: 'consulting' },
  { name: 'Diamond', keyword: 'diamond' },
  { name: 'Ecommerce', keyword: 'ecommerce' },
  { name: 'Education', keyword: 'education' },
  { name: 'Electronics and Electricals', keyword: 'electronics' },
  { name: 'Energy and Power', keyword: 'energy' },
  { name: 'Engineering and Foundry', keyword: 'engineering' },
  { name: 'Event Organizer', keyword: 'event' },
  { name: 'Financial and Legal Services', keyword: 'finance' },
  { name: 'Foods and Beverages', keyword: 'food' },
  { name: 'Food Processing', keyword: 'food processing' },
  { name: 'Garment and Footwear', keyword: 'fashion' },
  { name: 'Gems and Jewelry', keyword: 'jewelry' },
  { name: 'Health Care and Doctor', keyword: 'doctor' },
  { name: 'Home Decor and Handicraft Items', keyword: 'home decor' },
  { name: 'Hospitality', keyword: 'hospitality' },
  { name: 'Insurance', keyword: 'insurance' },
  { name: 'IT and Software', keyword: 'software' },
  { name: 'Logistics and Packaging', keyword: 'logistics' },
  { name: 'Other', keyword: 'miscellaneous' },
  { name: 'Photography and Entertainment', keyword: 'photography' },
  { name: 'Pollution Control Equipment', keyword: 'environment' },
  { name: 'Real Estate and Construction', keyword: 'real estate' },
  { name: 'Safety Products', keyword: 'safety' },
  { name: 'Sports', keyword: 'sports' },
  { name: 'Tattoo and Nail Arts', keyword: 'tattoo' },
  { name: 'Textiles', keyword: 'textiles' },
  { name: 'Textile Parts and Accessories', keyword: 'fabric' },
  { name: 'Travel and Tourism', keyword: 'travel' },
  { name: 'Watch', keyword: 'watch' }
];

const downloadImage = async (url, filepath) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve(true);
      }
    });
  });
};

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected. Preparing to download images...');
    
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    await BusinessCategory.deleteMany({});
    
    for (let i = 0; i < categoriesList.length; i++) {
      const cat = categoriesList[i];
      const idStr = String(i + 100).padStart(3, '0');
      const filename = `cat_${idStr}.jpg`;
      const filepath = path.join(uploadsDir, filename);
      const imageUrl = `https://loremflickr.com/600/400/${encodeURIComponent(cat.keyword)}`;
      
      console.log(`Downloading image for ${cat.name}...`);
      try {
        await downloadImage(imageUrl, filepath);
        
        const categoryData = {
          id: `cat_${idStr}`,
          name: cat.name,
          image: `/uploads/${filename}`,
          state_id: "active",
          business: cat.name
        };
        
        await BusinessCategory.findOneAndUpdate(
          { id: categoryData.id },
          categoryData,
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error(`Failed to download image for ${cat.name}:`, err.message);
      }
    }
    
    console.log(`Successfully completed seeding process!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB', err);
    process.exit(1);
  });
