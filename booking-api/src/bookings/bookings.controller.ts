import { Body, Controller, Get, Post, Query, Param, Request, UseGuards, ConflictException, Delete } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailService } from '../email/email.service';
import { AmenitiesService } from '../amenities/amenities.service';
import { RestrictionsService } from '../restrictions/restrictions.service';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
export class BookingsController {
  constructor(
    private bookingsService: BookingsService,
    private emailService: EmailService,
    private amenitiesService: AmenitiesService,
    private restrictionsService: RestrictionsService,
  ) {}

  @Get('me')
  async listMine(@Request() req) {
    const userId = req.user.id;
    return this.bookingsService.listForUser(userId);
  }

  @Get('upcoming')
  async listUpcoming(@Request() req) {
    if (req.user?.role !== 'admin') {
      throw new ConflictException('Unauthorized');
    }
    return this.bookingsService.listUpcoming(10);
  }

  @Get('logs')
  async listLogs(
    @Request() req,
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
    if (req.user?.role !== 'admin') {
      throw new ConflictException('Unauthorized');
    }
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

  @Get('logs/export')
  async exportLogs(
    @Request() req,
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
    if (req.user?.role !== 'admin') {
      throw new ConflictException('Unauthorized');
    }
    const csv = await this.bookingsService.exportLogsCsv({ sortBy, sortDir, q, action, userEmail, userName, amenityName, building, apartmentNumber, date, startTime, slotLength: slotLength ? Number(slotLength) : undefined });
    return csv;
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async create(@Body() body: { amenityId: string; date: string; startTime: string; slotLength: number }, @Request() req) {
    const userId = req.user.id;
    // cooldown: require 30s between bookings per user
    const latest = await this.bookingsService.findLatestForUser(userId);
    if (latest) {
      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      if (diffMs < 30_000) {
        throw new ThrottlerException('Please wait 30 seconds before creating another booking');
      }
    }
    // prevent double-booking exact same slot
    const existing = await this.bookingsService.listForAmenityOnDate(body.amenityId, body.date);
    if (existing.some((b) => b.startTime === body.startTime)) {
      throw new ConflictException('This time slot is already booked');
    }
    // enforce period limit if restriction applies
    const amenity = await this.amenitiesService.findOne(body.amenityId);
    let daysAhead = 14;
    let maxPerPeriod: number | null = null;
    if (amenity?.bookingRestrictionId) {
      const rr = await this.restrictionsService.findOne(amenity.bookingRestrictionId);
      if (rr) {
        daysAhead = rr.daysAhead ?? daysAhead;
        maxPerPeriod = (rr.maxPerPeriod as any) ?? null;
      }
    }
    if (maxPerPeriod != null && maxPerPeriod > 0) {
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const end = new Date(now);
      end.setDate(end.getDate() + daysAhead);
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const count = await this.bookingsService.countForUserInRange({ userId, amenityId: body.amenityId, startDate, endDate });
      if (count >= maxPerPeriod) {
        throw new ConflictException('You have reached the limit of bookings as per the restrictions set');
      }
    }
    const booking = await this.bookingsService.create({ userId, ...body });

    // email confirmation (best-effort, non-blocking)
    (async () => {
      try {
        const amenity = await this.amenitiesService.findOne(body.amenityId);
        await this.emailService.sendTemplateEmail(
          req.user.email,
          'Booking Confirmation',
          'booking_confirmation',
          {
            name: req.user.name,
            amenity: amenity?.name ?? 'Amenity',
            date: body.date,
            time: body.startTime,
          },
        );
      } catch {}
    })();

    return booking;
  }

  @Get('amenity/:id')
  async listForAmenityOnDate(@Param('id') amenityId: string, @Query('date') date: string) {
    const list = await this.bookingsService.listForAmenityOnDate(amenityId, date);
    return list.map((b) => b.startTime);
  }

  @Delete(':id')
  async deleteMine(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const res = await this.bookingsService.deleteIfOwned(id, userId);
    if (res.affected === 0) {
      return { message: 'Not found' };
    }
    return { message: 'Booking deleted' };
  }
}


