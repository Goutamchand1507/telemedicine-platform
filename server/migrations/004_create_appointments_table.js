exports.up = function(knex) {
  return knex.schema.createTable('appointments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('doctor_id').references('id').inTable('doctors').onDelete('CASCADE');
    table.timestamp('scheduled_at').notNullable();
    table.integer('duration_minutes').defaultTo(30);
    table.enum('status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).defaultTo('scheduled');
    table.enum('type', ['consultation', 'follow_up', 'emergency', 'routine_checkup']).defaultTo('consultation');
    table.text('reason_for_visit');
    table.text('notes');
    table.string('meeting_room_id');
    table.string('video_call_url');
    table.timestamp('started_at');
    table.timestamp('ended_at');
    table.decimal('consultation_fee', 10, 2);
    table.enum('payment_status', ['pending', 'paid', 'refunded', 'failed']).defaultTo('pending');
    table.string('payment_intent_id');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['patient_id']);
    table.index(['doctor_id']);
    table.index(['scheduled_at']);
    table.index(['status']);
    table.index(['type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('appointments');
};
