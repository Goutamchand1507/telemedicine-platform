const { db } = require('./config/database');

async function fixDoctorsTable() {
  try {
    console.log('Altering doctors table to make license_number nullable...');

    await db.raw(`
      ALTER TABLE doctors
      ALTER COLUMN license_number DROP NOT NULL
    `);

    console.log('✅ Successfully altered doctors table!');
    console.log('license_number is now nullable');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error altering table:', error.message);
    process.exit(1);
  }
}

fixDoctorsTable();
