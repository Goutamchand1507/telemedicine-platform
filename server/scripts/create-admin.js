require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function createAdminUser() {
  try {
    // Get email and password from command line args or use defaults
    const email = process.argv[2] || 'admin@telemedicine.com';
    const password = process.argv[3] || 'Admin@123456';
    const firstName = process.argv[4] || 'Admin';
    const lastName = process.argv[5] || 'User';

    console.log('\n🔐 Creating admin user...\n');

    // Check if user already exists
    const existingUser = await db('users')
      .where({ email })
      .first();

    if (existingUser) {
      console.log('❌ User with this email already exists!');
      console.log(`   Email: ${email}`);
      console.log(`   Current role: ${existingUser.role}`);

      if (existingUser.role !== 'admin') {
        console.log('\n🔄 Updating user role to admin...');
        await db('users')
          .where({ email })
          .update({ role: 'admin', updated_at: new Date() });
        console.log('✅ User role updated to admin successfully!');
      }

      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    const [adminUser] = await db('users')
      .insert({
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        email_verified: true,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: admin\n`);
    console.log('🌐 Access admin panel at:');
    console.log('   Local: http://localhost:3001/admin/dashboard');
    console.log('   Production: https://telemedicine-platform-iota.vercel.app/admin/dashboard\n');
    console.log('⚠️  IMPORTANT: Change this password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
