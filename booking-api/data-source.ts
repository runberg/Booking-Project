import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/shared/users/user.entity';
import { Building } from './src/shared/buildings/building.entity';
import { BuildingUnit } from './src/shared/buildings/building-unit.entity';
import { Amenity } from './src/shared/amenities/amenity.entity';
import { BookingRestriction } from './src/shared/restrictions/booking-restriction.entity';
import { Booking } from './src/shared/bookings/booking.entity';
import { BookingLog } from './src/shared/bookings/booking-log.entity';
import { EmailTemplate } from './src/shared/email-templates/email-template.entity';
import { Setting } from './src/shared/settings/setting.entity';

config();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Building, BuildingUnit, Amenity, BookingRestriction, Booking, BookingLog, EmailTemplate, Setting],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
