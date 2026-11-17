import { type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';
import { baseHeaders } from './http/headers.js';
import { ProblemFilter } from './http/problem.js';

export async function createApp(
  config: Config,
  logger: LogLevel[] | false = ['log', 'warn', 'error'],
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(config),
    { logger },
  );
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(baseHeaders);
  app.useGlobalFilters(new ProblemFilter());
  return app;
}
