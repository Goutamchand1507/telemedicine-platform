exports.up = function(knex) {
  return knex.schema.createTable('messages', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sender_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('recipient_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.text('message').notNullable();
    table.enum('message_type', ['text', 'image', 'file', 'prescription', 'lab_result']).defaultTo('text');
    table.string('attachment_url');
    table.string('attachment_type');
    table.integer('attachment_size');
    table.boolean('is_encrypted').defaultTo(true);
    table.boolean('is_read').defaultTo(false);
    table.timestamp('read_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['sender_id']);
    table.index(['recipient_id']);
    table.index(['appointment_id']);
    table.index(['created_at']);
    table.index(['is_read']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('messages');
};
