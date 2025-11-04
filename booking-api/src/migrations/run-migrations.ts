import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/user.entity';
import { Building } from '../buildings/building.entity';
import { Amenity } from '../amenities/amenity.entity';
import { BookingRestriction } from '../restrictions/booking-restriction.entity';
import { Booking } from '../bookings/booking.entity';
import { BookingLog } from '../bookings/booking-log.entity';
import { EmailTemplate } from '../email-templates/email-template.entity';
import * as path from 'path';

// Load environment variables
config();

export async function runMigrations() {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: process.env.DB_PATH || '/data/booking.db',
    entities: [User, Building, Amenity, BookingRestriction, Booking, BookingLog, EmailTemplate],
    migrations: [path.join(__dirname, '*.js')],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('📦 Running database migrations...');
    const migrations = await dataSource.runMigrations();
    if (migrations.length > 0) {
      console.log(`✅ Applied ${migrations.length} migration(s)`);
      migrations.forEach((m) => console.log(`   - ${m.name}`));
    } else {
      console.log('ℹ️  No pending migrations');
    }
    await dataSource.destroy();
  } catch (error: any) {
    // Don't fail if migrations table doesn't exist yet (fresh install)
    if (error.message && error.message.includes('no such table: migrations')) {
      console.log('ℹ️  Migrations table not found - will be created on first migration');
      await dataSource.destroy();
      return;
    }
    console.error('❌ Migration failed:', error.message || error);
    await dataSource.destroy();
    // Don't exit - let synchronize handle fresh databases
    throw error;
  }
}

