import { type DynamicModule, Module } from '@nestjs/common';
import { CONFIG, type Config } from './config.js';
import { Db } from './db/db.js';
import { HealthController } from './health.controller.js';
import { RateLimiter } from './http/rate-limit.js';
import { RoomAccess } from './rooms/room-access.js';
import { RoomsController } from './rooms/rooms.controller.js';
import { RoomsService } from './rooms/rooms.service.js';

@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, RoomsController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: Db, useFactory: () => new Db(config.databaseUrl) },
        RateLimiter,
        RoomAccess,
        RoomsService,
      ],
    };
  }
}
