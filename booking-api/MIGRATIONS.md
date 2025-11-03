# Database Migrations Guide

## Overview

This project uses TypeORM migrations to manage database schema changes safely in production. **Never use `synchronize: true` in production** - it can cause data loss.

## Setup

Migrations are already configured. The `data-source.ts` file connects to your database and tracks which migrations have been run.

## Creating Migrations

### Option 1: Auto-generate from entity changes (Recommended)

When you modify entities (add/remove columns, change types, etc.), generate a migration:

```bash
npm run migration:generate src/migrations/DescribeYourChange
```

Example:
```bash
npm run migration:generate src/migrations/AddSlotLengthToAmenity
```

This compares your entities to the current database schema and creates a migration file with the necessary changes.

### Option 2: Create empty migration

If you need to manually write migration SQL:

```bash
npm run migration:create src/migrations/DescribeYourChange
```

Then edit the generated file in `src/migrations/` to add your SQL changes.

## Running Migrations

### In Production

After deploying new code that includes migrations, run:

```bash
# Inside the API container or on the server
cd booking-api
npm run migration:run
```

Or if using Docker:
```bash
docker compose exec api npm run migration:run
```

### In Development

Run migrations the same way:
```bash
npm run migration:run
```

## Checking Migration Status

To see which migrations have been run:

```bash
npm run migration:show
```

## Reverting Migrations

**⚠️ Warning: Reverting migrations can cause data loss.**

To revert the last migration:

```bash
npm run migration:revert
```

## Deployment Workflow

1. **Development**: Make entity changes
2. **Generate migration**: `npm run migration:generate src/migrations/YourChangeName`
3. **Review migration**: Check the generated SQL in `src/migrations/`
4. **Test locally**: Run `npm run migration:run` and test your changes
5. **Commit**: Commit both entity changes and migration files
6. **Deploy**: Deploy code to production
7. **Run migration**: `docker compose exec api npm run migration:run` (or equivalent)
8. **Verify**: Check logs and verify the application works

## Important Notes

- **Always backup your database** before running migrations in production
- **Test migrations** on a staging environment first if possible
- **Review generated migrations** - TypeORM is usually correct but always verify
- **Never edit existing migration files** that have already been run - create new migrations instead
- **Keep migrations small** - one logical change per migration is easier to debug

## Troubleshooting

### Migration fails with "table already exists"
This usually means the migration was partially run. Check `npm run migration:show` to see which migrations are recorded. You may need to manually fix the database state.

### "No migrations pending" but schema is wrong
This can happen if migrations were run manually or if the database was created with `synchronize: true`. You may need to:
1. Check the actual database schema
2. Create a new migration to sync it with your entities
3. Or manually fix the database and mark migrations as run

### SQLite-specific considerations

- SQLite has limited ALTER TABLE support - some changes (like renaming columns) require creating a new table and copying data
- TypeORM handles this automatically, but the migration might be more complex
- Always test migrations with a copy of production data if possible

