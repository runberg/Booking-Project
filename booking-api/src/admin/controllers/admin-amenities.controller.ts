import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AmenitiesService } from '../../shared/amenities/amenities.service';
import { BookingsService } from '../../shared/bookings/bookings.service';
import { EmailService } from '../../shared/email/email.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';

@Controller('admin/amenities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminAmenitiesController {
  constructor(
    private readonly amenitiesService: AmenitiesService,
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  async listAll() {
    return this.amenitiesService.listAll();
  }

  // Returns bookings that fall within a candidate closure range.
  // Used by the frontend to warn about conflicts before saving.
  @Get(':id/closure-conflicts')
  async getClosureConflicts(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) {
      throw new BadRequestException('start and end query params are required');
    }
    return this.bookingsService.listInRangeForAmenity(id, start, end);
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      openTime?: string;
      closeTime?: string;
      imageUrl?: string;
      slotLength?: number;
      isActive?: boolean;
    },
  ) {
    return this.amenitiesService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      openTime?: string;
      closeTime?: string;
      imageUrl?: string;
      slotLength?: number;
      isActive?: boolean;
      bookingRestrictionId?: string | null;
      closureStart?: string | null;
      closureEnd?: string | null;
      closureActive?: boolean;
      closureReason?: string | null;
    },
  ) {
    return this.amenitiesService.update(id, body);
  }

  // Sends a cancellation email to each affected user and deletes their bookings.
  // Must be called after PUT :id has saved the closure so the dates are on the record.
  @Post(':id/closure/cancel-conflicting')
  async cancelConflictingBookings(
    @Param('id') id: string,
    @Body() body: { emailBody: string; emailSubject: string },
  ) {
    const amenity = await this.amenitiesService.findOne(id);
    if (!amenity?.closureStart || !amenity?.closureEnd) {
      throw new BadRequestException('No closure period is saved for this amenity.');
    }
    const bookings = await this.bookingsService.listInRangeForAmenity(
      id,
      amenity.closureStart,
      amenity.closureEnd,
    );
    for (const b of bookings) {
      const html = this.interpolate(body.emailBody, b.userName, b.userEmail);
      await this.emailService.sendHtmlEmail(b.userEmail, body.emailSubject, html);
      await this.bookingsService.deleteByIdForAdmin(b.id);
    }
    return { cancelled: bookings.length };
  }

  @Post(':id/qr/regenerate')
  async regenerateQr(@Param('id') id: string) {
    return this.amenitiesService.regenerateQrToken(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.amenitiesService.remove(id);
    return { message: 'Amenity deleted' };
  }

  private interpolate(template: string, name: string, email: string): string {
    return template
      .replaceAll('{{name}}', name || email)
      .replaceAll('{{email}}', email);
  }
}
