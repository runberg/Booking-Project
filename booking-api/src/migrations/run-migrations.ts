import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from '@nestjs/common';

const logger = new Logger('RunMigrations');

config();

export async function runMigrations() {
  const dbPath = process.env.DB_PATH ?? '/data/booking.db';

  const migrationsDir = path.join(__dirname);
  let migrationFiles: string[] = [];

  try {
    const files = fs.readdirSync(migrationsDir);
    migrationFiles = files.filter(
      (f) => f.endsWith('.js') && f !== 'run-migrations.js',
    );
  } catch (e: unknown) {
    logger.debug(
      `Migrations directory not readable, skipping: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  if (migrationFiles.length === 0) {
    logger.log('No migration files found - skipping migrations');
    return;
  }

  let entities: unknown[];
  try {
    const { User } = await import('../shared/users/user.entity.js');
    const { Building } = await import('../shared/buildings/building.entity.js');
    const { Amenity } = await import('../shared/amenities/amenity.entity.js');
    const { BookingRestriction } = await import(
      '../shared/restrictions/booking-restriction.entity.js'
    );
    const { Booking } = await import('../shared/bookings/booking.entity.js');
    const { BookingLog } = await import(
      '../shared/bookings/booking-log.entity.js'
    );
    const { EmailTemplate } = await import(
      '../shared/email-templates/email-template.entity.js'
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`Could not load entities for migrations: ${msg}`);
    logger.warn(
      'Will skip migrations - database will use synchronize if needed',
    );
    return;
  }

  const dataSource = new DataSource({
    type: 'sqlite',
    database: dbPath,
    entities: entities as never[],
    migrations: migrationFiles.map((f) => path.join(__dirname, f)),
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    logger.log('Running database migrations...');
    const migrations = await dataSource.runMigrations();
    if (migrations.length > 0) {
      logger.log(`Applied ${migrations.length} migration(s)`);
      migrations.forEach((m) => logger.log(`  - ${m.name}`));
    } else {
      logger.log('No pending migrations');
    }
    await dataSource.destroy();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('no such table: migrations')) {
      logger.log(
        'Migrations table not found - will be created on first migration',
      );
      await dataSource.destroy().catch(() => {
        /* ignore cleanup errors */
      });
      return;
    }
    logger.error(`Migration failed: ${msg}`);
    await dataSource.destroy().catch(() => {
      /* ignore cleanup errors */
    });
  }
}
