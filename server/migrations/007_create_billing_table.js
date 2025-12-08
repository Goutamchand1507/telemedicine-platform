exports.up = function(knex) {
  return knex.schema.createTable('billing', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.string('invoice_number').unique().notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.decimal('tax_amount', 10, 2).defaultTo(0);
    table.decimal('discount_amount', 10, 2).defaultTo(0);
    table.decimal('total_amount', 10, 2).notNullable();
    table.enum('status', ['pending', 'paid', 'overdue', 'cancelled', 'refunded']).defaultTo('pending');
    table.enum('payment_method', ['credit_card', 'debit_card', 'bank_transfer', 'insurance', 'cash']).defaultTo('credit_card');
    table.string('payment_intent_id');
    table.string('transaction_id');
    table.timestamp('due_date');
    table.timestamp('paid_at');
    table.text('notes');
    table.json('line_items'); // Detailed breakdown of charges
    table.json('insurance_claim'); // Insurance claim details
    table.timestamps(true, true);
    
    // Indexes
    table.index(['patient_id']);
    table.index(['appointment_id']);
    table.index(['status']);
    table.index(['due_date']);
    table.index(['invoice_number']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('billing');
};
