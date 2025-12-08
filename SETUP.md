# Local Setup Guide - Telemedicine Platform

This guide provides step-by-step commands to set up the telemedicine platform on a new machine.

## Prerequisites Installation

### Install Node.js (v16 or higher)
```bash
# Visit: https://nodejs.org/
# Or use nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 16
nvm use 16
```

### Install PostgreSQL (v12 or higher)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Start PostgreSQL service
sudo service postgresql start  # Linux
brew services start postgresql  # macOS
```

### Verify Installations
```bash
node --version
npm --version
psql --version
```

## Setup Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd telemedicine-platform
```

### 2. Install All Dependencies
```bash
npm run install-all
```

### 3. Database Setup
```bash
# Access PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE telemedicine_db;

# Exit psql
\q
```

### 4. Environment Configuration

#### Root Directory
```bash
cp .env.example .env
```

#### Server Configuration
```bash
cd server
cp env.example .env
cd ..
```

Edit `server/.env` and update the following:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telemedicine_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_generated_secret_key
```

#### Client Configuration
```bash
cd client
```

Create `.env` file with:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

```bash
cd ..
```

### 5. Run Database Migrations
```bash
cd server
npx knex migrate:latest
cd ..
```

### 6. Start Development Servers

#### Option 1: Start Both (Recommended)
```bash
npm run dev
```

#### Option 2: Start Individually
```bash
# Terminal 1 - Server
npm run server

# Terminal 2 - Client
npm run client
```

### 7. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

## Alternative: Docker Setup

### Using Docker Compose
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec server npx knex migrate:latest

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Mobile App Setup (Optional)

### Prerequisites for Mobile
```bash
# Install React Native CLI
npm install -g react-native-cli

# Android: Install Android Studio
# iOS: Install Xcode (macOS only)
```

### Setup Mobile App
```bash
cd mobile
npm install

# For Android
npm run android

# For iOS (macOS only)
cd ios
pod install
cd ..
npm run ios
```

## Verification Commands

### Check Server Health
```bash
curl http://localhost:5000/api/health
```

### Check Database Migrations Status
```bash
cd server
npx knex migrate:status
```

### Check Running Processes
```bash
# Check if ports are in use
netstat -tulpn | grep 3000  # Client
netstat -tulpn | grep 5000  # Server
netstat -tulpn | grep 5432  # PostgreSQL
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 5000
npx kill-port 5000
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo service postgresql status

# Restart PostgreSQL
sudo service postgresql restart

# Check PostgreSQL is listening
psql -U postgres -c "SELECT version();"
```

### Clear Node Modules and Reinstall
```bash
# Root
rm -rf node_modules package-lock.json

# Server
cd server
rm -rf node_modules package-lock.json

# Client
cd ../client
rm -rf node_modules package-lock.json

# Reinstall all
cd ..
npm run install-all
```

### Reset Database
```bash
cd server

# Rollback migrations
npx knex migrate:rollback --all

# Re-run migrations
npx knex migrate:latest
```

## Development Workflow

### Running Tests
```bash
# Server tests
cd server
npm test

# Client tests
cd client
npm test
```

### Building for Production
```bash
# Build client
cd client
npm run build

# Start server in production mode
cd ../server
NODE_ENV=production npm start
```

## Environment Variables Reference

### Required Server Variables
- `DB_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - Secret key for JWT tokens (generate with: `openssl rand -base64 32`)

### Optional Server Variables
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - SMS/Video features
- `STRIPE_SECRET_KEY` - Payment processing
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - File storage

### Required Client Variables
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_SOCKET_URL` - WebSocket connection URL

## Next Steps

After successful setup:
1. Create admin user account
2. Configure SMTP for email notifications (optional)
3. Set up Twilio for video consultations (optional)
4. Configure Stripe for payments (optional)
5. Set up AWS S3 for file storage (optional)

## Support

For issues or questions, please contact the development team or check the project documentation.
