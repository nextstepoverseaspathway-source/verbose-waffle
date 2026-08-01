/**
 * HTTP entry point.
 */
import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Smart Savings Tracker API listening on http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`   Environment: ${config.env}`);
});
