import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AmenitiesService } from '../../shared/amenities/amenities.service';
import { BookingRestriction } from '../../shared/restrictions/booking-restriction.entity';
import { Booking } from '../../shared/bookings/booking.entity';

@Controller('amenities')
export class AmenitiesController {
  constructor(
    private readonly amenitiesService: AmenitiesService,
    @InjectRepository(BookingRestriction)
    private readonly restrictionsRepo: Repository<BookingRestriction>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
  ) {}

  @Get()
  async listActive() {
    const amenities = await this.amenitiesService.listActive();
    const restrictionIds = Array.from(
      new Set(amenities.map((a) => a.bookingRestrictionId).filter(Boolean)),
    ) as string[];
    const restrictions = restrictionIds.length
      ? await this.restrictionsRepo.find({ where: { id: In(restrictionIds) } })
      : [];
    const idToRestriction = new Map(restrictions.map((r) => [r.id, r]));

    return amenities.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      openTime: a.openTime,
      closeTime: a.closeTime,
      slotLength: a.slotLength,
      imageUrl: a.imageUrl,
      daysAhead:
        idToRestriction.get(a.bookingRestrictionId || '')?.daysAhead ?? 14,
      maxPerPeriod:
        idToRestriction.get(a.bookingRestrictionId || '')?.maxPerPeriod ?? null,
      maxPerDay:
        idToRestriction.get(a.bookingRestrictionId || '')?.maxPerDay ?? null,
    }));
  }

  @Get('availability')
  async listAvailability() {
    const amenities = await this.amenitiesService.listActive();

    const restrictionIds = Array.from(
      new Set(amenities.map((a) => a.bookingRestrictionId).filter(Boolean)),
    ) as string[];
    const restrictions = restrictionIds.length
      ? await this.restrictionsRepo.find({ where: { id: In(restrictionIds) } })
      : [];
    const idToRestriction = new Map(restrictions.map((r) => [r.id, r]));

    const now = new Date();
    const todayKey = toDateKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const result: Array<{
      id: string;
      name: string;
      status: 'free' | 'booked' | 'closed';
      freeUntil?: string | null;
      nextAvailable?: string | null;
      availableForDays?: number | null;
    }> = [];

    for (const a of amenities) {
      const open = parseTime(a.openTime || '09:00');
      const close = parseTime(a.closeTime || '22:00');
      const slotLength = a.slotLength || 60;
      const daysAhead =
        idToRestriction.get(a.bookingRestrictionId || '')?.daysAhead ?? 14;

      const getBookedSet = async (dateKey: string) => {
        const list = await this.bookingsRepo.find({
          where: { amenityId: a.id, date: dateKey },
        });
        return new Set(list.map((b) => b.startTime));
      };

      if (nowMinutes < open || nowMinutes >= close) {
        const searchStart = nowMinutes < open ? new Date(now) : addDays(now, 1);
        let found: { date: string; time: string } | null = null;
        for (let d = 0; d <= daysAhead && !found; d++) {
          const day = addDays(searchStart, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSet(dateKey);
          for (let t = open; t < close; t += slotLength) {
            if (!booked.has(toHHmm(t))) {
              found = { date: dateKey, time: toHHmm(t) };
              break;
            }
          }
        }
        result.push({
          id: a.id,
          name: a.name,
          status: 'closed',
          nextAvailable: found ? `${found.date} ${found.time}` : null,
          freeUntil: null,
          availableForDays: null,
        });
        continue;
      }

      const bookedToday = await getBookedSet(todayKey);
      const currentSlotStart =
        open +
        Math.floor(Math.max(0, nowMinutes - open) / slotLength) * slotLength;
      const isCurrentBooked = bookedToday.has(toHHmm(currentSlotStart));

      const findNextBooked = async (): Promise<{
        date: string;
        time: string;
      } | null> => {
        for (
          let t = Math.max(currentSlotStart, open);
          t < close;
          t += slotLength
        ) {
          if (bookedToday.has(toHHmm(t)))
            return { date: todayKey, time: toHHmm(t) };
        }
        for (let d = 1; d <= daysAhead; d++) {
          const day = addDays(now, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSet(dateKey);
          for (let t = open; t < close; t += slotLength) {
            if (booked.has(toHHmm(t)))
              return { date: dateKey, time: toHHmm(t) };
          }
        }
        return null;
      };

      const findNextFree = async (): Promise<{
        date: string;
        time: string;
      } | null> => {
        const startToday = ceilToSlot(nowMinutes, open, slotLength);
        for (let t = startToday; t < close; t += slotLength) {
          if (!bookedToday.has(toHHmm(t)))
            return { date: todayKey, time: toHHmm(t) };
        }
        for (let d = 1; d <= daysAhead; d++) {
          const day = addDays(now, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSet(dateKey);
          for (let t = open; t < close; t += slotLength) {
            if (!booked.has(toHHmm(t)))
              return { date: dateKey, time: toHHmm(t) };
          }
        }
        return null;
      };

      if (isCurrentBooked) {
        const nf = await findNextFree();
        result.push({
          id: a.id,
          name: a.name,
          status: 'booked',
          nextAvailable: nf ? `${nf.date} ${nf.time}` : null,
          freeUntil: null,
          availableForDays: null,
        });
        continue;
      }

      const nextBooked = await findNextBooked();
      if (!nextBooked) {
        result.push({
          id: a.id,
          name: a.name,
          status: 'free',
          freeUntil: null,
          nextAvailable: null,
          availableForDays: daysAhead,
        });
        continue;
      }

      const [nbH, nbM] = nextBooked.time.split(':').map(Number);
      const minutesUntil =
        nextBooked.date === todayKey
          ? nbH * 60 + nbM - nowMinutes
          : Number.MAX_SAFE_INTEGER;
      if (minutesUntil < 20) {
        const nf = await findNextFree();
        result.push({
          id: a.id,
          name: a.name,
          status: 'booked',
          nextAvailable: nf ? `${nf.date} ${nf.time}` : null,
          freeUntil: null,
          availableForDays: null,
        });
      } else {
        result.push({
          id: a.id,
          name: a.name,
          status: 'free',
          freeUntil: `${nextBooked.date} ${nextBooked.time}`,
          nextAvailable: null,
          availableForDays: null,
        });
      }
    }

    return result;
  }
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function toHHmm(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function ceilToSlot(mins: number, open: number, slot: number): number {
  if (mins <= open) return open;
  const delta = mins - open;
  return open + Math.ceil(delta / slot) * slot;
}
