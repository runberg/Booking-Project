import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder, IsNull, In } from 'typeorm';
import { Booking } from './booking.entity';
import { BookingCancelToken } from './booking-cancel-token.entity';
import { BookingCheckinToken } from './booking-checkin-token.entity';
import { AmenitiesService } from '../amenities/amenities.service';
import { UsersService } from '../users/users.service';
import { BookingLog } from './booking-log.entity';

type LogFilterParams = {
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  q?: string;
  action?: string;
  userEmail?: string;
  userName?: string;
  amenityName?: string;
  building?: string;
  apartmentNumber?: string;
  date?: string;
  startTime?: string;
  slotLength?: number;
  dateFrom?: string;
  dateTo?: string;
};

const SORTABLE_LOG_COLUMNS = new Set([
  'createdAt',
  'action',
  'userEmail',
  'userName',
  'amenityName',
  'building',
  'apartmentNumber',
  'date',
  'startTime',
  'slotLength',
  'ipAddress',
]);

@Injectable()
export class BookingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(BookingCancelToken)
    private readonly cancelTokenRepo: Repository<BookingCancelToken>,
    @InjectRepository(BookingCheckinToken)
    private readonly checkinTokenRepo: Repository<BookingCheckinToken>,
    private readonly amenitiesService: AmenitiesService,
    private readonly usersService: UsersService,
    @InjectRepository(BookingLog)
    private readonly logsRepo: Repository<BookingLog>,
  ) {}

  async onModuleInit() {
    await this.pruneOldLogs(90);
  }

  async create(data: {
    userId: string;
    amenityId: string;
    date: string;
    startTime: string;
    slotLength: number;
    ipAddress?: string;
  }) {
    const { ipAddress, ...bookingData } = data;
    const booking = this.bookingsRepo.create(bookingData);
    const saved = await this.bookingsRepo.save(booking);
    await this.writeLog('create', saved, ipAddress);
    return saved;
  }

  async listUpcomingForUser(userId: string) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    return this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.userId = :userId', { userId })
      .andWhere(
        '(b.date > :today OR (b.date = :today AND b.startTime >= :startTime))',
        { today: todayKey, startTime: nowKey },
      )
      .orderBy('b.date', 'ASC')
      .addOrderBy('b.startTime', 'ASC')
      .getMany();
  }

  async listPastForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: Booking[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const qb = this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.userId = :userId', { userId })
      .andWhere(
        '(b.date < :today OR (b.date = :today AND b.startTime < :startTime))',
        { today: todayKey, startTime: nowKey },
      )
      .orderBy('b.date', 'DESC')
      .addOrderBy('b.startTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async listForAmenityOnDate(amenityId: string, date: string) {
    return this.bookingsRepo.find({
      where: { amenityId, date },
      order: { startTime: 'ASC' },
    });
  }

  async deleteIfOwned(id: string, userId: string, ipAddress?: string) {
    const b = await this.bookingsRepo.findOne({ where: { id } });
    if (b?.userId !== userId) {
      return { affected: 0 };
    }
    const res = await this.bookingsRepo.delete(id);
    if (res.affected) {
      await this.writeLog('delete', b, ipAddress);
    }
    return res;
  }

  async countForUserInRange(params: {
    userId: string;
    amenityId: string;
    startDate: string;
    endDate: string;
  }) {
    const { userId, amenityId, startDate, endDate } = params;
    return this.bookingsRepo.count({
      where: {
        userId,
        amenityId,
        date: Between(startDate, endDate),
      },
    });
  }

  async findLatestForUser(userId: string) {
    return this.bookingsRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listUpcoming(limit = 10) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const items = await this.bookingsRepo
      .createQueryBuilder('b')
      .where(
        '(b.date > :today OR (b.date = :today AND b.startTime >= :startTime))',
        { today: todayKey, startTime: nowKey },
      )
      .orderBy('b.date', 'ASC')
      .addOrderBy('b.startTime', 'ASC')
      .limit(limit)
      .getMany();

    const [allAmenities, users] = await Promise.all([
      this.amenitiesService.listAll(),
      this.usersService.findByIds([...new Set(items.map((b) => b.userId))]),
    ]);
    const amenityById = new Map(allAmenities.map((a) => [a.id, a]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return items.map((b) => {
      const user = userById.get(b.userId);
      const amenity = amenityById.get(b.amenityId);
      return {
        id: b.id,
        amenityName: amenity?.name ?? 'Amenity',
        date: b.date,
        startTime: b.startTime,
        slotLength: b.slotLength,
        userName: user?.name ?? 'User',
        building: user?.building ?? '',
        apartmentNumber: user?.apartmentNumber ?? '',
      };
    });
  }

  async getSecurityDashboard() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const upcomingBookings = await this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.date > :today', { today: todayKey })
      .orWhere('(b.date = :today AND b.startTime >= :startTime)', {
        today: todayKey,
        startTime: nowKey,
      })
      .orderBy('b.date', 'ASC')
      .addOrderBy('b.startTime', 'ASC')
      .getMany();

    // Over-fetches intentionally: the DB query gets all bookings that have started
    // today; the precise "still running" check (startMinutes + slotLength > nowMinutes)
    // is applied in the map below to avoid a complex DB expression.
    const currentBookings = await this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.date = :today', { today: todayKey })
      .andWhere('b.startTime <= :nowKey', { nowKey })
      .getMany();

    const allBookings = [...currentBookings, ...upcomingBookings];
    const allUserIds = [...new Set(allBookings.map((b) => b.userId))];

    const [allAmenities, users] = await Promise.all([
      this.amenitiesService.listAll(),
      this.usersService.findByIds(allUserIds),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));

    const toBookingInfo = (b: (typeof allBookings)[0]) => {
      const user = userById.get(b.userId);
      return {
        userName: user?.name ?? '',
        userEmail: user?.email ?? '',
        building: user?.building ?? '',
        apartmentNumber: user?.apartmentNumber ?? '',
        startTime: b.startTime,
        slotLength: b.slotLength,
        date: b.date,
      };
    };

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return allAmenities.map((amenity) => {
      const amenityCurrent = currentBookings.find((b) => {
        if (b.amenityId !== amenity.id) return false;
        const [h, m] = b.startTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + b.slotLength;
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      });

      const amenityNext = upcomingBookings.find(
        (b) => b.amenityId === amenity.id,
      );

      return {
        id: amenity.id,
        name: amenity.name,
        currentBooking: amenityCurrent ? toBookingInfo(amenityCurrent) : null,
        nextBooking: amenityNext ? toBookingInfo(amenityNext) : null,
      };
    });
  }

  // ── Reminder helpers ─────────────────────────────────────────────────────

  async findUnremindedUpcoming(): Promise<Booking[]> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.reminderSentAt IS NULL')
      .andWhere('b.date >= :today', { today: todayStr })
      .getMany();
  }

  async markReminderSent(bookingId: string): Promise<void> {
    await this.bookingsRepo.update(bookingId, { reminderSentAt: new Date() });
  }

  // ── Cancel token ─────────────────────────────────────────────────────────

  async createCancelToken(bookingId: string, expiresAt: Date): Promise<string> {
    const { randomBytes } = await import('node:crypto');
    const token = randomBytes(32).toString('hex');
    await this.cancelTokenRepo.save(
      this.cancelTokenRepo.create({ bookingId, token, expiresAt }),
    );
    return token;
  }

  async previewCancelToken(token: string): Promise<{
    amenityName: string;
    date: string;
    startTime: string;
    slotLength: number;
    userName: string;
  } | null> {
    const cancelToken = await this.cancelTokenRepo.findOne({
      where: { token, usedAt: IsNull() },
    });
    if (!cancelToken || cancelToken.expiresAt < new Date()) return null;

    const booking = await this.bookingsRepo.findOne({
      where: { id: cancelToken.bookingId },
    });
    if (!booking) return null;

    const [user, amenity] = await Promise.all([
      this.usersService.findById(booking.userId),
      this.amenitiesService.findOne(booking.amenityId),
    ]);

    return {
      amenityName: amenity?.name ?? 'Amenity',
      date: booking.date,
      startTime: booking.startTime,
      slotLength: booking.slotLength,
      userName: user?.name ?? '',
    };
  }

  async cancelByToken(
    token: string,
  ): Promise<{ ok: boolean; message: string }> {
    const cancelToken = await this.cancelTokenRepo.findOne({
      where: { token, usedAt: IsNull() },
    });
    if (!cancelToken)
      return { ok: false, message: 'Invalid or already used link.' };
    if (cancelToken.expiresAt < new Date())
      return { ok: false, message: 'This cancel link has expired.' };

    const booking = await this.bookingsRepo.findOne({
      where: { id: cancelToken.bookingId },
    });
    if (!booking) return { ok: false, message: 'Booking not found.' };

    await this.bookingsRepo.delete(booking.id);
    await this.cancelTokenRepo.update(cancelToken.id, { usedAt: new Date() });
    await this.writeLog('delete', booking);

    return { ok: true, message: 'Your booking has been cancelled.' };
  }

  // ── Activity event log ───────────────────────────────────────────────────

  async logEvent(
    action:
      | 'reminder_sent'
      | 'reminder_failed'
      | 'checkin_email_sent'
      | 'checkin_email_failed'
      | 'checked_in'
      | 'confirmation_failed',
    bookingId: string,
  ): Promise<void> {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) return;
    await this.writeLog(action, booking);
  }

  async listNoShows(page: number, pageSize: number) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const qb = this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.checkinEmailSentAt IS NOT NULL')
      .andWhere('b.checkedInAt IS NULL')
      .andWhere(
        '(b.date < :today OR (b.date = :today AND b.startTime < :nowTime))',
        { today: todayStr, nowTime },
      )
      .orderBy('b.date', 'DESC')
      .addOrderBy('b.startTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [bookings, total] = await qb.getManyAndCount();

    const [allAmenities, users] = await Promise.all([
      this.amenitiesService.listAll(),
      this.usersService.findByIds([...new Set(bookings.map((b) => b.userId))]),
    ]);
    const amenityById = new Map(allAmenities.map((a) => [a.id, a]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const items = bookings.map((b) => {
      const user = userById.get(b.userId);
      const amenity = amenityById.get(b.amenityId);
      return {
        id: b.id,
        action: 'no_show' as const,
        amenityName: amenity?.name ?? 'Amenity',
        date: b.date,
        startTime: b.startTime,
        slotLength: b.slotLength,
        userId: b.userId,
        userEmail: user?.email ?? '',
        userName: user?.name ?? '',
        building: user?.building ?? '',
        apartmentNumber: user?.apartmentNumber ?? '',
        ipAddress: null,
        createdAt: b.checkinEmailSentAt,
      };
    });

    return { items, total, page, pageSize };
  }

  // ── Check-in helpers ─────────────────────────────────────────────────────

  async findUnsentCheckinEmails(): Promise<Booking[]> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.checkinEmailSentAt IS NULL')
      .andWhere('b.date >= :today', { today: todayStr })
      .getMany();
  }

  async markCheckinEmailSent(bookingId: string): Promise<void> {
    await this.bookingsRepo.update(bookingId, {
      checkinEmailSentAt: new Date(),
    });
  }

  async createCheckinToken(
    bookingId: string,
    expiresAt: Date,
  ): Promise<string> {
    const { randomBytes } = await import('node:crypto');
    const token = randomBytes(32).toString('hex');
    await this.checkinTokenRepo.save(
      this.checkinTokenRepo.create({ bookingId, token, expiresAt }),
    );
    return token;
  }

  async previewCheckinToken(token: string): Promise<{
    amenityName: string;
    date: string;
    startTime: string;
    slotLength: number;
    userName: string;
  } | null> {
    const checkinToken = await this.checkinTokenRepo.findOne({
      where: { token, usedAt: IsNull() },
    });
    if (!checkinToken || checkinToken.expiresAt < new Date()) return null;

    const booking = await this.bookingsRepo.findOne({
      where: { id: checkinToken.bookingId },
    });
    if (!booking) return null;

    const [user, amenity] = await Promise.all([
      this.usersService.findById(booking.userId),
      this.amenitiesService.findOne(booking.amenityId),
    ]);

    return {
      amenityName: amenity?.name ?? 'Amenity',
      date: booking.date,
      startTime: booking.startTime,
      slotLength: booking.slotLength,
      userName: user?.name ?? '',
    };
  }

  async checkinByToken(
    token: string,
    qrToken: string,
  ): Promise<{ ok: boolean; message: string }> {
    const checkinToken = await this.checkinTokenRepo.findOne({
      where: { token, usedAt: IsNull() },
    });
    if (!checkinToken)
      return { ok: false, message: 'Invalid or expired check-in link.' };
    if (checkinToken.expiresAt < new Date())
      return { ok: false, message: 'This check-in link has expired.' };

    const booking = await this.bookingsRepo.findOne({
      where: { id: checkinToken.bookingId },
    });
    if (!booking) return { ok: false, message: 'Booking not found.' };

    const amenity = await this.amenitiesService.findOne(booking.amenityId);
    if (!amenity?.qrToken || amenity.qrToken !== qrToken) {
      return {
        ok: false,
        message:
          'QR code does not match the booked amenity. Please make sure you are at the correct location.',
      };
    }

    await this.bookingsRepo.update(booking.id, { checkedInAt: new Date() });
    await this.checkinTokenRepo.update(checkinToken.id, { usedAt: new Date() });
    await this.writeLog('checked_in', booking);

    return { ok: true, message: 'Check-in successful!' };
  }

  private async writeLog(
    action: BookingLog['action'],
    b: Booking,
    ipAddress?: string,
  ) {
    const [user, amenity] = await Promise.all([
      this.usersService.findById(b.userId),
      this.amenitiesService.findOne(b.amenityId),
    ]);
    const log = this.logsRepo.create({
      action,
      bookingId: b.id,
      amenityName: amenity?.name ?? 'Amenity',
      date: b.date,
      startTime: b.startTime,
      slotLength: b.slotLength,
      userId: b.userId,
      userEmail: user?.email ?? '',
      userName: user?.name ?? '',
      building: user?.building ?? '',
      apartmentNumber: user?.apartmentNumber ?? '',
      ipAddress: ipAddress ?? null,
    });
    await this.logsRepo.save(log);
  }

  private buildLogQuery(
    params: LogFilterParams,
  ): SelectQueryBuilder<BookingLog> {
    const {
      sortBy = 'createdAt',
      sortDir = 'DESC',
      q,
      action,
      userEmail,
      userName,
      amenityName,
      building,
      apartmentNumber,
      date,
      startTime,
      slotLength,
      dateFrom,
      dateTo,
    } = params;

    const safeSortBy = SORTABLE_LOG_COLUMNS.has(sortBy) ? sortBy : 'createdAt';
    const qb = this.logsRepo.createQueryBuilder('l');

    if (action) qb.andWhere('l.action = :action', { action });
    if (userEmail)
      qb.andWhere('l.userEmail LIKE :userEmail', {
        userEmail: `%${userEmail}%`,
      });
    if (userName)
      qb.andWhere('l.userName LIKE :userName', { userName: `%${userName}%` });
    if (amenityName)
      qb.andWhere('l.amenityName LIKE :amenityName', {
        amenityName: `%${amenityName}%`,
      });
    if (building)
      qb.andWhere('l.building LIKE :building', { building: `%${building}%` });
    if (apartmentNumber)
      qb.andWhere('l.apartmentNumber LIKE :apartmentNumber', {
        apartmentNumber: `%${apartmentNumber}%`,
      });
    if (date) qb.andWhere('l.date = :date', { date });
    if (startTime) qb.andWhere('l.startTime = :startTime', { startTime });
    if (slotLength != null)
      qb.andWhere('l.slotLength = :slotLength', { slotLength });
    if (dateFrom) qb.andWhere('l.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('l.createdAt <= :dateTo', { dateTo });
    if (q) {
      qb.andWhere(
        '(l.action LIKE :q OR l.userEmail LIKE :q OR l.userName LIKE :q OR l.amenityName LIKE :q OR l.building LIKE :q OR l.apartmentNumber LIKE :q OR l.date LIKE :q OR l.startTime LIKE :q)',
        { q: `%${q}%` },
      );
    }

    qb.orderBy(`l.${safeSortBy}`, sortDir);
    return qb;
  }

  async listLogs(params: LogFilterParams & { page: number; pageSize: number }) {
    const { page, pageSize, ...filterParams } = params;
    const qb = this.buildLogQuery(filterParams);
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async exportLogsCsv(params: LogFilterParams): Promise<string> {
    const rows = await this.buildLogQuery(params).take(10000).getMany();

    const escape = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? '"' + v.replaceAll('"', '""') + '"'
        : v;

    const headers = [
      'Time',
      'Event',
      'User',
      'Email',
      'Building',
      'Apartment',
      'IP',
      'Amenity',
      'Booking date',
      'Slot start',
      'Slot length (min)',
    ];
    const lines = [headers.join(',')];
    for (const l of rows) {
      lines.push(
        [
          new Date(l.createdAt).toISOString(),
          l.action,
          l.userName,
          l.userEmail,
          l.building,
          l.apartmentNumber,
          l.ipAddress ?? '',
          l.amenityName ?? '',
          l.date ?? '',
          l.startTime ?? '',
          l.slotLength == null ? '' : String(l.slotLength),
        ]
          .map((v) => escape(String(v ?? '')))
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async findAllUpcomingForAdmin() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const items = await this.bookingsRepo
      .createQueryBuilder('b')
      .where(
        '(b.date > :today OR (b.date = :today AND b.startTime >= :startTime))',
        { today: todayKey, startTime: nowKey },
      )
      .orderBy('b.date', 'ASC')
      .addOrderBy('b.startTime', 'ASC')
      .getMany();

    return this.enrichBookings(items);
  }

  async findByIdsWithDetails(ids: string[]) {
    if (ids.length === 0) return [];
    const items = await this.bookingsRepo.findBy({ id: In(ids) });
    return this.enrichBookings(items);
  }

  async deleteByIdForAdmin(id: string): Promise<void> {
    const booking = await this.bookingsRepo.findOne({ where: { id } });
    if (!booking) return;
    await this.cancelTokenRepo
      .createQueryBuilder()
      .delete()
      .where('bookingId = :id', { id })
      .execute();
    await this.checkinTokenRepo
      .createQueryBuilder()
      .delete()
      .where('bookingId = :id', { id })
      .execute();
    await this.bookingsRepo.delete(id);
    await this.writeLog('delete', booking);
  }

  private async enrichBookings(items: Booking[]) {
    if (items.length === 0) return [];
    const [allAmenities, users] = await Promise.all([
      this.amenitiesService.listAll(),
      this.usersService.findByIds([...new Set(items.map((b) => b.userId))]),
    ]);
    const amenityById = new Map(allAmenities.map((a) => [a.id, a]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return items.map((b) => {
      const user = userById.get(b.userId);
      const amenity = amenityById.get(b.amenityId);
      return {
        id: b.id,
        amenityId: b.amenityId,
        amenityName: amenity?.name ?? 'Unknown amenity',
        date: b.date,
        startTime: b.startTime,
        slotLength: b.slotLength,
        userId: b.userId,
        userName: user?.name ?? 'Unknown user',
        userEmail: user?.email ?? '',
        userBuilding: user?.building ?? '',
        userApartmentNumber: user?.apartmentNumber ?? '',
      };
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const bookings = await this.bookingsRepo.find({
      where: { userId },
      select: ['id'],
    });
    if (bookings.length > 0) {
      const ids = bookings.map((b) => b.id);
      await this.cancelTokenRepo
        .createQueryBuilder()
        .delete()
        .where('bookingId IN (:...ids)', { ids })
        .execute();
      await this.checkinTokenRepo
        .createQueryBuilder()
        .delete()
        .where('bookingId IN (:...ids)', { ids })
        .execute();
      await this.bookingsRepo.delete({ userId });
    }
  }

  private async pruneOldLogs(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    await this.logsRepo
      .createQueryBuilder()
      .delete()
      .from(BookingLog)
      .where('createdAt < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }
}
