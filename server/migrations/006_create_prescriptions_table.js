exports.up = function(knex) {
  return knex.schema.createTable('prescriptions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('doctor_id').references('id').inTable('doctors').onDelete('CASCADE');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.string('medication_name').notNullable();
    table.text('dosage');
    table.text('instructions');
    table.integer('quantity');
    table.integer('refills_allowed').defaultTo(0);
    table.integer('refills_remaining').defaultTo(0);
    table.enum('status', ['active', 'completed', 'cancelled', 'expired']).defaultTo('active');
    table.date('prescribed_date').notNullable();
    table.date('expiry_date');
    table.string('pharmacy_name');
    table.string('pharmacy_address');
    table.string('pharmacy_phone');
    table.boolean('is_controlled_substance').defaultTo(false);
    table.text('side_effects');
    table.text('contraindications');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['patient_id']);
    table.index(['doctor_id']);
    table.index(['appointment_id']);
    table.index(['status']);
    table.index(['prescribed_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('prescriptions');
};
