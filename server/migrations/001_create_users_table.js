exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('date_of_birth');
    table.string('phone').notNullable();
    table.string('address');
    table.string('city');
    table.string('state');
    table.string('zip_code');
    table.string('country').defaultTo('US');
    table.enum('role', ['patient', 'doctor', 'admin']).notNullable();
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.boolean('email_verified').defaultTo(false);
    table.boolean('phone_verified').defaultTo(false);
    table.string('profile_image_url');
    table.json('preferences');
    table.timestamp('last_login');
    table.timestamps(true, true);
    
    // Indexes for performance
    table.index(['email']);
    table.index(['role']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
