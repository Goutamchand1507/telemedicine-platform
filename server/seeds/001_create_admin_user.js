// const bcrypt = require('bcryptjs');

// exports.seed = async function(knex) {
//   // Check if admin user already exists
//   const existingAdmin = await knex('users')
//     .where({ email: 'admin@telemedicine.com' })
//     .first();

//   if (existingAdmin) {
//     console.log('Admin user already exists, skipping seed');
//     return;
//   }

//   // Hash password
//   const hashedPassword = await bcrypt.hash('Admin@123456', 10);

//   // Insert admin user
//   const [adminUser] = await knex('users')
//     .insert({
//       email: 'admin@telemedicine.com',
//       password_hash: hashedPassword,
//       first_name: 'Admin',
//       last_name: 'User',
//       role: 'admin',
//       email_verified: true,
//       status: 'active',
//       created_at: new Date(),
//       updated_at: new Date()
//     })
//     .returning('*');

//   console.log('✅ Admin user created successfully:');
//   console.log('   Email: admin@telemedicine.com');
//   console.log('   Password: Admin@123456');
//   console.log('   ⚠️  IMPORTANT: Change this password after first login!');
// };


const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Check if admin user already exists
  const existingAdmin = await knex('users')
    .where({ email: 'admin@telemedicine.com' })
    .first();

  if (existingAdmin) {
    console.log('Admin user already exists, skipping seed');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

  // Insert admin user
  const [adminUser] = await knex('users')
    .insert({
      email: 'admin@telemedicine.com',
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      phone: '9999999999',        // ✅ REQUIRED FIELD FIXED
      role: 'admin',
      email_verified: true,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  console.log('✅ Admin user created successfully:');
  console.log('   Email: admin@telemedicine.com');
  console.log('   Password: Admin@123456');
  console.log('   ⚠️ IMPORTANT: Change this password after first login!');
};
