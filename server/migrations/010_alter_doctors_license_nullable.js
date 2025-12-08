exports.up = function(knex) {
  return knex.schema.alterTable('doctors', function(table) {
    // Make license_number nullable since doctors might not have it during initial registration
    table.string('license_number').nullable().alter();
  });
};

exports.down = function(knex) {
  // Don't revert to not null since there might be existing null values
  // This is a one-way migration for safety
  return Promise.resolve();
};
