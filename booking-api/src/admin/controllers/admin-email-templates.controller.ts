import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';
import { EmailTemplatesService } from '../../shared/email-templates/email-templates.service';

const HTML_TEMPLATE_KEYS = new Set([
  'registration',
  'booking_confirmation',
  'booking_reminder',
  'admin_approval_notification',
  'user_approved',
  'user_rejected',
  'user_access_revoked',
  'user_account_deleted',
  'booking_deleted_by_admin',
  'email_footer',
]);

// Template variables used in href attributes are not real URLs and fail the scheme check.
// We swap them for safe placeholders before sanitizing and restore them after.
const URL_PLACEHOLDERS: Array<[string, string]> = [
  ['href="{{cancelUrl}}"', 'https://cancel-token.placeholder.local'],
  ['href="{{adminUrl}}"', 'https://admin-url.placeholder.local'],
  ['href="{{verificationUrl}}"', 'https://verification-url.placeholder.local'],
  ['href="{{checkinUrl}}"', 'https://checkin-url.placeholder.local'],
];

const ALLOWED_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'strong',
    'b',
    'em',
    'i',
    'h1',
    'h2',
    'p',
    'br',
    'div',
    'ul',
    'ol',
    'li',
    'a',
  ],
  allowedAttributes: {
    div: ['style'],
    h1: ['style'],
    h2: ['style'],
    p: ['style'],
    a: ['href', 'style'],
  },
  allowedStyles: {
    div: { 'text-align': [/^(left|center|right)$/] },
    h1: { 'text-align': [/^(left|center|right)$/] },
    h2: { 'text-align': [/^(left|center|right)$/] },
    p: { 'text-align': [/^(left|center|right)$/] },
    a: {
      'background-color': [/^#[0-9a-fA-F]{3,6}$/],
      color: [/^(white|black|#[0-9a-fA-F]{3,6})$/],
      padding: [/^\d+px(\s+\d+px){0,3}$/],
      'text-decoration': [/^none$/],
      'border-radius': [/^\d+px$/],
      display: [/^inline-block$/],
      'font-weight': [/^bold$/],
      margin: [/^\d+px(\s+\d+px){0,3}$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

function sanitizeEmailHtml(raw: string): string {
  let processed = raw;
  for (const [variable, placeholder] of URL_PLACEHOLDERS) {
    processed = processed.replaceAll(variable, `href="${placeholder}"`);
  }
  const sanitized = sanitizeHtml(processed, ALLOWED_HTML);
  let result = sanitized;
  for (const [variable, placeholder] of URL_PLACEHOLDERS) {
    result = result.replaceAll(`href="${placeholder}"`, variable);
  }
  return result;
}

@Controller('admin/email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminEmailTemplatesController {
  constructor(private readonly svc: EmailTemplatesService) {}

  @Get()
  async list() {
    return this.svc.getAll();
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() body: { body: string; subject?: string },
  ) {
    if (!body?.body || typeof body.body !== 'string') {
      throw new BadRequestException('Body is required');
    }

    const content = HTML_TEMPLATE_KEYS.has(key)
      ? sanitizeEmailHtml(body.body)
      : body.body;

    const subject =
      typeof body.subject === 'string' ? body.subject.trim() : undefined;

    return this.svc.upsert(key, content, subject);
  }
}
