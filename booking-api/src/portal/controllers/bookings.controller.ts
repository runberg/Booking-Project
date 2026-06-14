import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Request,
  UseGuards,
  ConflictException,
  ForbiddenException,
  Delete,
} from '@nestjs/common';
import { Throttle, ThrottlerException, SkipThrottle } from '@nestjs/throttler';
import { BookingsService } from '../../shared/bookings/bookings.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';
import { EmailService } from '../../shared/email/email.service';
import { AmenitiesService } from '../../shared/amenities/amenities.service';
import { RestrictionsService } from '../../shared/restrictions/restrictions.service';
import { UserThrottlerGuard } from '../../shared/bookings/user-throttler.guard';
import type { RequestWithUser } from '../../shared/types/request-with-user';

@Controller('bookings')
@UseGuards(JwtAuthGuard, UserThrottlerGuard, RolesGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService,
    private readonly amenitiesService: AmenitiesService,
    private readonly restrictionsService: RestrictionsService,
  ) {}

  @Get('me')
  async listMine(@Request() req: RequestWithUser) {
    return this.bookingsService.listUpcomingForUser(req.user.id);
  }

  @Get('me/past')
  async listMinePast(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    return this.bookingsService.listPastForUser(
      req.user.id,
      Number(page) || 1,
      Number(pageSize) || 10,
    );
  }

  @Get('upcoming')
  @SkipThrottle()
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async listUpcoming() {
    return this.bookingsService.listUpcoming(10);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async listLogs(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'ASC' | 'DESC',
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('userEmail') userEmail?: string,
    @Query('userName') userName?: string,
    @Query('amenityName') amenityName?: string,
    @Query('building') building?: string,
    @Query('apartmentNumber') apartmentNumber?: string,
    @Query('date') date?: string,
    @Query('startTime') startTime?: string,
    @Query('slotLength') slotLength?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.bookingsService.listLogs({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      sortBy,
      sortDir,
      q,
      action,
      userEmail,
      userName,
      amenityName,
      building,
      apartmentNumber,
      date,
      startTime,
      slotLength: slotLength ? Number(slotLength) : undefined,
      dateFrom,
      dateTo,
    });
  }

  @Get('logs/no-shows')
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async listNoShows(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    return this.bookingsService.listNoShows(
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Get('logs/export')
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async exportLogs(
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'ASC' | 'DESC',
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('userEmail') userEmail?: string,
    @Query('userName') userName?: string,
    @Query('amenityName') amenityName?: string,
    @Query('building') building?: string,
    @Query('apartmentNumber') apartmentNumber?: string,
    @Query('date') date?: string,
    @Query('startTime') startTime?: string,
    @Query('slotLength') slotLength?: string,
  ) {
    return this.bookingsService.exportLogsCsv({
      sortBy,
      sortDir,
      q,
      action,
      userEmail,
      userName,
      amenityName,
      building,
      apartmentNumber,
      date,
      startTime,
      slotLength: slotLength ? Number(slotLength) : undefined,
    });
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async create(
    @Body()
    body: {
      amenityId: string;
      date: string;
      startTime: string;
      slotLength: number;
    },
    @Request() req: RequestWithUser,
  ) {
    const { id: userId, email, name } = req.user;
    const ipAddress = extractIp(req);

    const latest = await this.bookingsService.findLatestForUser(userId);
    if (latest) {
      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      if (diffMs < 30_000) {
        throw new ThrottlerException(
          'Please wait 30 seconds before creating another booking',
        );
      }
    }

    const existing = await this.bookingsService.listForAmenityOnDate(
      body.amenityId,
      body.date,
    );
    if (existing.some((b) => b.startTime === body.startTime)) {
      throw new ConflictException('This time slot is already booked');
    }

    const amenity = await this.amenitiesService.findOne(body.amenityId);
    let daysAhead = 14;
    let maxPerPeriod: number | null = null;
    if (amenity?.bookingRestrictionId) {
      const rr = await this.restrictionsService.findOne(
        amenity.bookingRestrictionId,
      );
      if (rr) {
        daysAhead = rr.daysAhead ?? daysAhead;
        maxPerPeriod = (rr.maxPerPeriod as number | null) ?? null;
      }
    }
    if (maxPerPeriod != null && maxPerPeriod > 0) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const end = new Date(now);
      end.setDate(end.getDate() + daysAhead);
      const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
      const count = await this.bookingsService.countForUserInRange({
        userId,
        amenityId: body.amenityId,
        startDate,
        endDate,
      });
      if (count >= maxPerPeriod) {
        throw new ConflictException(
          'You have reached the limit of bookings as per the restrictions set',
        );
      }
    }

    const booking = await this.bookingsService.create({
      userId,
      ipAddress,
      ...body,
    });

    void this.sendConfirmationEmail(
      email,
      name,
      body.amenityId,
      body.date,
      body.startTime,
      booking.id,
    );

    return booking;
  }

  @Get('amenity/:id')
  async listForAmenityOnDate(
    @Param('id') amenityId: string,
    @Query('date') date: string,
  ) {
    const list = await this.bookingsService.listForAmenityOnDate(
      amenityId,
      date,
    );
    return list.map((b) => b.startTime);
  }

  @Delete(':id')
  async deleteMine(@Param('id') id: string, @Request() req: RequestWithUser) {
    const res = await this.bookingsService.deleteIfOwned(
      id,
      req.user.id,
      extractIp(req),
    );
    if (res.affected === 0) {
      throw new ForbiddenException('Booking not found or not owned by you');
    }
    return { message: 'Booking deleted' };
  }

  private async sendConfirmationEmail(
    email: string,
    name: string,
    amenityId: string,
    date: string,
    startTime: string,
    bookingId: string,
  ) {
    try {
      const amenity = await this.amenitiesService.findOne(amenityId);
      await this.emailService.sendTemplateEmail(
        email,
        'Booking Confirmation',
        'booking_confirmation',
        { name, amenity: amenity?.name ?? 'Amenity', date, time: startTime },
      );
    } catch {
      await this.bookingsService
        .logEvent('confirmation_failed', bookingId)
        .catch(() => {
          /* ignore */
        });
    }
  }
}

function extractIp(req: RequestWithUser): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(',')[0]?.trim() ?? req.ip ?? '';
}
