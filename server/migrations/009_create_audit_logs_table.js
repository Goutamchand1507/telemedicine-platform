exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action').notNullable(); // 'login', 'logout', 'create', 'update', 'delete', 'view'
    table.string('resource_type').notNullable(); // 'user', 'appointment', 'prescription', etc.
    table.uuid('resource_id');
    table.json('old_values');
    table.json('new_values');
    table.string('ip_address');
    table.string('user_agent');
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    // Indexes for HIPAA compliance and monitoring
    table.index(['user_id']);
    table.index(['action']);
    table.index(['resource_type']);
    table.index(['resource_id']);
    table.index(['timestamp']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};
