import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from '../bookings/bookings.service';
import { AmenitiesService } from '../amenities/amenities.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { Booking } from '../bookings/booking.entity';

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);
  private sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly amenitiesService: AmenitiesService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  onModuleInit() {
    const intervalMs =
      Number(this.configService.get('REMINDER_CHECK_INTERVAL_MINUTES', '10')) *
      60_000;

    // Short startup delay so DB connections are ready
    setTimeout(() => {
      void this.runCheck();
      void this.runCheckinCheck();
      this.runApprovalNotificationCheck().catch(() => {});
      setInterval(() => {
        void this.runCheck();
        void this.runCheckinCheck();
      }, intervalMs);
      setInterval(
        () => { this.runApprovalNotificationCheck().catch(() => {}); },
        3_600_000, // every hour
      );
    }, 20_000);
  }

  private async runCheck() {
    try {
      const hoursRaw = await this.settingsService.get('reminder_hours_before');
      const hoursBefore = Number(
        hoursRaw ?? this.configService.get('REMINDER_HOURS_BEFORE', '24'),
      );
      const now = new Date();
      const windowEndMs = now.getTime() + hoursBefore * 3_600_000;
      const minCreatedAtMs = now.getTime() - hoursBefore * 3_600_000;

      const candidates = await this.bookingsService.findUnremindedUpcoming();

      for (const booking of candidates) {
        const bookingDateTime = new Date(
          `${booking.date}T${booking.startTime}:00`,
        );
        const bookingMs = bookingDateTime.getTime();

        if (
          bookingMs > now.getTime() &&
          bookingMs <= windowEndMs &&
          new Date(booking.createdAt).getTime() <= minCreatedAtMs
        ) {
          await this.sendReminder(booking, bookingDateTime);
          await this.sleep(200);
        }
      }
    } catch (e: unknown) {
      this.logger.error('Reminder check failed', e);
    }
  }

  private async runApprovalNotificationCheck() {
    try {
      const approvalRequired = await this.settingsService.get('admin_approval_required');
      if (approvalRequired !== 'true') return;

      const pending = await this.usersService.findPendingApproval();
      if (pending.length === 0) return;

      const admins = await this.usersService.findAdminsAndSupers();
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', '');
      const adminUrl = `${frontendUrl}/admin`;

      for (const admin of admins) {
        await this.emailService.sendTemplateEmail(
          admin.email,
          'Users awaiting admin approval',
          'admin_approval_notification',
          { count: String(pending.length), adminUrl },
        );
      }
      this.logger.log(
        `Approval notification sent to ${admins.length} admin(s) for ${pending.length} pending user(s)`,
      );
    } catch (e: unknown) {
      this.logger.error('Approval notification check failed', e);
    }
  }

  private async runCheckinCheck() {
    try {
      const checkinEnabled = await this.settingsService.get('checkin_enabled');
      if (checkinEnabled === 'false') return;

      const minutesRaw = await this.settingsService.get(
        'checkin_minutes_before',
      );
      const minutesBefore = Number(
        minutesRaw ?? this.configService.get('CHECKIN_MINUTES_BEFORE', '30'),
      );
      const now = new Date();
      const windowEndMs = now.getTime() + minutesBefore * 60_000;

      const candidates = await this.bookingsService.findUnsentCheckinEmails();

      for (const booking of candidates) {
        const bookingDateTime = new Date(
          `${booking.date}T${booking.startTime}:00`,
        );
        const bookingMs = bookingDateTime.getTime();
        if (bookingMs > now.getTime() && bookingMs <= windowEndMs) {
          await this.sendCheckinEmail(booking);
        }
      }
    } catch (e: unknown) {
      this.logger.error('Check-in email check failed', e);
    }
  }

  private async sendCheckinEmail(booking: Booking) {
    const [user, amenity] = await Promise.all([
      this.usersService.findById(booking.userId),
      this.amenitiesService.findOne(booking.amenityId),
    ]);
    if (!user || !amenity) return;

    const expiresAt = new Date(Date.now() + 3_600_000);
    const token = await this.bookingsService.createCheckinToken(
      booking.id,
      expiresAt,
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', '');
    const checkinUrl = `${frontendUrl}/checkin/${token}`;

    try {
      await this.emailService.sendTemplateEmail(
        user.email,
        'Time to check in',
        'booking_checkin',
        {
          name: user.name,
          amenity: amenity.name,
          date: booking.date,
          time: booking.startTime,
          checkinUrl,
        },
      );
      await this.bookingsService.markCheckinEmailSent(booking.id);
      await this.bookingsService.logEvent('checkin_email_sent', booking.id);
      this.logger.log(
        `Check-in email sent to ${user.email} for booking ${booking.id}`,
      );
    } catch (e: unknown) {
      this.logger.error(
        `Failed to send check-in email for booking ${booking.id}`,
        e,
      );
      // Mark as sent anyway to prevent infinite retry loops; log the failure
      await this.bookingsService.markCheckinEmailSent(booking.id);
      await this.bookingsService.logEvent('checkin_email_failed', booking.id);
    }
  }

  private async sendReminder(booking: Booking, bookingDateTime: Date) {
    const [user, amenity] = await Promise.all([
      this.usersService.findById(booking.userId),
      this.amenitiesService.findOne(booking.amenityId),
    ]);
    if (!user || !amenity) return;

    const expiresAt = new Date(bookingDateTime);
    const token = await this.bookingsService.createCancelToken(
      booking.id,
      expiresAt,
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', '');
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
      await this.bookingsService.logEvent('reminder_sent', booking.id);
      this.logger.log(
        `Reminder sent to ${user.email} for booking ${booking.id}`,
      );
    } catch (e: unknown) {
      this.logger.error(`Failed to send reminder for booking ${booking.id}`, e);
      // Mark as sent to prevent infinite retry; log the failure
      await this.bookingsService.markReminderSent(booking.id);
      await this.bookingsService.logEvent('reminder_failed', booking.id);
    }
  }
}
