exports.up = function(knex) {
  return knex.schema.createTable('patients', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('emergency_contact_name');
    table.string('emergency_contact_phone');
    table.string('emergency_contact_relationship');
    table.string('insurance_provider');
    table.string('insurance_policy_number');
    table.string('insurance_group_number');
    table.json('medical_history'); // Encrypted medical history
    table.json('allergies'); // Encrypted allergies
    table.json('current_medications'); // Encrypted current medications
    table.string('blood_type');
    table.decimal('height', 5, 2); // in cm
    table.decimal('weight', 5, 2); // in kg
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('patients');
};
