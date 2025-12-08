# Docker Deployment Guide

This guide explains how to deploy the Telemedicine Platform using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose V2 or higher
- Git

## Quick Start (Local Development)

1. **Clone the repository**
```bash
git clone https://github.com/DevKimani/telemedicine-platform.git
cd telemedicine-platform
```

2. **Create environment file**
```bash
cp .env.example .env
# Edit .env and set your configuration
```

3. **Build and start all services**
```bash
docker-compose up -d
```

4. **Check service status**
```bash
docker-compose ps
```

5. **View logs**
```bash
docker-compose logs -f
```

6. **Access the application**
- Frontend: http://localhost:3000 or http://localhost
- Backend API: http://localhost:5000
- Database: localhost:5432

## Architecture

The Docker setup includes three services:

1. **PostgreSQL Database** (port 5432)
   - Persistent data storage using Docker volumes
   - Health checks enabled
   - Runs migrations automatically

2. **Node.js Backend** (port 5000)
   - Express.js REST API
   - Socket.IO for real-time communication
   - Waits for database to be healthy before starting

3. **React Frontend** (port 80/3000)
   - Built with multi-stage Docker build
   - Served by Nginx
   - Optimized for production

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Stop services and remove volumes (WARNING: deletes database data)
```bash
docker-compose down -v
```

### Rebuild services
```bash
docker-compose up -d --build
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f db
```

### Execute commands in containers
```bash
# Access server shell
docker-compose exec server sh

# Access database
docker-compose exec db psql -U postgres -d telemedicine_db

# Run migrations manually
docker-compose exec server npx knex migrate:latest
```

### Restart a service
```bash
docker-compose restart server
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DB_PASSWORD=your_secure_password

# JWT Secret (IMPORTANT: Change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional: Email (for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@telemedicine.com

# Client URL
CLIENT_URL=http://your-domain.com
```

## Cloud Deployment Options

### 1. Railway (Recommended - Free Tier Available)

Railway provides $5 free credit per month and is excellent for full-stack applications.

**Steps:**
1. Sign up at https://railway.app
2. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```
3. Login and deploy:
   ```bash
   railway login
   railway init
   railway up
   ```
4. Add PostgreSQL database from Railway dashboard
5. Set environment variables in Railway dashboard

**Pros:**
- Free $5/month credit
- Automatic SSL certificates
- Built-in PostgreSQL
- Easy deployment from GitHub
- WebSocket support (for Socket.IO)

### 2. Render (Free Tier)

Render offers free tier for web services and PostgreSQL.

**Steps:**
1. Sign up at https://render.com
2. Create new Web Service from GitHub repo
3. Set Docker as environment
4. Add PostgreSQL database (free tier)
5. Configure environment variables
6. Deploy

**Pros:**
- Free tier available
- Automatic deployments from GitHub
- Free SSL certificates
- Free PostgreSQL database (90 days retention)

**Cons:**
- Services sleep after 15 minutes of inactivity
- Limited to 750 hours/month

### 3. Fly.io (Free Tier)

Fly.io provides free tier with generous limits.

**Steps:**
1. Sign up at https://fly.io
2. Install flyctl:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
3. Login and launch:
   ```bash
   flyctl auth login
   flyctl launch
   ```
4. Deploy:
   ```bash
   flyctl deploy
   ```

**Pros:**
- Free tier: 3 shared-cpu VMs, 256MB RAM each
- Free PostgreSQL cluster
- WebSocket support
- Multiple regions

### 4. Heroku (Paid, but popular)

Heroku no longer has a free tier but is still popular for easy deployment.

**Steps:**
1. Install Heroku CLI
2. Login:
   ```bash
   heroku login
   ```
3. Create app:
   ```bash
   heroku create your-app-name
   ```
4. Add PostgreSQL:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```
5. Deploy:
   ```bash
   git push heroku main
   ```

**Pros:**
- Very easy to use
- Excellent documentation
- Many add-ons available

**Cons:**
- No free tier anymore
- Minimum $7/month

### 5. DigitalOcean App Platform

DigitalOcean offers $200 free credit for 60 days.

**Steps:**
1. Sign up at https://www.digitalocean.com
2. Create new App from GitHub
3. Select Docker as build type
4. Add PostgreSQL database
5. Configure environment variables
6. Deploy

**Pros:**
- $200 free credit (60 days)
- Good performance
- Managed database included
- Easy scaling

**Cons:**
- No permanent free tier
- Costs start at $5/month after credits

## Recommended: Railway Deployment

Railway is the best option for this project because:
- Free $5/month credit (usually enough for development)
- Supports Docker and docker-compose
- Built-in PostgreSQL
- WebSocket support (crucial for video calls)
- Automatic SSL
- Easy GitHub integration

### Railway Deployment Steps

1. **Prepare your repository**
   ```bash
   git add .
   git commit -m "Add Docker configuration"
   git push origin main
   ```

2. **Create Railway project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set DATABASE_URL

4. **Configure environment variables**
   - Go to your service → Variables
   - Add:
     - `JWT_SECRET` (generate a secure random string)
     - `NODE_ENV=production`
     - Other variables from .env.example

5. **Deploy**
   - Railway will automatically detect docker-compose.yml
   - It will build and deploy all services
   - You'll get URLs for your services

6. **Set up custom domain (optional)**
   - Go to Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed

## Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random string
- [ ] Update DB_PASSWORD to a secure password
- [ ] Configure SMTP for email functionality
- [ ] Set up custom domain and SSL
- [ ] Configure CORS_ORIGIN with your domain
- [ ] Enable database backups
- [ ] Set up monitoring and logging
- [ ] Test video calling functionality (WebRTC/Socket.IO)
- [ ] Configure rate limiting appropriately
- [ ] Review and update security headers

## Troubleshooting

### Database connection issues
```bash
# Check if database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Verify connection from server
docker-compose exec server sh
nc -zv db 5432
```

### Server not starting
```bash
# Check server logs
docker-compose logs server

# Restart server
docker-compose restart server

# Rebuild server
docker-compose up -d --build server
```

### Frontend not loading
```bash
# Check client logs
docker-compose logs client

# Verify nginx is running
docker-compose exec client ps aux

# Check nginx error logs
docker-compose exec client cat /var/log/nginx/error.log
```

### Video calling not working
- Ensure Socket.IO is properly configured
- Check that WebSocket connections are allowed
- Verify CORS settings include your domain
- Test with STUN/TURN servers if behind NAT
- Check browser console for WebRTC errors

## Performance Tips

1. **Database optimization**
   - Add indexes for frequently queried fields
   - Use connection pooling
   - Regular VACUUM and ANALYZE

2. **Server optimization**
   - Enable compression (already configured)
   - Use PM2 for process management in production
   - Configure rate limiting based on your needs

3. **Client optimization**
   - Nginx caching is already configured
   - Enable CDN for static assets
   - Use lazy loading for routes

## Security

- All passwords should be strong and unique
- JWT_SECRET should be at least 32 characters
- Enable HTTPS in production (Railway/Render do this automatically)
- Keep dependencies updated
- Regularly review security logs
- Use environment variables for all secrets
- Enable database SSL in production

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review environment variables
- Ensure all services are healthy: `docker-compose ps`
- Check network connectivity between services

## License

[Your License Here]
