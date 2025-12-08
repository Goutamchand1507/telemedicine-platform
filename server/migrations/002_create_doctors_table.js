exports.up = function(knex) {
  return knex.schema.createTable('doctors', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('license_number').unique(); // Made nullable for registration
    table.string('specialization').notNullable();
    table.text('bio');
    table.decimal('consultation_fee', 10, 2);
    table.integer('experience_years');
    table.json('education'); // Array of education records
    table.json('certifications'); // Array of certifications
    table.json('languages'); // Array of languages spoken
    table.json('availability'); // Weekly availability schedule
    table.boolean('is_available').defaultTo(true);
    table.decimal('rating', 3, 2).defaultTo(0);
    table.integer('total_reviews').defaultTo(0);
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['specialization']);
    table.index(['is_available']);
    table.index(['rating']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('doctors');
};
