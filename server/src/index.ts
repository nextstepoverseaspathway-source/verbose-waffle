/**
 * HTTP entry point.
 */
import { createApp } from './app';
import { config } from './config';
import { db, initDb } from './db/database';

async function main() {
  await initDb(); // create tables before accepting requests
  const app = createApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Smart Savings Tracker API listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`   Environment: ${config.env} · Database: ${db.dialect}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
