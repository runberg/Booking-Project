import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  Request,
  ConflictException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmailTemplatesService } from '../email-templates.service';

@Controller('admin/email-templates')
@UseGuards(JwtAuthGuard)
export class AdminEmailTemplatesController {
  constructor(private svc: EmailTemplatesService) {}

  @Get()
  async list(@Request() req) {
    if (!['admin', 'super'].includes(req.user?.role)) {
      throw new ConflictException('Unauthorized');
    }
    return this.svc.getAll();
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() body: { body: string },
    @Request() req,
  ) {
    if (!['admin', 'super'].includes(req.user?.role)) {
      throw new ConflictException('Unauthorized');
    }
    if (!body?.body || typeof body.body !== 'string') {
      throw new ConflictException('Body is required');
    }
    return this.svc.upsert(key, body.body);
  }
}
