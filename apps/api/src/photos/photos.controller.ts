import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PhotosService } from './photos.service.js';
import { readUpload } from './upload-input.js';

const TOKEN = 'x-participant-token';

@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('rooms/:roomId/photos')
  @HttpCode(200)
  async uploadPhotos(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const verdicts = await readUpload(req, res, Date.now());
    return this.photos.uploadPhotos(roomId, token, verdicts);
  }

  @Delete('rooms/:roomId/participants/me/photos')
  deleteMyPhotos(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.photos.deleteMyPhotos(roomId, token);
  }

  @Delete('rooms/:roomId/photos/:photoId')
  deletePhoto(
    @Param('roomId') roomId: string,
    @Param('photoId') photoId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.photos.deletePhoto(roomId, token, photoId);
  }

  @Get('thumbs/:photoId')
  async getThumbnail(
    @Param('photoId') photoId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ) {
    const jpeg = await this.photos.getThumbnail(photoId, exp, sig);
    res
      .status(200)
      .type('image/jpeg')
      .setHeader('Cache-Control', 'private, max-age=86400')
      .send(jpeg);
  }
}
