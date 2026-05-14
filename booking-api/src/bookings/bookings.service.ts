import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { Booking } from './booking.entity';
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
]);

@Injectable()
export class BookingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private amenitiesService: AmenitiesService,
    private usersService: UsersService,
    @InjectRepository(BookingLog)
    private logsRepo: Repository<BookingLog>,
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
  }) {
    const booking = this.bookingsRepo.create(data);
    const saved = await this.bookingsRepo.save(booking);
    await this.writeLog('create', saved);
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
  ): Promise<{ items: Booking[]; total: number; page: number; pageSize: number }> {
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

  async deleteIfOwned(id: string, userId: string) {
    const b = await this.bookingsRepo.findOne({ where: { id } });
    if (!b || b.userId !== userId) {
      return { affected: 0 };
    }
    const res = await this.bookingsRepo.delete(id);
    if (res.affected) {
      await this.writeLog('delete', b);
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
      .where('b.date > :today', { today: todayKey })
      .orWhere('(b.date = :today AND b.startTime >= :startTime)', {
        today: todayKey,
        startTime: nowKey,
      })
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

    const toBookingInfo = (b: typeof allBookings[0]) => {
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

      const amenityNext = upcomingBookings.find((b) => b.amenityId === amenity.id);

      return {
        id: amenity.id,
        name: amenity.name,
        currentBooking: amenityCurrent ? toBookingInfo(amenityCurrent) : null,
        nextBooking: amenityNext ? toBookingInfo(amenityNext) : null,
      };
    });
  }

  private async writeLog(action: 'create' | 'delete', b: Booking) {
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

    qb.orderBy(`l.${safeSortBy}`, sortDir as 'ASC' | 'DESC');
    return qb;
  }

  async listLogs(
    params: LogFilterParams & { page: number; pageSize: number },
  ) {
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
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;

    const headers = [
      'Time',
      'Action',
      'Amenity',
      'Date',
      'Start',
      'Length',
      'User',
      'Email',
      'Building',
      'Apartment',
    ];
    const lines = [headers.join(',')];
    for (const l of rows) {
      lines.push(
        [
          new Date(l.createdAt).toISOString(),
          l.action,
          l.amenityName,
          l.date,
          l.startTime,
          String(l.slotLength),
          l.userName,
          l.userEmail,
          l.building,
          l.apartmentNumber,
        ]
          .map((v) => escape(String(v ?? '')))
          .join(','),
      );
    }
    return lines.join('\n');
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
