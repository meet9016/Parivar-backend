const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'src/models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js') && f !== 'tenantSchema.js' && f !== 'userModels.js'); 
// wait, I will process userModels.js too, just listing it. Let's process all except tenantSchema.js

fs.readdirSync(modelsDir).forEach(file => {
  if (file === 'tenantSchema.js') return;
  if (!file.endsWith('.js')) return;
  
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Example target: module.exports = mongoose.model('BankDetail', bankDetailSchema);
  const regex = /module\.exports\s*=\s*mongoose\.model\(['"]([^'"]+)['"]\s*,\s*([^)]+)\);/;
  
  if (regex.test(content)) {
    // Inject the require statement at the top if not present
    if (!content.includes('createTenantProxy')) {
      content = `const { createTenantProxy } = require('../utils/tenantContext');\n` + content;
    }
    
    // Replace export
    content = content.replace(regex, "module.exports = createTenantProxy('$1', $2);");
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Skipped ${file} (no match)`);
  }
});
