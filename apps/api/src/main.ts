import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { migrate } from './db/migrate.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const parsed = readConfig(process.env);
if (!parsed.ok) {
  console.error(`Invalid environment: ${parsed.problems.join('; ')}`);
  process.exit(1);
}
const { config } = parsed;
if (!config.llm.ok) console.warn(`Chat is off: ${config.llm.reason}`);

const applied = await migrate(config.databaseUrl);
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = await createApp(config);
app.enableShutdownHooks();
await app.listen(config.port);
