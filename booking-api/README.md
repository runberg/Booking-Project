# Booking API

A NestJS-based API for booking amenities like badminton, tennis, and paddle courts.

## Features

- **User Authentication**: Registration, login, email verification
- **Password Management**: Secure password reset functionality
- **JWT Tokens**: Stateless authentication with access and refresh tokens
- **Email Integration**: Verification and password reset emails
- **SQLite Database**: Simple file-based database for development
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive request validation

## Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Data transfer objects
│   ├── guards/           # JWT authentication guards
│   ├── strategies/       # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── users/                # User management
│   ├── user.entity.ts    # Database entity
│   ├── users.service.ts
│   └── users.module.ts
├── email/                # Email functionality
│   ├── email.service.ts
│   └── email.module.ts
├── app.controller.ts     # Main API info
├── app.module.ts         # Root module
├── health.controller.ts  # Health check endpoint
└── main.ts              # Application entry point
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database Configuration (SQLite)
DB_PATH=booking.db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here_make_it_long_and_random

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
SMTP_FROM=noreply@bookingapp.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### 3. Run the application
```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/verify-email` - Email verification
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset
- `POST /auth/refresh` - Token refresh
- `GET /auth/profile` - Get user profile

### Health Check
- `GET /health` - Application health status

### API Info
- `GET /` - API information

## Database

The application uses SQLite for development, which creates a `booking.db` file in the project root. The database and tables are created automatically when the application starts.

## Development

```bash
# Format code
npm run format

# Lint code
npm run lint

# Build for production
npm run build
```

## License

MIT
