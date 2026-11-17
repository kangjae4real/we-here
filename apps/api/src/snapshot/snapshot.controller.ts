import { Controller, Get, Headers, Param } from '@nestjs/common';
import { SnapshotService } from './snapshot.service.js';

@Controller('rooms')
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotService) {}

  @Get(':roomId/snapshot')
  getSnapshot(
    @Param('roomId') roomId: string,
    @Headers('x-participant-token') token: string | undefined,
  ) {
    return this.snapshots.snapshot(roomId, token);
  }
}
