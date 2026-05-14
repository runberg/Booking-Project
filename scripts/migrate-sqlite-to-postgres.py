#!/usr/bin/env python3
"""
SQLite -> PostgreSQL migration for Booking Project.

Run on the production server AFTER the API has completed its first startup
(TypeORM creates the schema, seeder inserts the default admin + building).

Usage:
    python3 scripts/migrate-sqlite-to-postgres.py /path/to/data/booking.db \\
        | docker compose exec -T postgres psql -U booking booking

The script outputs a single SQL transaction to stdout.
All seeded placeholder rows (admin user, Default Building) are replaced by
the real data from SQLite. The original bcrypt-hashed passwords are
preserved -- users keep their existing passwords.
"""

import sqlite3
import sys


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def q(value, is_bool: bool = False) -> str:
    """Render a Python value as a PostgreSQL SQL literal."""
    if value is None:
        return "NULL"
    if is_bool:
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return repr(value)
    s = str(value).replace("'", "''")
    return f"'{s}'"


def col_list(cols: list) -> str:
    return ", ".join(f'"{c}"' for c in cols)


def val_list(cols: list, row: tuple, bool_cols: set) -> str:
    return ", ".join(q(v, is_bool=(cols[i] in bool_cols)) for i, v in enumerate(row))


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def fetch(conn: sqlite3.Connection, table: str):
    cur = conn.execute(f'SELECT * FROM "{table}"')
    cols = [d[0] for d in cur.description]
    return cols, cur.fetchall()


def skip(table: str) -> None:
    print(f"-- {table}: not found in SQLite, skipping")


# --------------------------------------------------------------------------- #
# per-table migration
# --------------------------------------------------------------------------- #

def migrate_users(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "users"):
        skip("users")
        return
    cols, rows = fetch(conn, "users")
    bool_cols = {"isEmailVerified", "isActive"}
    print(f"-- users ({len(rows)} rows)")
    # Wipe the seeded admin so real data (with the original UUID) takes its place.
    print("DELETE FROM users;")
    for row in rows:
        print(f"INSERT INTO users ({col_list(cols)}) VALUES ({val_list(cols, row, bool_cols)});")
    print()


def migrate_buildings(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "buildings"):
        skip("buildings")
        return
    cols, rows = fetch(conn, "buildings")
    bool_cols = {"isActive"}
    print(f"-- buildings ({len(rows)} rows)")
    # Wipe the seeded 'Default Building'.
    print("DELETE FROM buildings;")
    for row in rows:
        print(f"INSERT INTO buildings ({col_list(cols)}) VALUES ({val_list(cols, row, bool_cols)});")
    print()


def migrate_building_units(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "building_units"):
        skip("building_units")
        return
    cols, rows = fetch(conn, "building_units")
    print(f"-- building_units ({len(rows)} rows)")
    for row in rows:
        print(
            f'INSERT INTO building_units ({col_list(cols)}) VALUES ({val_list(cols, row, set())})'
            f'  ON CONFLICT ("buildingId", "unitNumber") DO NOTHING;'
        )
    print()


def migrate_booking_restrictions(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "booking_restrictions"):
        skip("booking_restrictions")
        return
    cols, rows = fetch(conn, "booking_restrictions")
    bool_cols = {"isActive"}
    print(f"-- booking_restrictions ({len(rows)} rows)")
    update_cols = [c for c in cols if c not in ("id", "name")]
    update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
    for row in rows:
        print(
            f'INSERT INTO booking_restrictions ({col_list(cols)}) VALUES ({val_list(cols, row, bool_cols)})'
            f'  ON CONFLICT (name) DO UPDATE SET {update_set};'
        )
    print()


def migrate_amenities(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "amenities"):
        skip("amenities")
        return
    cols, rows = fetch(conn, "amenities")
    bool_cols = {"isActive"}
    print(f"-- amenities ({len(rows)} rows)")
    update_cols = [c for c in cols if c not in ("id", "name")]
    update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
    for row in rows:
        print(
            f'INSERT INTO amenities ({col_list(cols)}) VALUES ({val_list(cols, row, bool_cols)})'
            f'  ON CONFLICT (name) DO UPDATE SET {update_set};'
        )
    print()


def migrate_bookings(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "bookings"):
        skip("bookings")
        return
    cols, rows = fetch(conn, "bookings")
    print(f"-- bookings ({len(rows)} rows)")
    for row in rows:
        print(
            f'INSERT INTO bookings ({col_list(cols)}) VALUES ({val_list(cols, row, set())})'
            f'  ON CONFLICT ("amenityId", "date", "startTime") DO NOTHING;'
        )
    print()


def migrate_booking_logs(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "booking_logs"):
        skip("booking_logs")
        return
    cols, rows = fetch(conn, "booking_logs")
    print(f"-- booking_logs ({len(rows)} rows)")
    for row in rows:
        print(
            f'INSERT INTO booking_logs ({col_list(cols)}) VALUES ({val_list(cols, row, set())})'
            f'  ON CONFLICT (id) DO NOTHING;'
        )
    print()


def migrate_email_templates(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, "email_templates"):
        skip("email_templates")
        return
    cols, rows = fetch(conn, "email_templates")
    print(f"-- email_templates ({len(rows)} rows)")
    update_cols = [c for c in cols if c not in ("id", "key")]
    if update_cols:
        conflict = "ON CONFLICT (key) DO UPDATE SET " + ", ".join(
            f'"{c}" = EXCLUDED."{c}"' for c in update_cols
        )
    else:
        conflict = "ON CONFLICT (key) DO NOTHING"
    for row in rows:
        print(
            f'INSERT INTO email_templates ({col_list(cols)}) VALUES ({val_list(cols, row, set())})'
            f'  {conflict};'
        )
    print()


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(
            "Usage: python3 migrate-sqlite-to-postgres.py <path/to/booking.db>\n"
            "\nPipe the output to psql:\n"
            "  python3 scripts/migrate-sqlite-to-postgres.py /data/booking.db \\\n"
            "    | docker compose exec -T postgres psql -U booking booking"
        )

    db_path = sys.argv[1]
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except Exception as exc:
        sys.exit(f"Cannot open SQLite database '{db_path}': {exc}")

    all_tables = sorted(
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    )
    print(f"-- SQLite source: {db_path}")
    print(f"-- Tables found: {', '.join(all_tables)}")
    print()
    print("BEGIN;")
    print()

    # Insert order respects application-level FK relationships.
    migrate_users(conn)
    migrate_buildings(conn)
    migrate_building_units(conn)
    migrate_booking_restrictions(conn)
    migrate_amenities(conn)
    migrate_bookings(conn)
    migrate_booking_logs(conn)
    migrate_email_templates(conn)

    print("COMMIT;")
    conn.close()


if __name__ == "__main__":
    main()
