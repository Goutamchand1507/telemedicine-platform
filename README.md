# Telemedicine Platform for Rural Areas

A comprehensive HIPAA-compliant telemedicine platform that connects rural patients with healthcare providers through secure video consultations, electronic health records, and prescription management.

## Features

- 🔐 **Secure Authentication**: JWT-based authentication for patients, doctors, and administrators
- 📹 **Video Consultations**: WebRTC-powered video calls with recording capabilities
- 📋 **Electronic Health Records**: Comprehensive EHR system with document upload
- 📅 **Appointment Scheduling**: Calendar integration for easy appointment management
- 💊 **Prescription Management**: Digital prescription system with pharmacy integration
- 💳 **Billing System**: Secure payment processing and insurance claim handling
- 📱 **Cross-Platform**: Web and mobile applications for patients and providers
- 🛡️ **HIPAA Compliant**: Built with healthcare data security in mind

## Technology Stack

- **Frontend**: React.js with TypeScript
- **Mobile**: React Native
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with encryption
- **Video**: WebRTC for real-time communication
- **Authentication**: JWT with bcrypt
- **Cloud**: AWS-ready architecture

## Project Structure

```
telemedicine-platform/
├── client/                 # React frontend application
├── mobile/                 # React Native mobile app
├── server/                 # Node.js backend API
├── database/               # Database schemas and migrations
└── docs/                   # Documentation
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Set up environment variables (see `.env.example` files in each directory)

4. Set up the database:
   ```bash
   cd server
   npm run db:migrate
   npm run db:seed
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

## Environment Setup

### Server Environment Variables
```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telemedicine_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

### Client Environment Variables
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WEBSOCKET_URL=ws://localhost:5000
```

## API Documentation

The API documentation is available at `/api/docs` when the server is running.

## Security & Compliance

This platform is designed with HIPAA compliance in mind:

- All PHI (Protected Health Information) is encrypted at rest and in transit
- Access controls and audit logging
- Secure video communication
- Data backup and recovery procedures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team.
