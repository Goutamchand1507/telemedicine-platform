exports.up = function(knex) {
  return knex.schema.createTable('health_records', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('doctor_id').references('id').inTable('doctors').onDelete('SET NULL');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.string('record_type').notNullable(); // 'lab_result', 'imaging', 'prescription', 'note', 'vaccination', etc.
    table.string('title').notNullable();
    table.text('description');
    table.text('diagnosis');
    table.text('treatment_plan');
    table.json('vital_signs'); // Blood pressure, heart rate, temperature, etc.
    table.json('lab_results'); // Lab test results
    table.json('medications_prescribed');
    table.string('file_url'); // URL to uploaded document/image
    table.string('file_type');
    table.integer('file_size');
    table.boolean('is_encrypted').defaultTo(true);
    table.timestamp('record_date').notNullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['patient_id']);
    table.index(['doctor_id']);
    table.index(['appointment_id']);
    table.index(['record_type']);
    table.index(['record_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('health_records');
};
