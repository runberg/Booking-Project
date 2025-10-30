import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, Like } from 'typeorm';
import { Booking } from './booking.entity';
import { AmenitiesService } from '../amenities/amenities.service';
import { UsersService } from '../users/users.service';
import { BookingLog } from './booking-log.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private amenitiesService: AmenitiesService,
    private usersService: UsersService,
    @InjectRepository(BookingLog)
    private logsRepo: Repository<BookingLog>,
  ) {}

  async create(data: { userId: string; amenityId: string; date: string; startTime: string; slotLength: number }) {
    const booking = this.bookingsRepo.create(data);
    const saved = await this.bookingsRepo.save(booking);
    await this.writeLog('create', saved);
    return saved;
  }

  async listForUser(userId: string) {
    return this.bookingsRepo.find({ where: { userId }, order: { date: 'ASC', startTime: 'ASC' } });
  }

  async listForAmenityOnDate(amenityId: string, date: string) {
    return this.bookingsRepo.find({ where: { amenityId, date }, order: { startTime: 'ASC' } });
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

  async countForUserInRange(params: { userId: string; amenityId: string; startDate: string; endDate: string }) {
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
    return this.bookingsRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async listUpcoming(limit = 10) {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowKey = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Query next bookings, excluding past
    const items = await this.bookingsRepo
      .createQueryBuilder('b')
      .where('b.date > :today', { today: todayKey })
      .orWhere('(b.date = :today AND b.startTime >= :startTime)', { today: todayKey, startTime: nowKey })
      .orderBy('b.date', 'ASC')
      .addOrderBy('b.startTime', 'ASC')
      .limit(limit)
      .getMany();

    // Map with amenity and user details
    const allAmenities = await this.amenitiesService.listAll();
    const amenityById = new Map(allAmenities.map((a) => [a.id, a]));

    const result = [] as Array<{ id: string; amenityName: string; date: string; startTime: string; slotLength: number; userName: string; building: string; apartmentNumber: string }>;
    for (const b of items) {
      const user = await this.usersService.findById(b.userId);
      const amenity = amenityById.get(b.amenityId);
      result.push({
        id: b.id,
        amenityName: amenity?.name ?? 'Amenity',
        date: b.date,
        startTime: b.startTime,
        slotLength: b.slotLength,
        userName: user?.name ?? 'User',
        building: user?.building ?? '',
        apartmentNumber: user?.apartmentNumber ?? '',
      });
    }
    return result;
  }

  private async writeLog(action: 'create' | 'delete', b: Booking) {
    const user = await this.usersService.findById(b.userId);
    const amenity = (await this.amenitiesService.listAll()).find((a) => a.id === b.amenityId);
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

  async listLogs(params: { page: number; pageSize: number; sortBy?: string; sortDir?: 'ASC' | 'DESC'; q?: string; action?: string; userEmail?: string; userName?: string; amenityName?: string; building?: string; apartmentNumber?: string; date?: string; startTime?: string; slotLength?: number; dateFrom?: string; dateTo?: string }) {
    const { page, pageSize, sortBy = 'createdAt', sortDir = 'DESC', q, action, userEmail, userName, amenityName, building, apartmentNumber, date, startTime, slotLength, dateFrom, dateTo } = params;
    await this.pruneOldLogs(90);
    const where: FindOptionsWhere<BookingLog> = {} as any;
    if (action) (where as any).action = action;
    if (userEmail) (where as any).userEmail = Like(`%${userEmail}%`);
    if (userName) (where as any).userName = Like(`%${userName}%`);
    if (amenityName) (where as any).amenityName = Like(`%${amenityName}%`);
    if (building) (where as any).building = Like(`%${building}%`);
    if (apartmentNumber) (where as any).apartmentNumber = Like(`%${apartmentNumber}%`);
    if (date) (where as any).date = date;
    if (startTime) (where as any).startTime = startTime;
    if (slotLength) (where as any).slotLength = slotLength as any;
    // Use query builder to support createdAt range filter
    const qb = this.logsRepo.createQueryBuilder('l');
    // where object fields
    Object.entries(where).forEach(([k, v]) => {
      if (v == null) return;
      if (typeof v === 'string' && v.includes('%')) {
        qb.andWhere(`l.${k} LIKE :${k}`, { [k]: v });
      } else {
        qb.andWhere(`l.${k} = :${k}`, { [k]: v });
      }
    });
    if (dateFrom) {
      qb.andWhere('l.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('l.createdAt <= :dateTo', { dateTo });
    }
    if (q) {
      qb.andWhere(
        `(l.action LIKE :q OR l.userEmail LIKE :q OR l.userName LIKE :q OR l.amenityName LIKE :q OR l.building LIKE :q OR l.apartmentNumber LIKE :q OR l.date LIKE :q OR l.startTime LIKE :q)`,
        { q: `%${q}%` },
      );
    }
    qb.orderBy(`l.${sortBy}`, sortDir as any)
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async exportLogsCsv(params: { sortBy?: string; sortDir?: 'ASC' | 'DESC'; q?: string; action?: string; userEmail?: string; userName?: string; amenityName?: string; building?: string; apartmentNumber?: string; date?: string; startTime?: string; slotLength?: number; dateFrom?: string; dateTo?: string }) {
    const { sortBy = 'createdAt', sortDir = 'DESC', q, action, userEmail, userName, amenityName, building, apartmentNumber, date, startTime, slotLength, dateFrom, dateTo } = params;
    const where: FindOptionsWhere<BookingLog> = {} as any;
    if (action) (where as any).action = action;
    if (userEmail) (where as any).userEmail = Like(`%${userEmail}%`);
    if (userName) (where as any).userName = Like(`%${userName}%`);
    if (amenityName) (where as any).amenityName = Like(`%${amenityName}%`);
    if (building) (where as any).building = Like(`%${building}%`);
    if (apartmentNumber) (where as any).apartmentNumber = Like(`%${apartmentNumber}%`);
    if (date) (where as any).date = date;
    if (startTime) (where as any).startTime = startTime;
    if (slotLength) (where as any).slotLength = slotLength as any;
    const qb = this.logsRepo.createQueryBuilder('l');
    Object.entries(where).forEach(([k, v]) => {
      if (v == null) return;
      if (typeof v === 'string' && v.includes('%')) {
        qb.andWhere(`l.${k} LIKE :${k}`, { [k]: v });
      } else {
        qb.andWhere(`l.${k} = :${k}`, { [k]: v });
      }
    });
    if (dateFrom) qb.andWhere('l.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('l.createdAt <= :dateTo', { dateTo });
    if (q) {
      qb.andWhere(
        `(l.action LIKE :q OR l.userEmail LIKE :q OR l.userName LIKE :q OR l.amenityName LIKE :q OR l.building LIKE :q OR l.apartmentNumber LIKE :q OR l.date LIKE :q OR l.startTime LIKE :q)`,
        { q: `%${q}%` },
      );
    }
    const rows = await qb.orderBy(`l.${sortBy}`, sortDir as any).take(10000).getMany();
    const headers = ['Time','Action','Amenity','Date','Start','Length','User','Email','Building','Apartment'];
    const lines = [headers.join(',')];
    for (const l of rows) {
      const vals = [
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
      ].map((v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
      });
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  private async pruneOldLogs(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    await this.logsRepo.createQueryBuilder()
      .delete()
      .from(BookingLog)
      .where('createdAt < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }
}


