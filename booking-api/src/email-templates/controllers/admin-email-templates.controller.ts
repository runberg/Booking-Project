import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  Request,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmailTemplatesService } from '../email-templates.service';

// Keys whose body is stored as HTML (email templates with rich text).
// Legal text keys are plain text and are not sanitized.
const HTML_TEMPLATE_KEYS = new Set(['registration', 'booking_confirmation', 'booking_reminder']);

const ALLOWED_HTML: sanitizeHtml.IOptions = {
  allowedTags: ['strong', 'b', 'em', 'i', 'h1', 'h2', 'p', 'br', 'div', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: {
    div: ['style'],
    a: ['href'],
  },
  allowedStyles: {
    div: {
      'text-align': [/^(left|center|right)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

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
    @Body() body: { body: string; subject?: string },
    @Request() req,
  ) {
    if (!['admin', 'super'].includes(req.user?.role)) {
      throw new ConflictException('Unauthorized');
    }
    if (!body?.body || typeof body.body !== 'string') {
      throw new BadRequestException('Body is required');
    }

    const content = HTML_TEMPLATE_KEYS.has(key)
      ? sanitizeHtml(body.body, ALLOWED_HTML)
      : body.body;

    const subject = typeof body.subject === 'string' ? body.subject.trim() : undefined;

    return this.svc.upsert(key, content, subject);
  }
}
