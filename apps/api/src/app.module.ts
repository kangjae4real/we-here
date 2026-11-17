import { type DynamicModule, Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller.js';
import { ChatService } from './chat/chat.service.js';
import { CONFIG, type Config } from './config.js';
import { Db } from './db/db.js';
import { HealthController } from './health.controller.js';
import { PhotosController } from './photos/photos.controller.js';
import { PhotosService } from './photos/photos.service.js';
import { RateLimiter } from './http/rate-limit.js';
import { RoomAccess } from './rooms/room-access.js';
import { RoomsController } from './rooms/rooms.controller.js';
import { RoomsService } from './rooms/rooms.service.js';
import { GEOCODERS } from './snapshot/geocoders.js';
import { PlaceLabeler, sqlLabelCache } from './snapshot/place-labeler.js';
import { SnapshotController } from './snapshot/snapshot.controller.js';
import { SnapshotService } from './snapshot/snapshot.service.js';

@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        RoomsController,
        PhotosController,
        SnapshotController,
        ChatController,
      ],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: Db, useFactory: () => new Db(config.databaseUrl) },
        RateLimiter,
        RoomAccess,
        RoomsService,
        PhotosService,
        {
          provide: PlaceLabeler,
          inject: [Db],
          useFactory: (db: Db) =>
            new PlaceLabeler(
              GEOCODERS[config.geocoder](config.geocoderKeys),
              sqlLabelCache(db.q),
            ),
        },
        SnapshotService,
        ChatService,
      ],
    };
  }
}
