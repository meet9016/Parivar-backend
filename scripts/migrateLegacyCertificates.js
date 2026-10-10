/**
 * Legacy Certificate PDF Migration Script
 *
 * Scans MongoDB for certificate records missing persistent PDFs,
 * generates vector PDFs using the faithful template service,
 * saves them using the shared storage service, and updates the database.
 *
 * Usage:
 *   node scripts/migrateLegacyCertificates.js --dry-run
 *   node scripts/migrateLegacyCertificates.js --backup
 *   node scripts/migrateLegacyCertificates.js --rollback
 *   node scripts/migrateLegacyCertificates.js --rollback ./scripts/backups/certificates_backup_xxx.json
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const Certificate = require('../src/models/certificateModel');
const { renderCertificateHtml } = require('../src/templates/certificateTemplateService');
const { generatePdfFromHtml, closeBrowser } = require('../src/services/pdfService');
const {
  saveCertificatePdf,
  deleteCertificatePdf,
  resolveCertificateDiskPath,
  certificatePdfExists,
} = require('../src/services/certificateStorageService');

const BACKUP_DIR = path.join(__dirname, 'backups');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    backup: true, // Default to safe backup
    rollback: false,
    rollbackFile: null,
    tenantSlug: 'default',
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--no-backup') {
      options.backup = false;
    } else if (arg === '--backup') {
      options.backup = true;
    } else if (arg === '--rollback') {
      options.rollback = true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        options.rollbackFile = args[++i];
      }
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--tenant' && args[i + 1]) {
      options.tenantSlug = args[++i];
    }
  }

  return options;
}

async function findLatestBackupFile() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('certificates_backup_') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]) : null;
}

async function createBackup(records) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(BACKUP_DIR, `certificates_backup_${timestamp}.json`);

  const payload = {
    createdAt: new Date().toISOString(),
    count: records.length,
    records: records.map((r) => r.toObject ? r.toObject() : r),
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[Backup] Created backup of ${records.length} records at:\n  -> ${backupFilePath}\n`);
  return backupFilePath;
}

async function runRollback(backupPath, tenantSlug) {
  let targetFile = backupPath;
  if (!targetFile) {
    targetFile = await findLatestBackupFile();
  }

  if (!targetFile || !fs.existsSync(targetFile)) {
    console.error(`[Rollback Error] Backup file not found: ${targetFile}`);
    process.exit(1);
  }

  console.log(`[Rollback] Restoring records from: ${targetFile}`);
  const content = fs.readFileSync(targetFile, 'utf8');
  const backupData = JSON.parse(content);
  const records = backupData.records || [];

  let restoredCount = 0;
  for (const item of records) {
    const id = item._id;
    // Check if a generated PDF file needs cleanup
    const currentRecord = await Certificate.findById(id);
    if (currentRecord && currentRecord.pdfPath && (!item.pdfPath || item.pdfPath !== currentRecord.pdfPath)) {
      try {
        await deleteCertificatePdf(currentRecord.pdfPath, tenantSlug);
        console.log(`[Rollback Cleanup] Removed generated PDF: ${currentRecord.pdfPath}`);
      } catch (err) {
        console.warn(`[Rollback Warning] Could not delete generated PDF ${currentRecord.pdfPath}:`, err.message);
      }
    }

    // Restore original record fields
    await Certificate.findByIdAndUpdate(id, {
      $set: {
        pdfUrl: item.pdfUrl || null,
        pdfPath: item.pdfPath || null,
        fileName: item.fileName || null,
        fileSize: item.fileSize || 0,
        mimeType: item.mimeType || null,
        storageProvider: item.storageProvider || 'local',
        isGenerated: !!item.isGenerated,
        generatedAt: item.generatedAt || null,
        data: item.data,
      },
    });
    restoredCount++;
  }

  console.log(`\n[Rollback Complete] Restored ${restoredCount} records successfully.`);
}

async function runMigration() {
  const options = parseArgs();
  console.log('====================================================');
  console.log('   Certificate PDF Storage Migration Tool           ');
  console.log('====================================================');
  console.log(`Mode:       ${options.dryRun ? 'DRY-RUN (Simulate)' : options.rollback ? 'ROLLBACK' : 'LIVE MIGRATION'}`);
  console.log(`Tenant:     ${options.tenantSlug}`);
  console.log(`Force:      ${options.force}`);
  console.log(`AutoBackup: ${options.backup}`);
  console.log('----------------------------------------------------\n');

  await connectDB();

  try {
    if (options.rollback) {
      await runRollback(options.rollbackFile, options.tenantSlug);
      return;
    }

    // Find candidate records
    const allRecords = await Certificate.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    console.log(`[Inspection] Total active certificate records in database: ${allRecords.length}`);

    const candidates = allRecords.filter((rec) => {
      if (options.force) return true;
      // Legacy records: pdfPath is missing, pdfUrl is empty/null, or isGenerated is false
      return !rec.pdfPath || !rec.pdfUrl || rec.isGenerated !== true;
    });

    console.log(`[Inspection] Records requiring PDF migration: ${candidates.length}\n`);

    if (candidates.length === 0) {
      console.log('All certificate records already have generated persistent PDFs. Nothing to do!');
      return;
    }

    // Print summary table
    console.log('--- Candidate Records Summary ---');
    candidates.forEach((rec, idx) => {
      const num = rec.certificateNumber || rec.data?.number || rec.data?.refNumber || 'N/A';
      const name = rec.primaryName || rec.data?.dulhaName || rec.data?.memberName || 'N/A';
      console.log(
        ` [${idx + 1}] ID: ${rec._id} | Type: ${rec.type.padEnd(10)} | Num: ${num.padEnd(12)} | Name: ${name}`
      );
    });
    console.log('---------------------------------\n');

    if (options.dryRun) {
      console.log('[Dry-Run Notice] Dry-run complete. No files created and no database changes made.');
      console.log('To execute the migration, run:');
      console.log('  node scripts/migrateLegacyCertificates.js --backup\n');
      return;
    }

    // Create safety backup
    if (options.backup) {
      await createBackup(candidates);
    }

    // Process migration sequentially
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const rec = candidates[i];
      const startMs = Date.now();
      const num = (rec.certificateNumber || rec.data?.number || rec.data?.refNumber || 'doc').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `certificate-${rec.type}-${num}-${rec._id.toString().slice(-6)}`;

      try {
        process.stdout.write(`Migrating [${i + 1}/${candidates.length}] ${rec.type} (${rec._id})... `);

        // 1. Render server-side template
        const html = renderCertificateHtml(rec.type, rec.data || {});

        // 2. Generate PDF with Puppeteer
        const pdfBuffer = await generatePdfFromHtml(html, {
          filename,
          pageRanges: rec.type === 'letterhead' ? undefined : '1-2',
        });

        // 3. Save to storage
        const storageMeta = await saveCertificatePdf({
          buffer: pdfBuffer,
          filename,
          tenantSlug: options.tenantSlug,
          type: rec.type,
        });

        // 4. Update MongoDB record
        rec.pdfUrl = storageMeta.pdfUrl;
        rec.pdfPath = storageMeta.pdfPath;
        rec.fileName = storageMeta.fileName;
        rec.fileSize = storageMeta.fileSize;
        rec.mimeType = storageMeta.mimeType;
        rec.storageProvider = storageMeta.storageProvider;
        rec.generatedAt = storageMeta.generatedAt;
        rec.isGenerated = true;

        await rec.save();

        const duration = Date.now() - startMs;
        console.log(`OK (${(storageMeta.fileSize / 1024).toFixed(1)} KB in ${duration}ms)`);
        successCount++;
      } catch (err) {
        failCount++;
        console.log(`FAILED! Error: ${err.message}`);
      }
    }

    console.log('\n====================================================');
    console.log('   Migration Summary');
    console.log('====================================================');
    console.log(`Total Candidates: ${candidates.length}`);
    console.log(`Successfully Migrated: ${successCount}`);
    console.log(`Failed:               ${failCount}`);
    console.log('====================================================\n');
  } catch (fatalErr) {
    console.error('Fatal migration error:', fatalErr);
  } finally {
    await closeBrowser();
    await mongoose.disconnect();
    console.log('[Done] Database disconnected and browser closed.');
  }
}

runMigration().catch((err) => {
  console.error('Unhandled error in migration script:', err);
  process.exit(1);
});
