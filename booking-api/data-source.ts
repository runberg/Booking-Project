import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/user.entity';
import { Building } from './src/buildings/building.entity';
import { Amenity } from './src/amenities/amenity.entity';
import { BookingRestriction } from './src/restrictions/booking-restriction.entity';
import { Booking } from './src/bookings/booking.entity';
import { BookingLog } from './src/bookings/booking-log.entity';
import { EmailTemplate } from './src/email-templates/email-template.entity';

// Load environment variables
config();

export default new DataSource({
  type: 'sqlite',
  database: process.env.DB_PATH || 'booking.db',
  entities: [User, Building, Amenity, BookingRestriction, Booking, BookingLog, EmailTemplate],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // Never use synchronize in production
  logging: true,
});

