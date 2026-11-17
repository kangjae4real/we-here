import { type DynamicModule, Module } from '@nestjs/common';
import { CONFIG, type Config } from './config.js';
import { Db } from './db/db.js';
import { HealthController } from './health.controller.js';

@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: Db, useFactory: () => new Db(config.databaseUrl) },
      ],
    };
  }
}
