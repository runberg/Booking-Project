import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
config();

export async function runMigrations() {
  const dbPath = process.env.DB_PATH || '/data/booking.db';

  // Check if migrations directory exists and has migration files
  const migrationsDir = path.join(__dirname);
  let migrationFiles: string[] = [];

  try {
    const files = fs.readdirSync(migrationsDir);
    migrationFiles = files.filter(
      (f) => f.endsWith('.js') && f !== 'run-migrations.js',
    );
  } catch (error) {
    console.log('ℹ️  No migrations directory found - skipping migrations');
    return;
  }

  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migration files found - skipping migrations');
    return;
  }

  // Import entities dynamically to avoid constructor issues
  let entities: any[];
  try {
    const { User } = await import('../users/user.entity.js');
    const { Building } = await import('../buildings/building.entity.js');
    const { Amenity } = await import('../amenities/amenity.entity.js');
    const { BookingRestriction } = await import(
      '../restrictions/booking-restriction.entity.js'
    );
    const { Booking } = await import('../bookings/booking.entity.js');
    const { BookingLog } = await import('../bookings/booking-log.entity.js');
    const { EmailTemplate } = await import(
      '../email-templates/email-template.entity.js'
    );
    entities = [
      User,
      Building,
      Amenity,
      BookingRestriction,
      Booking,
      BookingLog,
      EmailTemplate,
    ];
  } catch (error: any) {
    console.warn(
      '⚠️  Could not load entities for migrations:',
      error.message || error,
    );
    console.warn(
      '   Will skip migrations - database will use synchronize if needed',
    );
    return;
  }

  const dataSource = new DataSource({
    type: 'sqlite',
    database: dbPath,
    entities: entities,
    migrations: migrationFiles.map((f) => path.join(__dirname, f)),
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
      console.log(
        'ℹ️  Migrations table not found - will be created on first migration',
      );
      try {
        await dataSource.destroy();
      } catch {}
      return;
    }
    console.error('❌ Migration failed:', error.message || error);
    try {
      await dataSource.destroy();
    } catch {}
    // Don't throw - let synchronize handle fresh databases
    return;
  }
}
