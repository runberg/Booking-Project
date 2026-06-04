import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsPublicController {
  constructor(private bookingsService: BookingsService) {}

  @Get('cancel-preview/:token')
  async cancelPreview(@Param('token') token: string) {
    if (!/^[0-9a-f]{64}$/.test(token)) throw new NotFoundException();
    const preview = await this.bookingsService.previewCancelToken(token);
    if (!preview) throw new NotFoundException('This cancel link is invalid or has expired.');
    return preview;
  }

  @Post('cancel-by-token')
  async cancelByToken(@Body() body: { token: string }) {
    if (!body?.token || !/^[0-9a-f]{64}$/.test(body.token)) {
      throw new BadRequestException('Invalid token.');
    }
    const result = await this.bookingsService.cancelByToken(body.token);
    if (!result.ok) throw new BadRequestException(result.message);
    return { message: result.message };
  }
}
