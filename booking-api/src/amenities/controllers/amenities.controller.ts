import { Controller, Get } from '@nestjs/common';
import { AmenitiesService } from '../amenities.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingRestriction } from '../../restrictions/booking-restriction.entity';
import { Booking } from '../../bookings/booking.entity';

@Controller('amenities')
export class AmenitiesController {
  constructor(
    private amenitiesService: AmenitiesService,
    @InjectRepository(BookingRestriction)
    private restrictionsRepo: Repository<BookingRestriction>,
    @InjectRepository(Booking) private bookingsRepo: Repository<Booking>,
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

    // Preload restrictions to get daysAhead per amenity
    const restrictionIds = Array.from(
      new Set(amenities.map((a) => a.bookingRestrictionId).filter(Boolean)),
    ) as string[];
    const restrictions = restrictionIds.length
      ? await this.restrictionsRepo.find({ where: { id: In(restrictionIds) } })
      : [];
    const idToRestriction = new Map(restrictions.map((r) => [r.id, r]));

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayKey = `${yyyy}-${mm}-${dd}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map((x) => Number(x));
      return h * 60 + m;
    };
    const toHHmm = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const toDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const addDays = (d: Date, n: number) => {
      const c = new Date(d);
      c.setDate(c.getDate() + n);
      return c;
    };
    const ceilToSlot = (mins: number, open: number, slot: number) => {
      if (mins <= open) return open;
      const delta = mins - open;
      return open + Math.ceil(delta / slot) * slot;
    };

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

      // Helper to fetch booked start times for a date
      const getBookedSetForDate = async (dateKey: string) => {
        const list = await this.bookingsRepo.find({
          where: { amenityId: a.id, date: dateKey },
        });
        return new Set(list.map((b) => b.startTime));
      };

      // Determine current status relative to opening hours
      if (nowMinutes < open || nowMinutes >= close) {
        // Closed now. Next available is next opening slot that is not booked within daysAhead.
        // Start search from next slot at next open time (today or tomorrow depending on now)
        const searchStartDate =
          nowMinutes < open ? new Date(now) : addDays(now, 1);
        let found: { date: string; time: string } | null = null;
        for (let d = 0; d <= daysAhead; d++) {
          const day = addDays(searchStartDate, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSetForDate(dateKey);
          for (let t = open; t < close; t += slotLength) {
            const key = toHHmm(t);
            if (!booked.has(key)) {
              found = { date: dateKey, time: key };
              break;
            }
          }
          if (found) break;
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

      // Open now. Build today's slots and booking set
      const bookedToday = await getBookedSetForDate(todayKey);
      const currentSlotStart =
        open +
        Math.floor(Math.max(0, nowMinutes - open) / slotLength) * slotLength;
      const currentKey = toHHmm(currentSlotStart);
      const isCurrentBooked = bookedToday.has(currentKey);

      // Find next booked slot from now onward (today or future days)
      const findNextBooked = async (): Promise<{
        date: string;
        time: string;
      } | null> => {
        // Today from currentSlotStart onwards
        for (
          let t = Math.max(currentSlotStart, open);
          t < close;
          t += slotLength
        ) {
          const key = toHHmm(t);
          if (bookedToday.has(key)) return { date: todayKey, time: key };
        }
        // Future days within daysAhead
        for (let d = 1; d <= daysAhead; d++) {
          const day = addDays(now, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSetForDate(dateKey);
          for (let t = open; t < close; t += slotLength) {
            const key = toHHmm(t);
            if (booked.has(key)) return { date: dateKey, time: key };
          }
        }
        return null;
      };

      const nextBooked = await findNextBooked();

      // Find next free slot from now onward (today or future days)
      const findNextFree = async (): Promise<{
        date: string;
        time: string;
      } | null> => {
        // Today from ceil(now) onwards
        const startToday = ceilToSlot(nowMinutes, open, slotLength);
        for (let t = startToday; t < close; t += slotLength) {
          const key = toHHmm(t);
          if (!bookedToday.has(key)) return { date: todayKey, time: key };
        }
        for (let d = 1; d <= daysAhead; d++) {
          const day = addDays(now, d);
          const dateKey = toDateKey(day);
          const booked = await getBookedSetForDate(dateKey);
          for (let t = open; t < close; t += slotLength) {
            const key = toHHmm(t);
            if (!booked.has(key)) return { date: dateKey, time: key };
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
      } else {
        // Currently free. Evaluate time until next booking and decide booked/free if < 20 minutes.
        if (nextBooked) {
          const [nbH, nbM] = nextBooked.time.split(':').map(Number);
          const nbMinutes = nbH * 60 + nbM;
          const minutesUntil =
            nextBooked.date === todayKey
              ? nbMinutes - nowMinutes
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
        } else {
          // No bookings within the window: show available for next X days (limit daysAhead)
          result.push({
            id: a.id,
            name: a.name,
            status: 'free',
            freeUntil: null,
            nextAvailable: null,
            availableForDays: daysAhead,
          });
        }
      }
    }

    return result;
  }
}
