import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;

@Controller('bookings')
export class BookingsPublicController {
  constructor(private bookingsService: BookingsService) {}

  @Get('cancel-preview/:token')
  async cancelPreview(@Param('token') token: string) {
    if (!HEX64.test(token)) throw new NotFoundException();
    const preview = await this.bookingsService.previewCancelToken(token);
    if (!preview) throw new NotFoundException('This cancel link is invalid or has expired.');
    return preview;
  }

  @Post('cancel-by-token')
  async cancelByToken(@Body() body: { token: string }) {
    if (!body?.token || !HEX64.test(body.token)) throw new BadRequestException('Invalid token.');
    const result = await this.bookingsService.cancelByToken(body.token);
    if (!result.ok) throw new BadRequestException(result.message);
    return { message: result.message };
  }

  @Get('checkin-preview/:token')
  async checkinPreview(@Param('token') token: string) {
    if (!HEX64.test(token)) throw new NotFoundException();
    const preview = await this.bookingsService.previewCheckinToken(token);
    if (!preview) throw new NotFoundException('This check-in link is invalid or has expired.');
    return preview;
  }

  @Post('checkin-by-token')
  async checkinByToken(@Body() body: { token: string; qrToken: string }) {
    if (!body?.token || !HEX64.test(body.token)) throw new BadRequestException('Invalid token.');
    if (!body?.qrToken || !HEX32.test(body.qrToken)) throw new BadRequestException('Invalid QR code.');
    const result = await this.bookingsService.checkinByToken(body.token, body.qrToken);
    if (!result.ok) throw new BadRequestException(result.message);
    return { message: result.message };
  }
}
