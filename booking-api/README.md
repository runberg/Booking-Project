# Booking API

NestJS 11 backend for the Booking System. See the [root README](../README.md) for full deployment instructions.

## Tech

- NestJS 11 with Fastify adapter
- TypeORM with PostgreSQL
- JWT authentication (access + refresh tokens)
- bcrypt password hashing
- Nodemailer for email
- Role-based access control (`USER`, `SUPER`, `ADMIN`)

## Local development

```bash
npm install
cp .env.example .env   # configure DATABASE_URL
npm run start:dev
```

Requires a running PostgreSQL instance. Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://booking:password@localhost:5432/booking
```

## Key endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Public | Exchange refresh token for new access token |
| POST | `/auth/verify-email` | Public | Verify email address |
| POST | `/auth/forgot-password` | Public | Request password reset email |
| POST | `/auth/reset-password` | Public | Reset password using token |
| GET | `/auth/profile` | User | Current user profile |
| GET | `/bookings/me` | User | User's own bookings |
| POST | `/bookings` | User | Create a booking |
| DELETE | `/bookings/:id` | User | Cancel own booking |
| GET | `/bookings/amenity/:id` | User | Booked slots for an amenity on a date |
| GET | `/bookings/upcoming` | Admin | Upcoming bookings across all users |
| GET | `/bookings/logs` | Admin | Paginated booking audit log |
| GET | `/bookings/logs/export` | Admin | Export booking log as CSV |
| GET | `/admin/users` | Admin/Super | List all users |
| POST | `/admin/users` | Admin | Create a user |
| DELETE | `/admin/users/:id` | Admin/Super | Delete a user |
| POST | `/admin/users/:id/role` | Admin | Change a user's role |
| GET | `/health` | Public | Health check |

## Scripts

```bash
npm run start:dev      # development with hot reload
npm run build          # compile to dist/
npm run start:prod     # run compiled output
npm run lint           # ESLint
npm run format         # Prettier
npm run migration:generate  # generate a new migration from entity changes
npm run migration:run       # apply pending migrations
npm run migration:revert    # revert last migration
```
