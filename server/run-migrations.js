// Run database migrations before starting the server
const knex = require('knex');
const knexConfig = require('./knexfile');

const environment = process.env.NODE_ENV || 'production';
const config = knexConfig[environment];

console.log('🔄 Running database migrations...');
console.log('Environment:', environment);
console.log('Database config:', config.connection);

const db = knex(config);

db.migrate.latest()
  .then(() => {
    console.log('✅ Migrations completed successfully');
    return db.destroy();
  })
  .then(() => {
    console.log('🚀 Starting server...');
    require('./index.js');
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
