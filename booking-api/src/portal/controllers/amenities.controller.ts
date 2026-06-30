import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AmenitiesService } from '../../shared/amenities/amenities.service';
import { Amenity } from '../../shared/amenities/amenity.entity';
import { BookingRestriction } from '../../shared/restrictions/booking-restriction.entity';
import { Booking } from '../../shared/bookings/booking.entity';

type SlotContext = {
  open: number;
  close: number;
  slotLength: number;
  daysAhead: number;
};

type NowContext = {
  now: Date;
  todayKey: string;
  nowMinutes: number;
};

type Slot = { date: string; time: string };

type AmenityStatus = {
  id: string;
  name: string;
  status: 'free' | 'booked' | 'closed';
  freeUntil: string | null;
  nextAvailable: string | null;
  availableForDays: number | null;
};

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
      closureStart: a.closureStart,
      closureEnd: a.closureEnd,
      closureActive: a.closureActive,
      closureReason: a.closureReason,
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
    const nowCtx: NowContext = {
      now,
      todayKey: toDateKey(now),
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    };

    const result: AmenityStatus[] = [];
    for (const a of amenities) {
      const ctx: SlotContext = {
        open: parseTime(a.openTime || '09:00'),
        close: parseTime(a.closeTime || '22:00'),
        slotLength: a.slotLength || 60,
        daysAhead:
          idToRestriction.get(a.bookingRestrictionId || '')?.daysAhead ?? 14,
      };
      result.push(await this.resolveAmenityAvailability(a, ctx, nowCtx));
    }
    return result;
  }

  private async resolveAmenityAvailability(
    a: Amenity,
    ctx: SlotContext,
    nowCtx: NowContext,
  ): Promise<AmenityStatus> {
    if (nowCtx.nowMinutes < ctx.open || nowCtx.nowMinutes >= ctx.close) {
      return this.resolveClosedStatus(a, ctx, nowCtx);
    }

    const bookedToday = await this.getBookedSet(a.id, nowCtx.todayKey);
    const currentSlotStart =
      ctx.open +
      Math.floor(Math.max(0, nowCtx.nowMinutes - ctx.open) / ctx.slotLength) *
        ctx.slotLength;

    if (bookedToday.has(toHHmm(currentSlotStart))) {
      const nf = await this.findNextFreeFromNow(a.id, ctx, nowCtx, bookedToday);
      return toStatus(a, 'booked', null, nf, null);
    }

    return this.resolveOpenStatus(a, ctx, nowCtx, bookedToday, currentSlotStart);
  }

  private async resolveClosedStatus(
    a: Amenity,
    ctx: SlotContext,
    nowCtx: NowContext,
  ): Promise<AmenityStatus> {
    const searchStart =
      nowCtx.nowMinutes < ctx.open ? new Date(nowCtx.now) : addDays(nowCtx.now, 1);
    const found = await this.findNextFreeSlot(a.id, searchStart, ctx);
    return toStatus(a, 'closed', null, found, null);
  }

  private async resolveOpenStatus(
    a: Amenity,
    ctx: SlotContext,
    nowCtx: NowContext,
    bookedToday: Set<string>,
    currentSlotStart: number,
  ): Promise<AmenityStatus> {
    const nextBooked = await this.findNextBookedFrom(
      a.id,
      ctx,
      nowCtx,
      bookedToday,
      currentSlotStart,
    );

    if (!nextBooked) {
      return toStatus(a, 'free', null, null, ctx.daysAhead);
    }

    const [nbH, nbM] = nextBooked.time.split(':').map(Number);
    const minutesUntil =
      nextBooked.date === nowCtx.todayKey
        ? nbH * 60 + nbM - nowCtx.nowMinutes
        : Number.MAX_SAFE_INTEGER;

    if (minutesUntil < 20) {
      const nf = await this.findNextFreeFromNow(a.id, ctx, nowCtx, bookedToday);
      return toStatus(a, 'booked', null, nf, null);
    }

    return toStatus(a, 'free', nextBooked, null, null);
  }

  private async findNextFreeSlot(
    amenityId: string,
    from: Date,
    ctx: SlotContext,
  ): Promise<Slot | null> {
    for (let d = 0; d <= ctx.daysAhead; d++) {
      const day = addDays(from, d);
      const dateKey = toDateKey(day);
      const booked = await this.getBookedSet(amenityId, dateKey);
      for (let t = ctx.open; t < ctx.close; t += ctx.slotLength) {
        if (!booked.has(toHHmm(t))) return { date: dateKey, time: toHHmm(t) };
      }
    }
    return null;
  }

  private async findNextFreeFromNow(
    amenityId: string,
    ctx: SlotContext,
    nowCtx: NowContext,
    bookedToday: Set<string>,
  ): Promise<Slot | null> {
    const startSlot = ceilToSlot(nowCtx.nowMinutes, ctx.open, ctx.slotLength);
    for (let t = startSlot; t < ctx.close; t += ctx.slotLength) {
      if (!bookedToday.has(toHHmm(t)))
        return { date: nowCtx.todayKey, time: toHHmm(t) };
    }
    for (let d = 1; d <= ctx.daysAhead; d++) {
      const day = addDays(nowCtx.now, d);
      const dateKey = toDateKey(day);
      const booked = await this.getBookedSet(amenityId, dateKey);
      for (let t = ctx.open; t < ctx.close; t += ctx.slotLength) {
        if (!booked.has(toHHmm(t))) return { date: dateKey, time: toHHmm(t) };
      }
    }
    return null;
  }

  private async findNextBookedFrom(
    amenityId: string,
    ctx: SlotContext,
    nowCtx: NowContext,
    bookedToday: Set<string>,
    currentSlotStart: number,
  ): Promise<Slot | null> {
    for (
      let t = Math.max(currentSlotStart, ctx.open);
      t < ctx.close;
      t += ctx.slotLength
    ) {
      if (bookedToday.has(toHHmm(t)))
        return { date: nowCtx.todayKey, time: toHHmm(t) };
    }
    for (let d = 1; d <= ctx.daysAhead; d++) {
      const day = addDays(nowCtx.now, d);
      const dateKey = toDateKey(day);
      const booked = await this.getBookedSet(amenityId, dateKey);
      for (let t = ctx.open; t < ctx.close; t += ctx.slotLength) {
        if (booked.has(toHHmm(t))) return { date: dateKey, time: toHHmm(t) };
      }
    }
    return null;
  }

  private async getBookedSet(
    amenityId: string,
    dateKey: string,
  ): Promise<Set<string>> {
    const list = await this.bookingsRepo.find({
      where: { amenityId, date: dateKey },
    });
    return new Set(list.map((b) => b.startTime));
  }
}

function toStatus(
  a: Amenity,
  status: AmenityStatus['status'],
  freeUntilSlot: Slot | null,
  nextAvailableSlot: Slot | null,
  availableForDays: number | null,
): AmenityStatus {
  return {
    id: a.id,
    name: a.name,
    status,
    freeUntil: freeUntilSlot
      ? `${freeUntilSlot.date} ${freeUntilSlot.time}`
      : null,
    nextAvailable: nextAvailableSlot
      ? `${nextAvailableSlot.date} ${nextAvailableSlot.time}`
      : null,
    availableForDays,
  };
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
