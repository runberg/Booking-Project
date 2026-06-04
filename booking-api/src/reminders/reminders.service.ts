import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from '../bookings/bookings.service';
import { AmenitiesService } from '../amenities/amenities.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private bookingsService: BookingsService,
    private amenitiesService: AmenitiesService,
    private usersService: UsersService,
    private emailService: EmailService,
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  onModuleInit() {
    const intervalMs =
      Number(this.configService.get('REMINDER_CHECK_INTERVAL_MINUTES', '10')) * 60_000;

    // Short startup delay so DB connections are ready
    setTimeout(() => {
      this.runCheck();
      setInterval(() => this.runCheck(), intervalMs);
    }, 20_000);
  }

  private async runCheck() {
    try {
      const hoursRaw = await this.settingsService.get('reminder_hours_before');
      const hoursBefore = Number(hoursRaw ?? this.configService.get('REMINDER_HOURS_BEFORE', '24'));
      const now = new Date();
      const windowEndMs = now.getTime() + hoursBefore * 3_600_000;
      const minCreatedAtMs = now.getTime() - hoursBefore * 3_600_000;

      const candidates = await this.bookingsService.findUnremindedUpcoming();

      for (const booking of candidates) {
        const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
        const bookingMs = bookingDateTime.getTime();

        if (
          bookingMs > now.getTime() &&
          bookingMs <= windowEndMs &&
          new Date(booking.createdAt).getTime() <= minCreatedAtMs
        ) {
          await this.sendReminder(booking, bookingDateTime);
        }
      }
    } catch (e) {
      this.logger.error('Reminder check failed', e);
    }
  }

  private async sendReminder(booking: any, bookingDateTime: Date) {
    const [user, amenity] = await Promise.all([
      this.usersService.findById(booking.userId),
      this.amenitiesService.findOne(booking.amenityId),
    ]);
    if (!user || !amenity) return;

    // Token expires at booking start time
    const expiresAt = new Date(bookingDateTime.getTime());
    const token = await this.bookingsService.createCancelToken(booking.id, expiresAt);

    const frontendUrl = this.configService.get('FRONTEND_URL', '');
    const cancelUrl = `${frontendUrl}/cancel/${token}`;

    try {
      await this.emailService.sendTemplateEmail(
        user.email,
        'Reminder: Upcoming Booking',
        'booking_reminder',
        {
          name: user.name,
          amenity: amenity.name,
          date: booking.date,
          time: booking.startTime,
          cancelUrl,
        },
      );

      await this.bookingsService.markReminderSent(booking.id);
      this.logger.log(`Reminder sent to ${user.email} for booking ${booking.id}`);
    } catch (e) {
      this.logger.error(`Failed to send reminder for booking ${booking.id}`, e);
    }
  }
}
