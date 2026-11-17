import { type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';
import { baseHeaders } from './http/headers.js';
import { ProblemFilter } from './http/problem.js';

/** The configured app, shared by main.ts and the e2e harness so tests run what production runs. */
export async function createApp(
  config: Config,
  logger: LogLevel[] | false = ['log', 'warn', 'error'],
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(config),
    { logger },
  );
  app.disable('x-powered-by');
  // One hop: the web app's rewrite proxy. Rate limits key on the client it forwards.
  app.set('trust proxy', 1);
  app.use(baseHeaders);
  app.useGlobalFilters(new ProblemFilter());
  return app;
}
